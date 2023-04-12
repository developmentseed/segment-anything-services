WIP for deploying SAM

Scripts and the sam model notebook are from https://github.com/facebookresearch/segment-anything/tree/main

### Downloading model weights

If you have access, download from the devseed s3:

```
aws s3 sync model-weights s3://segment-anything/model-weights/
```

otherwise, get checkpoints from the original repo: https://github.com/facebookresearch/segment-anything/tree/main#model-checkpoints

### Exporting the ONNX model for CPU encoding

```
python scripts/export_onnx_model.py --checkpoint <path/to/checkpoint> --model-type <model_type> --output <path/to/output>
```

### Building container to explore 

, run inference on satellite images, run a jupyter notebook server

```
docker build -t sam-geo -f Dockerfile-dev .
```

### Building torchserve container WIP, doesn't accept requests yet

```
docker build -t sam-geo-ts -f Dockerfile .
```


### Run notebook

```
docker run -it --rm \
    -v $HOME/.aws:/root/.aws \
    -v "$(pwd)":/segment-anything-geo \
    -p 8888:8888 \
    -e AWS_PROFILE=devseed \
    --gpus all sam-geo 
```
