WIP for deploying SAM

Scripts and the sam model notebook are from https://github.com/facebookresearch/segment-anything/tree/main

### Building container to explore 

Download the [weights](https://github.com/facebookresearch/segment-anything/tree/main#model-checkpoints), run inference on satellite images, run a jupyter notebook server

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

### Run the streamlit app
```
# pass in the model checkpoint and model type in `app.py`
MODEL_CHECKPOINT=<sam-checkpoint-weights> 
MODEL_TYPE=<vit_b | vit_l | vit_h>

streamlit run app.py
```