"""Custom TorchServe model handler for SAM encoder model.
"""
from ts.torch_handler.base_handler import BaseHandler
import numpy as np
import base64
import torch
import io
import torchvision
import torch
from PIL import Image
from io import BytesIO
from typing import Union
import os
from time import time
from ts.utils.util import PredictionException
from segment_anything import sam_model_registry, SamPredictor
# import ptvsd

# ptvsd.enable_attach(address=('0.0.0.0', 6789), redirect_output=True)
# ptvsd.wait_for_attach()
np.random.seed(42)
torch.manual_seed(42)
os.environ["PYTHONHASHSEED"] = "42"
torch.backends.cudnn.deterministic = True
torch.backends.cudnn.benchmark = False
torch.set_num_threads(1)

class ModelHandler(BaseHandler):
    """
    A custom model handler implementation.
    """

    def __init__(self):
        # call superclass initializer
        super().__init__()

    def preprocess(self, data):
        """Converts input images to float tensors.
        Args:
            data (List): Input data from the request in the form of a list of image tensors.
        Returns:
            Tensor: single Tensor of shape [BATCH_SIZE=1, 3, IMG_SIZE, IMG_SIZE]
        """
        start = time()
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
        print(f"XXXXX  Preprocess time and shape {image.shape}: ", time()-start)
        return image

    def initialize(self, context):
        """
        Invoke by torchserve for loading a model
        :param context: context contains model server system properties
        :return:
        """
        start = time()
        properties = context.system_properties
        model_dir = properties.get("model_dir")
        # gpu_id is None if number_of_gpu=0 set in config.properties
        self.device = torch.device("cuda:" + str(properties.get("gpu_id")) if torch.cuda.is_available() and str(properties.get("gpu_id")) != "None"  else "cpu")
        serialized_file = context.manifest['model']['serializedFile']
        model_path = os.path.join(model_dir, serialized_file)
        sam = sam_model_registry["default"](checkpoint=model_path)
        sam.to(device=self.device)
        self.predictor = SamPredictor(sam)
        self.initialized = True
        print("XXXXX  Initialization time: ", time()-start)

    def inference(self, image):
        """
        Internal inference methods
        :param model_input: transformed model input data
        :return: list of inference output in NDArray
        """
        start = time()
        # Do some inference call to engine here and return output
        self.predictor.set_image(image)
        image_embedding = self.predictor.get_image_embedding().cpu().numpy()
        print("XXXXX  Inference time: ", time()-start)
        return image_embedding
    
    def postprocess(self, inference_output):
        base64_encoded_embedding = base64.b64encode(inference_output.flatten()).decode("utf-8")
        return [{"status": "success", "image_embedding": base64_encoded_embedding}]
    
    def handle(self, data, context):
        """
        Invoke by TorchServe for prediction request.
        Do pre-processing of data, prediction using model and postprocessing of prediciton output
        :param data: Input data for prediction
        :param context: Initial context contains model server system properties.
        :return: prediction output
        """
        model_input = self.preprocess(data)
        # im shape order is channel last
        if model_input.shape[0] * model_input.shape[1] > 2048*2048:
            raise PredictionException(f"Image size {model_input.shape} exceeded the 2048x2048 input size limit. Tile your image and submit tiles individually or resize the image to a smaller size.")
        model_output = self.inference(model_input)
        return self.postprocess(model_output)


def open_image(input_file: Union[str, BytesIO]) -> Image:
    """
    Opens an image in binary format using PIL.Image and converts to RGB mode.
    
    Supports local files or URLs.
    This operation is lazy; image will not be actually loaded until the first
    operation that needs to load it (for example, resizing), so file opening
    errors can show up later.
    Args:
        input_file: str or BytesIO, either a path to an image file (anything
            that PIL can open), or an image as a stream of bytes
    Returns:
        an PIL image object in RGB mode
    """
    n_retries = 10
    retry_sleep_time = 0.01
    error_names_for_retry = ['ConnectionError']
    if (isinstance(input_file, str)
            and input_file.startswith(('http://', 'https://'))):
        try:
            response = requests.get(input_file)
        except Exception as e:
            print(f'Error retrieving image {input_file}: {e}')
            success = False
            if e.__class__.__name__ in error_names_for_retry:
                for i_retry in range(0,n_retries):
                    try:
                        time.sleep(retry_sleep_time)
                        response = requests.get(input_file)        
                    except Exception as e:
                        print(f'Error retrieving image {input_file} on retry {i_retry}: {e}')
                        continue
                    print('Succeeded on retry {}'.format(i_retry))
                    success = True
                    break
            if not success:
                raise
        try:
            image = Image.open(BytesIO(response.content))
        except Exception as e:
            print(f'Error opening image {input_file}: {e}')
            raise
    else:
        print("trying to open image")
        image = Image.open(input_file)
    if image.mode not in ('RGBA', 'RGB', 'L', 'I;16'):
        raise AttributeError(
            f'Image {input_file} uses unsupported mode {image.mode}')
    if image.mode == 'RGBA' or image.mode == 'L':
        print("trying to convert image")
        # PIL.Image.convert() returns a converted copy of this image
        image = image.convert(mode='RGB')

    # Alter orientation as needed according to EXIF tag 0x112 (274) for Orientation
    #
    # https://gist.github.com/dangtrinhnt/a577ece4cbe5364aad28
    # https://www.media.mit.edu/pia/Research/deepview/exif.html
    #
    try:
        exif = image._getexif()
        orientation: int = exif.get(274, None)  # 274 is the key for the Orientation field
        if orientation is not None and orientation in IMAGE_ROTATIONS:
            image = image.rotate(IMAGE_ROTATIONS[orientation], expand=True)  # returns a rotated copy
    except Exception:
        pass
    return image


def load_image(input_file: Union[str, BytesIO]) -> Image:
    """
    Loads the image at input_file as a PIL Image into memory.
    Image.open() used in open_image() is lazy and errors will occur downstream
    if not explicitly loaded.
    Args:
        input_file: str or BytesIO, either a path to an image file (anything
            that PIL can open), or an image as a stream of bytes
    Returns: PIL.Image.Image, in RGB mode
    """
    image = open_image(input_file)
    image.load()
    return image