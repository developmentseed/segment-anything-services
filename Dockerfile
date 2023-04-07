FROM pytorch/torchserve:latest
USER root
# RUN pip install --upgrade pip && pip install opencv-python ipython
# commit id https://github.com/ultralytics/yolov5/blob/9286336cb49d577873b2113739788bbe3b90f83c/requirements.txt
RUN pip install "matplotlib" "numpy" "opencv-python" \
    "Pillow" "torch>=1.7.0" "torchvision>=0.8" "pycocotools" \
    "onnxruntime==1.14.1" "onnx==1.13.1" \
    "git+https://github.com/facebookresearch/segment-anything.git"
COPY ./deployment/dockerd-entrypoint.sh /usr/local/bin/dockerd-entrypoint.sh
RUN chmod +x /usr/local/bin/dockerd-entrypoint.sh
RUN mkdir -p /home/model-server/ && mkdir -p /home/model-server/tmp
COPY ./deployment/config.properties /home/model-server/config.properties
WORKDIR /home/model-server
ENV TEMP=/home/model-server/tmp
ENV ENABLE_TORCH_PROFILER=TRUE
ENTRYPOINT ["/usr/local/bin/dockerd-entrypoint.sh"]
CMD ["serve"]