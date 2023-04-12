WIP for deploying SAM

Scripts and the sam model notebook are from https://github.com/facebookresearch/segment-anything/tree/main

### 1. Downloading model weights

If you have access, download from the devseed s3:

```
aws s3 sync model-weights s3://segment-anything/model-weights/
```

otherwise, get checkpoints from the original repo: https://github.com/facebookresearch/segment-anything/tree/main#model-checkpoints

### 2a. Package the torch weights for GPU encoding

This step takes a long time presumably because the uncompiled weights are massive. Packaging the ONNX model is faster in the later steps. TODO figure out how to compile the encoder step.

```
mkdir -p model_store
torch-model-archiver --model-name sam_vit_h_encode --version 1.0.0 --serialized-file model-weights/sam_vit_h_4b8939.pth --handler handler.py 
mv sam_vit_h_encode.mar model_store/sam_vit_h_encode.mar
```

### 2b. Exporting the ONNX model for CPU decoding

```
mkdir -p models                    
python scripts/export_onnx_model.py --checkpoint model-weights/sam_vit_h_4b8939.pth --model-type vit_h --output models/sam_vit_h_decode.onnx
```

### 2c. Package the ONNX model for CPU encoding with the handler

We'll put this in the model_store directory, to keep the onnx model files distinct from the torchserve .mar model archives. model_store/ is created automatically by Torchserve in the container, which is why we're make a local folder here called "model_store".

```
mkdir -p model_store
torch-model-archiver --model-name sam_vit_h_decode --version 1.0.0 --serialized-file models/sam_vit_h_decode.onnx --handler handler.py
mv sam_vit_h_decode.mar model_store/sam_vit_h_decode.mar
```


### 3. Building the gpu torchserve container for image encoding
With the GPU, inference time should be about 1.8 seconds or less depending on the GPU. On an older 1080 Ti Pascal GPU, inference time is 1.67 seconds without compilation.

```
docker build -t torchserve-sam-gpu .
bash start_serve.sh $(pwd)/model_store
```


### 4. Building jupyter server container

Use this container to test the model in a GPU enabled jupyter notebook server with geospatial and pytorch dependencies installed.

```
docker build -t sam-geo-dev -f Dockerfile-dev .
```


### Run jupyter server container

Remove the `--gpus` arg if you don't have a GPU

```
docker run -it --rm \
    -v $HOME/.aws:/root/.aws \
    -v "$(pwd)":/segment-anything-geo \
    -p 8888:8888 \
    -e AWS_PROFILE=devseed \
    --gpus all sam-geo-dev
```

### Misc
Debugging Torchserve in VSCode with dev containers extension


Follow https://github.com/pytorch/serve/issues/2223

Use this to start the container rather than `bash start_serve.sh` `serve`

```
docker run -it -p 8080:8080 -v $(pwd)/model_store:/home/model-server/model_store torchserve-sam:latest bash
```
