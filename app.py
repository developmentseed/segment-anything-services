import streamlit as st
import pandas as pd
import numpy as np
import cv2
import numpy as np
import matplotlib.pyplot as plt
import torch
from PIL import Image
from segment_anything import build_sam_vit_b, SamPredictor, sam_model_registry
from streamlit_image_coordinates import streamlit_image_coordinates
from pathlib import Path
import requests
from io import BytesIO
import mercantile

# pass in the model checkpoint and model type
SAM_CHECKPOINT = "notebooks/model-weights/sam_vit_b_01ec64.pth"
MODEL_TYPE = "vit_b"


Path("inference/chip").mkdir(exist_ok=True, parents=True)
URL_SENTINEL = "https://planetarycomputer.microsoft.com/api/data/v1/mosaic/tiles/2849689f57f1b3b9c1f725abb75aa411/{z}/{x}/{y}@{scale}x"
URL_NAIP = "https://planetarycomputer.microsoft.com/api/data/v1/mosaic/tiles/87b72c66331e136e088004fba817e3e8/{z}/{x}/{y}@{scale}x"

params_sentinel = {
    "collection": "sentinel-2-l2a",
    "assets": ["B04", "B03", "B02"],
    "rescale": "0,10000",
    "return_mask": False,
    # "buffer": 64,
    "format": "npy",
}

params_naip = {
    "collection": "naip",
    "assets": "image",
    "asset_bidx": "image|1,2,3",
    "format": "npy",
}


def show_mask(mask, ax, random_color=False):
    if random_color:
        color = np.concatenate([np.random.random(3), np.array([0.6])], axis=0)
    else:
        color = np.array([255 / 255, 144 / 255, 30 / 255, 0.6])
    h, w = mask.shape[-2:]
    mask_image = mask.reshape(h, w, 1) * color.reshape(1, 1, -1)
    ax.imshow(mask_image)


def show_points(coords, labels, ax, marker_size=50):
    pos_points = coords[labels == 1]
    neg_points = coords[labels == 0]
    ax.scatter(
        pos_points[:, 0],
        pos_points[:, 1],
        color="green",
        marker=".",
        s=marker_size,
        edgecolor="white",
        linewidth=1.25,
    )
    ax.scatter(
        neg_points[:, 0],
        neg_points[:, 1],
        color="red",
        marker="*",
        s=marker_size,
        edgecolor="white",
        linewidth=1.25,
    )


def show_box(box, ax):
    x0, y0 = box[0], box[1]
    w, h = box[2] - box[0], box[3] - box[1]
    ax.add_patch(
        plt.Rectangle((x0, y0), w, h, edgecolor="green", facecolor=(0, 0, 0, 0), lw=2)
    )


st.set_page_config(layout="wide")
st.title("Segment Anything Model - FAIR for Satellite data")


# Sidebar
with st.sidebar:
    imagery = st.selectbox(
        "Select an imagery?",
        ("NAIP", "Sentinel-2"),
    )
    imagery_type = st.selectbox(
        "Select imagery type?",
        ("true-color", "false-color"),
    )
    lng = st.text_input("Longitude", "-76.15")
    lat = st.text_input("Latitude", "43.20")
    zoom = st.slider("Zoom", 10, 12, 11)

lng = float(lng)
lat = float(lat)
zoom = int(zoom)
scale = 2

if imagery == "NAIP":
    URL = URL_NAIP
    params = params_naip
    if imagery_type == "false-color":
        params["asset_bidx"] = "image|4,1,2"
else:
    URL = URL_SENTINEL
    params = params_sentinel
    if imagery_type == "false-color":
        params["assets"] = ["B08", "B04", "B03"]

x, y, z = mercantile.tile(lng, lat, zoom)

st.write("Imagery:", imagery)
st.write(f"lng: {lng}, lat: {lat}, zoom: {zoom}")


# Load model
@st.cache_resource
def load_model():
    sam_checkpoint = SAM_CHECKPOINT
    model_type = MODEL_TYPE
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    sam = sam_model_registry[model_type](checkpoint=sam_checkpoint)
    sam.to(device=device)
    return sam


@st.cache_data
def download_tile(slippy, imagery_type="true-color"):
    (x, y, z), scale, size = slippy

    # download chip
    url = URL.format(z=z, x=x, y=y, scale=scale)
    r = requests.get(url, params=params)

    # save npy array
    chip = np.load(BytesIO(r.content))
    np.save(f"inference/chip/{x}-{y}-{z}.npy", chip)
    chip = chip.transpose(1, 2, 0)

    print(url, r.status_code, chip.shape)
    cv2.imwrite(f"inference/chip/{x}-{y}-{z}.png", chip[..., :3])


@st.cache_resource
def run_encoder(img_path):
    predictor = SamPredictor(model)
    predictor.set_image(img)
    return predictor


# add widget to show download progress
download_tile(((x, y, z), scale, 512), imagery_type=imagery_type)
model = load_model()

img_path = f"inference/chip/{x}-{y}-{z}.png"
img = cv2.imread(img_path)
img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

predictor = run_encoder(img_path)

coords = streamlit_image_coordinates(img_path)
st.write(coords)
if coords is not None:
    x, y = coords["x"], coords["y"]
    input_point = np.array([[x, y]])
    input_label = np.array([1])

    masks, scores, logits = predictor.predict(
        point_coords=input_point,
        point_labels=input_label,
        multimask_output=True,
    )

    fig, ax = plt.subplots(1, 3, figsize=(15, 5))
    for i, (mask, score, axis) in enumerate(zip(masks, scores, ax.flatten())):
        axis.imshow(img)
        show_mask(mask, axis)
        show_points(input_point, input_label, axis)
        axis.get_xaxis().set_visible(False)
        axis.get_yaxis().set_visible(False)
        axis.set_title(f"Mask {i+1}, Score: {score:.3f}", fontsize=10)

    st.pyplot(fig)
