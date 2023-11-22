import base64
import os
from time import time
import numpy as np
import torch
from sam_serve.utils import np_to_py_type
import rasterio
from pyproj import CRS, Transformer
from shapely import ops
from shapely.geometry import mapping, shape, MultiPolygon
from segment_anything.utils.transforms import ResizeLongestSide
import json
from rasterio import features
import onnxruntime


def initialize_decoder(context):
    properties = context.system_properties
    model_dir = properties.get("model_dir")
    device = torch.device(
        "cuda:" + str(properties.get("gpu_id"))
        if torch.cuda.is_available() and str(properties.get("gpu_id")) != "None"
        else "cpu"
    )
    serialized_file = context.manifest['model']['serializedFile']
    onnx_model_path = os.path.join(model_dir, serialized_file)
    ort_session = onnxruntime.InferenceSession(onnx_model_path)
    return ort_session, device


def prepare_decode_inputs(data):
    row = data[0]
    payload = row.get("data") or row.get("body")
    if (
        isinstance(payload, dict)
        and "image_embeddings" in payload
        and "image_shape" in payload
        and "input_prompt" in payload
        and "input_label" in payload
        and "decode_type" in payload
    ):
        if isinstance(payload['image_embeddings'], str):
            image_embeddings = base64.b64decode(payload['image_embeddings'])
            image_embeddings = np.frombuffer(image_embeddings, dtype=np.float32)
            image_embeddings = image_embeddings.reshape((1, 256, 64, 64))
            payload['image_embeddings'] = image_embeddings
            return payload
        else:
            raise ValueError("image embeddings must be passed to the payload as a base64 encoded str.")

    else:
        raise ValueError(
            "one of image_shape, input_prompt, input_label, decode_type, image_embeddings payload dict keys missing."
        )


def decode_single_point(payload, ort_session, input_point, input_label):
    start = time()
    resizer = ResizeLongestSide(1024)
    onnx_coord = np.concatenate([np.array(input_point)[np.newaxis, :], np.array([[0.0, 0.0]])], axis=0)[None, :, :]
    onnx_label = np.concatenate([np.array([input_label]), np.array([-1])], axis=0)[None, :].astype(np.float32)
    onnx_coord = resizer.apply_coords(onnx_coord, payload.get("image_shape")).astype(np.float32)
    onnx_mask_input = np.zeros((1, 1, 256, 256), dtype=np.float32)
    onnx_has_mask_input = np.zeros(1, dtype=np.float32)
    ort_inputs = {
        "image_embeddings": payload['image_embeddings'],
        "point_coords": onnx_coord,
        "point_labels": onnx_label,
        "mask_input": onnx_mask_input,
        "has_mask_input": onnx_has_mask_input,
        "orig_im_size": np.array(payload.get("image_shape"), dtype=np.float32),
    }
    masks, scores, low_res_logits = ort_session.run(None, ort_inputs)
    masks = masks > 0.5
    print("Inference time: ", time() - start)
    return masks[0], scores[0]


def decode_multi_point_split(payload, ort_session):
    """Runs inference with one foreground point per object.

    Args:
        payload (_type_): _description_
        ort_session (_type_): _description_

    Returns:
        _type_: _description_
    """
    all_masks = []
    all_scores = []
    for index in range(len(payload['input_prompt'])):
        input_label_ = payload['input_label'][index]
        input_point_ = payload['input_prompt'][index]
        single_masks, single_scores = decode_single_point(payload, ort_session, input_point_, input_label_)
        all_masks.append(single_masks)
        all_scores.append(single_scores)
    all_masks = np.stack((all_masks), axis=0)
    all_scores = np.stack((all_scores), axis=0)
    return all_masks, all_scores


def decode_multi_point(payload, ort_session):
    """
    Inference for multiple points on one object.
    Currently only supports foreground points, no background points are accounted for.
    :param predictor: transformed model input data
    :return: list of inference output in NDArray
    """
    start = time()
    resizer = ResizeLongestSide(1024)

    payload_input_point = payload['input_prompt']  # e.g: [[500, 375], [1125, 625]]
    payload_input_label = payload['input_label']  # e.g: [1, 1]
    payload_image_size = payload.get("image_shape")

    input_point = np.array(payload_input_point)
    input_label = np.array(payload_input_label)
    onnx_mask_input = np.zeros((1, 1, 256, 256), dtype=np.float32)

    onnx_coord = np.concatenate([input_point, np.array([[0.0, 0.0]])], axis=0)[None, :, :]
    onnx_label = np.concatenate([input_label, np.array([-1])], axis=0)[None, :].astype(np.float32)
    # onnx_coord = image_embeddings.transform.apply_coords(onnx_coord, image.shape[:2]).astype(np.float32)
    onnx_coord = resizer.apply_coords(onnx_coord, payload_image_size).astype(np.float32)
    onnx_has_mask_input = np.ones(1, dtype=np.float32)

    ort_inputs = {
        "image_embeddings": payload['image_embeddings'],
        "point_coords": onnx_coord,
        "point_labels": onnx_label,
        "mask_input": onnx_mask_input,
        "has_mask_input": onnx_has_mask_input,
        "orig_im_size": np.array(payload_image_size, dtype=np.float32),
    }

    masks, scores, low_res_logits = ort_session.run(None, ort_inputs)
    masks = masks > 0.5  # TODO make this configurable
    print("Inference time: ", time() - start)
    print("XXXXXXX ambiguous mask proposals shape for multi point", masks.shape)
    return masks[0], scores[0]


def masks_to_utf8(masks):
    if isinstance(masks, np.ndarray):
        masks = base64.b64encode(masks.flatten()).decode("utf-8")
    return masks


def mask_to_geojson(mask, scores, payload):
    transform = rasterio.transform.from_bounds(*payload.get("bbox"), mask.shape[1], mask.shape[0])
    all_polygons = []
    for geoshape, value in features.shapes(mask.astype(np.uint8), mask=mask, transform=transform):
        polygon = shape(geoshape)
        all_polygons.append(polygon)
    multi_polygon = MultiPolygon(all_polygons)
    crs_source = CRS(payload.get("crs"))
    crs_target = CRS("EPSG:4326")
    transformer = Transformer.from_crs(crs_source, crs_target, always_xy=True)
    multipolygon_reprojected = ops.transform(transformer.transform, multi_polygon)
    multi_polygon_geojson = mapping(multipolygon_reprojected)
    multi_polygon_geojson['properties'] = {
        "class_label": payload.get('input_label'),
        "confidence_scores": [np_to_py_type(score) for score in scores],
    }
    return json.dumps(multi_polygon_geojson)
