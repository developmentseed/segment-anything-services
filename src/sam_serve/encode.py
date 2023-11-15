import base64
import os
import numpy as np
import torch
import io
from segment_anything import sam_model_registry, SamPredictor
from ts.utils.util import PredictionException
from sam_serve.utils import start_timer, measure_time, load_image

def initialize_model(context):
    start = start_timer()
    properties = context.system_properties
    model_dir = properties.get("model_dir")
    device = torch.device("cuda:" + str(properties.get("gpu_id")) if torch.cuda.is_available() and str(properties.get("gpu_id")) != "None" else "cpu")
    serialized_file = context.manifest['model']['serializedFile']
    model_path = os.path.join(model_dir, serialized_file)
    sam = sam_model_registry["default"](checkpoint=model_path)
    sam.to(device=device)
    predictor = SamPredictor(sam)
    measure_time(start, "Initialization time")
    return predictor

def request_to_arr(data):
    start = start_timer()
    row = data[0]
    image = row.get("data") or row.get("body")
    if isinstance(image, dict) and "encoded_image" in image:
        image = image['encoded_image']
    if isinstance(image, str):
        image = base64.b64decode(image)
    if isinstance(image, (bytearray, bytes)):
        image = load_image(io.BytesIO(image))
    else:
        print("not a bytearray")
        assert False
    image = np.asarray(image)
    image = np.ascontiguousarray(image)
    measure_time(start, f"Preprocess time and shape {image.shape}")
    return image

def get_embedding(predictor, image):
    start = start_timer()
    predictor.set_image(image)
    image_embedding = predictor.get_image_embedding().cpu().numpy()
    measure_time(start, "Inference time")
    return image_embedding

def embedding_to_response(inference_output):
    base64_encoded_embedding = base64.b64encode(inference_output.flatten()).decode("utf-8")
    return [{"status": "success", "image_embedding": base64_encoded_embedding}]

def check_image_size(image):
    if image.shape[0] * image.shape[1] > 2048*2048:
        raise PredictionException(f"Image size {image.shape} exceeded the 2048x2048 input size limit. Tile your image and submit tiles individually or resize the image to a smaller size.")
