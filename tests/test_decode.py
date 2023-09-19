from sam_serve import decode  # Adjust the import based on your actual module structure
import numpy as np


# Test for initialize_decoder function
def test_initialize_decoder(context_cpu):
    ort_session, device = decode.initialize_decoder(context_cpu)
    assert str(device) == "cpu"  # Adjust based on your expectations


# Test for prepare_decode_inputs function
def test_prepare_decode_inputs():
    data = [
        {
            "data": {
                "image_embeddings": "test_image_embeddings",
                "image_shape": [1, 1],
                "input_prompt": [0, 0],
                "input_label": 1,
                "decode_type": "test_decode_type",
            }
        }
    ]
    payload = "your_payload_here"

    image_embeddings, payload = decode.prepare_decode_inputs(data, payload)
    assert image_embeddings.shape == (1, 256, 64, 64)  # Adjust based on your expectations


# Test for decode_single_point function
def test_decode_single_point():
    image_embeddings = np.zeros((1, 256, 64, 64))
    payload = {
        "input_prompt": [0, 0],
        "input_label": 1,
        "image_shape": [1, 1],
        "bbox": [0, 0, 1, 1],
        "crs": "EPSG:4326",
    }
    ort_session = "your_ort_session_here"  # You would mock or initialize an actual ort_session here

    masks, scores = decode.decode_single_point(image_embeddings, payload, ort_session)
    assert masks.shape == (1, 1)  # Adjust based on your expectations


# Test for mask_to_geojson function
def test_mask_to_geojson():
    mask = np.array([[1, 1], [0, 0]])
    scores = [0.9]
    payload = {"bbox": [0, 0, 1, 1], "crs": "EPSG:4326", "input_label": 1}

    geojson_output = decode.mask_to_geojson(mask, scores, payload)
    expected_output = '{"type": "Feature", "geometry": {"type": "MultiPolygon", "coordinates": [[[0.0, 0.0, 1.0, 1.0, 0.0, 0.0]]]}, "properties": {"class_label": 1, "confidence_scores": [0.9]}}'
    assert geojson_output == expected_output  # Adjust based on your expectations
