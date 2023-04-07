# $1 is the path to the dir holding the .mar file with the onnx model. there should be only one .mar file
docker run -it -p 8080:8080 -v $1:/opt/ml/model torchserve-mdv5a:latest serve