import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

SECRET_KEY = "change-this-secret-key"

MODEL_PATH = os.path.join(BASE_DIR, "model", "phishing_model.pkl")

LOG_FILE = os.path.join(BASE_DIR, "logs", "app.log")

MAX_URL_LENGTH = 2000
