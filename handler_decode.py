"""Custom TorchServe model handler for SAM encoder model.
"""
from ts.torch_handler.base_handler import BaseHandler
import numpy as np
import base64
import torch
from PIL import Image
from io import BytesIO
from typing import Union
import os
from time import time
from segment_anything.utils.transforms import ResizeLongestSide
import onnxruntime
import rasterio
from pyproj import CRS, Transformer
from shapely import ops
from shapely.geometry import mapping, shape, MultiPolygon
from rasterio import features
# import ptvsd

# ptvsd.enable_attach(address=('0.0.0.0', 6789), redirect_output=True)
# ptvsd.wait_for_attach()
np.random.seed(42)
os.environ["PYTHONHASHSEED"] = "42"

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
        self.payload = row.get("data") or row.get("body")
        if isinstance(self.payload, dict) and "image_embeddings" in self.payload \
            and "image_shape" in self.payload \
            and "input_point" in self.payload \
            and "input_label" in self.payload:
            image_embeddings = self.payload['image_embeddings']
        else:
            print("one of image_shape, input_point, input_label, image_embeddings payload dict keys missing.")
            assert False
        if isinstance(image_embeddings, str):
            image_embeddings = base64.b64decode(image_embeddings)
        image_embeddings = np.frombuffer(image_embeddings, dtype=np.float32)
        image_embeddings = image_embeddings.reshape((1,256,64,64))
        print("XXXXX  Preprocess time: ", time()-start)
        return image_embeddings

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
        self.device = torch.device("cuda:" + str(properties.get("gpu_id")) if torch.cuda.is_available()  and str(properties.get("gpu_id")) != "None" else "cpu")
        serialized_file = context.manifest['model']['serializedFile']
        onnx_model_path = os.path.join(model_dir, serialized_file)
        self.ort_session = onnxruntime.InferenceSession(onnx_model_path)
        self.initialized = True
        print("XXXXX  Initialization time: ", time()-start)

    def inference_single_point(self, image_embeddings):
        """
        Internal inference methods
        :param model_input: transformed model input data
        :return: list of inference output in NDArray
        """
        start = time()
        resizer = ResizeLongestSide(1024) # 1024 is the max for the export onnx example nb
        onnx_coord = np.concatenate([np.array(self.payload['input_point'])[np.newaxis,:], np.array([[0.0, 0.0]])], axis=0)[None, :, :]
        onnx_label = np.concatenate([np.array([self.payload['input_label']]), np.array([-1])], axis=0)[None, :].astype(np.float32)
        onnx_coord = resizer.apply_coords(onnx_coord, self.payload.get("image_shape")).astype(np.float32)
        onnx_mask_input = np.zeros((1, 1, 256, 256), dtype=np.float32)
        onnx_has_mask_input = np.zeros(1, dtype=np.float32)
        ort_inputs = {
            "image_embeddings": image_embeddings,
            "point_coords": onnx_coord,
            "point_labels": onnx_label,
            "mask_input": onnx_mask_input,
            "has_mask_input": onnx_has_mask_input,
            "orig_im_size": np.array(self.payload.get("image_shape"), dtype=np.float32)
        }
        masks, scores, low_res_logits = self.ort_session.run(None, ort_inputs)
        masks = masks > .5 # TODO make this configurable
        print("XXXXX  Inference time: ", time()-start)
        print("XXXXXXX ambiguous mask proposals shape for single point", masks.shape) #(512,512) for single point mask
        return masks, scores[0]
    
    def mask_to_geojson(self, mask, scores):
        transform = rasterio.transform.from_bounds(*self.payload.get("bbox"), mask.shape[2], mask.shape[1])
        # A list to store all features
        all_polygons = []

        # Generate shapes from each mask
        for geoshape, value in features.shapes(mask.astype(np.uint8), mask=mask, transform=transform):
            # Convert each shape to GeoJSON
            polygon = shape(geoshape)
            all_polygons.append(polygon)

        # Merge all polygons into a single MultiPolygon
        multi_polygon = MultiPolygon(all_polygons)
        # Define the source CRS
        crs_source = CRS(self.payload.get("crs"))
        # Define the target CRS
        crs_target = CRS("EPSG:4326")
        # Initialize the transformer
        transformer = Transformer.from_crs(crs_source, crs_target, always_xy=True)
        # Reproject all polygons
        multipolygon_reprojected = ops.transform(transformer.transform, multi_polygon)
        multi_polygon_geojson = mapping(multipolygon_reprojected)
        multi_polygon_geojson['properties'] = {"class_label": self.payload.get('input_label'), 
                                               "confidence_scores": scores}
        return multi_polygon_geojson

    def postprocess(self, masks):
        if isinstance(masks, np.ndarray):
            # it's not georeferenced, we encode the np array. otherwise it's a geojson
            masks = base64.b64encode(masks.flatten()).decode("utf-8")
        return masks
    
    def handle(self, data, context):
        """
        Invoke by TorchServe for prediction request.
        Do pre-processing of data, prediction using model and postprocessing of prediciton output
        :param data: Input data for prediction
        :param context: Initial context contains model server system properties.
        :return: prediction output
        """
        model_input = self.preprocess(data)
        # (N,512,512) mask input for single point, ambiguous proposals, highest conf not always best
        model_output, scores = self.inference_single_point(model_input)
        if self.payload.get("crs") is not None and self.payload.get("bbox") is not None:
            for mask in model_output[0]:# need to clean this up and apply conversion to each ambiguous mask
                model_output = self.mask_to_geojson(mask, scores)
        masks = self.postprocess(model_output)
        return [{"status": "success", "masks": masks, "confidence_scores": [np_to_py_type(score) for score in scores]}]

def np_to_py_type(o):
    if isinstance(o, np.generic):
        return o.item()  
    raise TypeError

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