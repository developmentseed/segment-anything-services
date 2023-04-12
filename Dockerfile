FROM pytorch/torchserve:latest
USER root
# RUN pip install --upgrade pip && pip install opencv-python ipython
# commit id https://github.com/ultralytics/yolov5/blob/9286336cb49d577873b2113739788bbe3b90f83c/requirements.txt
RUN pip install "matplotlib" "numpy" "opencv-python" \
    "Pillow" "torch>=1.7.0" "torchvision>=0.8" "pycocotools" \
    "onnxruntime==1.14.1" "onnx==1.13.1" \
    "git+https://github.com/facebookresearch/segment-anything.git"
ENV ENABLE_TORCH_PROFILER=TRUE