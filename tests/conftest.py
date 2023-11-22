import pytest
import os
import base64
import numpy as np
from sam_serve import decode

@pytest.fixture(scope="session")
def context_cpu():
    class MockContext:
        def __init__(self, system_properties, manifest):
            self.system_properties = system_properties
            self.manifest = manifest

    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_dir = os.path.join(base_dir, 'models')

    return MockContext(
        system_properties={"model_dir": model_dir, "gpu_id": None},
        manifest={"model": {"serializedFile": "sam_vit_h_decode.onnx"}},
    )
# todo add gpu context no compilation
# todo add gpu compiled with tensorRT
# todo add FastSAM model (vs regular SAM)

@pytest.fixture(scope="session")
def b64_image_payload_for_encoder():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_dir = os.path.join(base_dir, 'data')
    pth_slick = f"{file_dir}/sample_slick.png"
    with open(pth_slick, 'rb') as f:
        byte_string = f.read()
        base64_string = base64.b64encode(byte_string).decode('utf-8')

    payload = {"encoded_image": base64_string}
    return payload


@pytest.fixture(scope="session")
def image_embeddings_as_arr():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    embeds_dir = os.path.join(base_dir, 'data')
    image_embeddings = np.load(f"{embeds_dir}/slick_embeds.npz")['arr']
    return image_embeddings

@pytest.fixture(scope="session")
def image_embeddings_as_str(image_embeddings_as_arr):
    arr_bytes = image_embeddings_as_arr.tobytes()
    arr_base64 = base64.b64encode(arr_bytes)
    return arr_base64.decode('utf-8')

@pytest.fixture(scope="session")
def geo_image_embeddings_as_arr():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    embeds_dir = os.path.join(base_dir, 'data')
    image_embeddings = np.load(f"{embeds_dir}/georef_burn_scar_embeds.npz")['arr_0']
    return image_embeddings

@pytest.fixture(scope="session")
def geo_image_embeddings_as_str(geo_image_embeddings_as_arr):
    arr_bytes = geo_image_embeddings_as_arr.tobytes()
    arr_base64 = base64.b64encode(arr_bytes)
    return arr_base64.decode('utf-8')

@pytest.fixture(scope="session")
def single_point_payload(image_embeddings_as_str):
    input_point_on_slick = (6, 120)
    data = [
        {
            "data": {
                "image_embeddings": image_embeddings_as_str,
                "image_shape": [512, 512],
                "input_prompt": input_point_on_slick,
                "input_label": 1,
                "decode_type": "single_point",
            }
        }
    ]

    # this shape is needed because decoder expects it, see
    # https://github.com/facebookresearch/segment-anything/blob/6fdee8f2727f4506cfbbe553e23b895e27956588/segment_anything/predictor.py#L245
    payload = decode.prepare_decode_inputs(data)
    return payload

@pytest.fixture(scope="session")
def multi_point_payload(image_embeddings_as_str):
    input_points_on_slick = [(6, 120), (7,120)]
    data = [
        {
            "data": {
                "image_embeddings": image_embeddings_as_str,
                "image_shape": [512, 512],
                "input_prompt": input_points_on_slick,
                "input_label": [1,1],
                "decode_type": "single_point",
            }
        }
    ]

    payload = decode.prepare_decode_inputs(data)
    return payload

# @pytest.fixture(scope="session")
# def multi_point_split_payload(image_embeddings_as_str):
#     input_points_on_slick = [(6, 120), (7, 120)]
#     data = [
#         {
#             "data": {
#                 "image_embeddings": image_embeddings_as_str,
#                 "image_shape": [512, 512],
#                 "input_prompt": input_points_on_slick,
#                 "input_label": 1,
#                 "decode_type": "single_point",
#             }
#         }
#     ]
#     payload = decode.prepare_decode_inputs(data)
#     return payload

@pytest.fixture(scope="session")
def geojsons_and_scores(geo_image_embeddings_as_str, ort_device):
    input_point_on_burn = (220, 120)
    data = [
        {
            "data": {
                "image_embeddings": geo_image_embeddings_as_str,
                "image_shape": [512, 512],
                "input_label": 1,
                "input_prompt": input_point_on_burn,
                "decode_type": "single_point",
                "crs": 'EPSG:32610',
                "bbox": [593640.0, 4331790.0, 609000.0, 4347150.0],
            }
        }
    ]

    # this shape is needed because decoder expects it, see
    # https://github.com/facebookresearch/segment-anything/blob/6fdee8f2727f4506cfbbe553e23b895e27956588/segment_anything/predictor.py#L245
    single_point_payload = decode.prepare_decode_inputs(data)
    ort_session, _ =  ort_device
    masks, scores = decode.decode_single_point(single_point_payload, ort_session, single_point_payload['input_prompt'], single_point_payload['input_label'])
    geojsons = []
    for mask in masks:
        multipolygon = decode.mask_to_geojson(mask, scores, single_point_payload)
        geojsons.append(multipolygon)
    return geojsons, scores
