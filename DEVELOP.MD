# Development environment

Here are the commands to set up the development environment. The containers share several synchronized folders among them, ensuring that you only need to run the following command once you make a change:


### Building the containers

```sh
docker-compose build
```

### Running the containers

```sh
docker-compose up -d
```


### Creating the mar files in the "build" continaer

```sh

docker-compose exec build bash

## Encoder
torch-model-archiver \
    --model-name sam_vit_h_encode \
    --version 1.0.0 \
    --serialized-file model-weights/sam_vit_h_4b8939.pth \
    --handler handler_encode.py \
    --export-path model-store \
    --force

## Decoder
torch-model-archiver \
    --model-name sam_vit_h_decode \
    --version 1.0.0 \
    --serialized-file model-store/sam_vit_h_decode.onnx \
    --handler handler_decode.py \
    --export-path ./model-store \
    --force


```


## Starting decoder service

```sh
docker-compose exec cpu bash
torchserve --foreground --ts-config ./deployment/config_decode.properties
```

### Starting encode service

```sh
docker-compose exec gpu bash
torchserve --foreground --ts-config ./deployment/config_encoder.properties
```


Access the local services at:

- Encoder: http://127.0.0.1:8080
- Decoder: http://127.0.0.1:7080
- Jupyter-lab: http://127.0.0.1:8888













