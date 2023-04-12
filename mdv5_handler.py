"""Custom TorchServe model handler for YOLOv5 models.
"""
from ts.torch_handler.base_handler import BaseHandler
import numpy as np
import cv2
import base64
import torch
import onnxruntime as ort
import io
import torchvision
import torch
from PIL import Image
from io import BytesIO
from typing import Union
import os
from time import time
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

    img_size = (960,1280)
    min_conf_thresh = 0.0005
    """Image size (px). Images will be resized to this resolution before inference.
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
        # load images
        # taken from https://github.com/pytorch/serve/blob/master/ts/torch_handler/vision_handler.py
        
        # handle if images are given in base64, etc.
        row = data[0]
        # Compat layer: normally the envelope should just return the data
        # directly, but older versions of Torchserve didn't have envelope.
        image = row.get("data") or row.get("body")
        if isinstance(image, str):
            # if the image is a string of bytesarray.
            image = base64.b64decode(image)
        if isinstance(image, (bytearray, bytes)):
            # If the image is sent as bytesarray
            image = load_image(io.BytesIO(image))
        else:
            print("not a bytearray")
            assert False
        # force convert to tensor
        # and resize to [img_size, img_size]
        image = np.asarray(image)
        print("Image.shape: ", image.shape)
        self.original_img_shape = image.shape
        image, self.ratio, self.dw_dh = letterbox(image, new_shape=self.img_size,
                    stride=64, scaleup=False, auto=False)  # JIT requires auto=False\
        self.letterbox_shape = image.shape
        print("Letterbox shape: ", self.letterbox_shape)
        image = image.transpose((2, 0, 1))  # HWC to CHW; PIL Image is RGB already
        image = np.ascontiguousarray(image)
        image = torch.from_numpy(image)
        image = image.to(self.device)
        image = image.float()
        image /= 255
        image = torch.unsqueeze(image, 0)
        print("XXXXX  Preprocess time: ", time()-start)
        # has shape BATCH_SIZE=1 x 3 x IMG_SIZE x IMG_SIZE
        return image

    def initialize(self, context):
        """
        Invoke by torchserve for loading a model
        :param context: context contains model server system properties
        :return:
        """
        start = time()
        #  load the model
        self.manifest = context.manifest
        properties = context.system_properties
        model_dir = properties.get("model_dir")
        self.device = torch.device("cuda:" + str(properties.get("gpu_id")) if torch.cuda.is_available() else "cpu")
        # Read onnx file
        serialized_file = self.manifest['model']['serializedFile']
        model_path = os.path.join(model_dir, serialized_file)
        # Model
        self.ort_session = ort.InferenceSession(model_path)
        self.initialized = True
        print("XXXXX  Initialization time: ", time()-start)

    def inference(self, model_input):
        """
        Internal inference methods
        :param model_input: transformed model input data
        :return: list of inference output in NDArray
        """
        start = time()
        # Do some inference call to engine here and return output
        model_output = self.ort_session.run(
                        None,
                        {"images": model_input.numpy().astype(np.float32)},
                    )
        print("XXXXX  Inference time: ", time()-start)
        print(len(model_output))
        print(type(model_output))
        return torch.Tensor(model_output)
    
    def handle(self, data, context):
        """
        Invoke by TorchServe for prediction request.
        Do pre-processing of data, prediction using model and postprocessing of prediction output
        :param data: Input data for prediction
        :param context: Initial context contains model server system properties.
        :return: prediction output
        """
        model_input = self.preprocess(data)
        model_output = self.inference(model_input)
        return model_output

def letterbox(im, new_shape=(640, 640), color=(114, 114, 114), auto=True, scaleFill=False, scaleup=True, stride=32):
    # Resize and pad image while meeting stride-multiple constraints
    shape = im.shape[:2]  # current shape [height, width]
    if isinstance(new_shape, int):
        new_shape = (new_shape, new_shape)

    # Scale ratio (new / old)
    r = min(new_shape[0] / shape[0], new_shape[1] / shape[1])
    if not scaleup:  # only scale down, do not scale up (for better val mAP)
        r = min(r, 1.0)
    # Compute padding
    ratio = r, r  # width, height ratios
    new_unpad = int(round(shape[1] * r)), int(round(shape[0] * r))
    dw, dh = new_shape[1] - new_unpad[0], new_shape[0] - new_unpad[1]  # wh padding
    if auto:  # minimum rectangle
        dw, dh = np.mod(dw, stride), np.mod(dh, stride)  # wh padding
    elif scaleFill:  # stretch
        dw, dh = 0.0, 0.0
        new_unpad = (new_shape[1], new_shape[0])
        ratio = new_shape[1] / shape[1], new_shape[0] / shape[0]  # width, height ratios

    dw /= 2  # divide padding into 2 sides
    dh /= 2
    if shape[::-1] != new_unpad:  # resize
        im = cv2.resize(im, new_unpad, interpolation=cv2.INTER_LINEAR)
    top, bottom = int(round(dh - 0.1)), int(round(dh + 0.1))
    left, right = int(round(dw - 0.1)), int(round(dw + 0.1))
    im = cv2.copyMakeBorder(im, top, bottom, left, right, cv2.BORDER_CONSTANT, value=color)  # add border
    return im, ratio, (dw, dh)

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