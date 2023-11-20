from sam_serve import decode  # Adjust the import based on your actual module structure
import pytest
import json
import os

# Test for initialize_decoder function
@pytest.fixture(scope="session")
def ort_device(context_cpu):
    ort_session, device = decode.initialize_decoder(context_cpu)
    return ort_session, device

def test_initialize_decoder(ort_device):
    assert str(ort_device[1]) == "cpu"


# Test for prepare_decode_inputs function
def test_prepare_decode_inputs(single_point_payload):
    assert single_point_payload['image_embeddings'].shape == (1, 256, 64, 64)


# Test for decode_single_point function
def test_decode_single_point(single_point_payload, ort_device):
    ort_session, _ =  ort_device
    masks, scores = decode.decode_single_point(single_point_payload, ort_session, single_point_payload['input_prompt'], single_point_payload['input_label'])
    # the decoder was converted to onnx with return_single_mask=False see the scripts/export_onnx_model.py
    # see https://arxiv.org/pdf/2304.02643.pdf for details
    # this means there will always be 4 mask predictions so shape is 4
    assert masks.shape == (4, 512, 512)

# Test for decode_single_point function
def test_decode_multi_point(multi_point_payload, ort_device):
    ort_session, _ =  ort_device
    masks, scores = decode.decode_multi_point(multi_point_payload, ort_session)
    assert masks.shape == (4, 512, 512)

# Test for decode_single_point function
def test_decode_multi_point_split(multi_point_payload, ort_device):
    ort_session, _ =  ort_device
    masks, scores = decode.decode_multi_point_split(multi_point_payload, ort_session)
    assert masks.shape == (2, 4, 512, 512)

# Test for mask_to_geojson function
def test_handle_mask_to_geojson(geojsons_and_scores):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_dir = os.path.join(base_dir, 'data')
    def load_geojson(file_path):
        with open(file_path, 'r') as f:
            return json.load(f)

    # Load saved GeoJSONs of SAM inferences for the burn scar
    saved_geojsons = [load_geojson(f'{file_dir}/geojson_{idx}.json') for idx in range(len(geojsons_and_scores[0]))]

    # Check for equality
    for idx, (saved_geojson, geojson_to_check) in enumerate(zip(saved_geojsons, geojsons_and_scores[0])):
        assert saved_geojson == json.loads(geojson_to_check)
