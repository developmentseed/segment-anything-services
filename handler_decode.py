"""Custom TorchServe model handler for SAM encoder model.
"""
from ts.torch_handler.base_handler import BaseHandler
from sam_serve.decode import (
    initialize_decoder,
    prepare_decode_inputs,
    decode_single_point,
    decode_multi_point,
    decode_multi_split,
    mask_to_geojson,
    masks_to_utf8,
)
from sam_serve.utils import np_to_py_type
import numpy as np
import os

np.random.seed(42)
os.environ["PYTHONHASHSEED"] = "42"


class ModelHandler(BaseHandler):
    def __init__(self):
        super().__init__()
        self.ort_session = None
        self.device = None
        self.payload = None

    def initialize(self, context):
        self.ort_session, self.device = initialize_decoder(context)

    def preprocess(self, data):
        return prepare_decode_inputs(data)

    def inference(self, payload):
        if payload["decode_type"] == "single_point":
            return decode_single_point(payload, self.ort_session)
        elif payload["decode_type"] == "multi_point":
            return decode_multi_point(payload, self.ort_session)
        elif payload["decode_type"] == "bbox":
            return decode_multi_split(payload, self.ort_session)

    def handle(self, data, context):
        """
        Invoke by TorchServe for prediction request.
        Do pre-processing of data, prediction using model and postprocessing of prediction output
        :param data: Input data for prediction
        :param context: Initial context contains model server system properties.
        :return: prediction output
        """
        payload = self.preprocess(data)
        # (N,512,512) mask input for single point, ambiguous proposals, highest conf not always best
        masks, scores = self.inference(payload)
        if payload.get("crs") is not None and payload.get("bbox") is not None:
            geojsons = []
            for mask in masks:  # need to clean this up and apply conversion to each ambiguous mask
                multipolygon = mask_to_geojson(mask, scores, payload)
                geojsons.append(multipolygon)
            return [
                {
                    "status": "success",
                    "geojsons": geojsons,
                    "confidence_scores": [np_to_py_type(score) for score in scores],
                }
            ]
        else:
            masks = masks_to_utf8(masks)
            return [
                {"status": "success", "masks": masks, "confidence_scores": [np_to_py_type(score) for score in scores]}
            ]
