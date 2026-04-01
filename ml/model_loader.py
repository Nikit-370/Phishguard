import pickle
from config import MODEL_PATH

def load_model():
    with open(MODEL_PATH, "rb") as f:
        model = pickle.load(f)
    return model
