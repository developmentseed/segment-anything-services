import numpy as np
import base64

# Step 1: Decode the base64 string to bytes
decoded_bytes = base64.b64decode(encoded_embedding_string) #from the torchserve service and the test data for the burn scar

# Step 2: Convert the bytes back to a numpy array
# Note: You need to know the original dtype of the numpy array, which seems to be float32 based on your previous message
decoded_array = np.frombuffer(decoded_bytes, dtype=np.float32)

# Step 3: Save the numpy array to a .npz file
np.savez('../tests/data/georef_burn_scar_embeds.npz', decoded_array)