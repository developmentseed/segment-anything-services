docker run -it -p 7080:7080 -p 7081:7081 -p 7082:7082 -v $(pwd)/model_store_decode:/home/model-server/model_store torchserve-sam-cpu:latest serve