from ts.torch_handler.base_handler import BaseHandler
from sam_serve.encode import initialize_model, request_to_arr, get_embedding, embedding_to_response, check_image_size
from sam_serve.utils import initialize_environment
class ModelHandler(BaseHandler):
    def __init__(self):
        super().__init__()
        initialize_environment()
        self.predictor = None

    def preprocess(self, data):
        return request_to_arr(data)

    def initialize(self, context):
        self.predictor = initialize_model(context)

    def inference(self, image):
        check_image_size(image)
        return get_embedding(self.predictor, image)

    def postprocess(self, inference_output):
        return embedding_to_response(inference_output)