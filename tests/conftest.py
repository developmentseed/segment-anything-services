import pytest
import os


@pytest.fixture
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
