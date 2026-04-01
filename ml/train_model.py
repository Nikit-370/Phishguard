import os
import sys
import pickle
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

# --------------------------------------------------
# Fix Python path (important for Windows)
# --------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(BASE_DIR)

from ml.features import extract_features

# --------------------------------------------------
# Paths
# --------------------------------------------------
DATASET_DIR = os.path.join(BASE_DIR, "dataset")
MODEL_DIR = os.path.join(BASE_DIR, "model")
MODEL_PATH = os.path.join(MODEL_DIR, "phishing_model.pkl")

# --------------------------------------------------
# Find dataset file automatically
# --------------------------------------------------
dataset_file = None
for file in os.listdir(DATASET_DIR):
    if file.endswith(".csv") or file.endswith(".xlsx"):
        dataset_file = os.path.join(DATASET_DIR, file)
        break

if dataset_file is None:
    raise FileNotFoundError("❌ No CSV or XLSX dataset found in dataset/ folder")

print(f"✅ Using dataset: {os.path.basename(dataset_file)}")

# --------------------------------------------------
# Load dataset safely
# --------------------------------------------------
if dataset_file.endswith(".csv"):
    try:
        df = pd.read_csv(dataset_file, encoding="utf-8")
    except UnicodeDecodeError:
        df = pd.read_csv(dataset_file, encoding="latin1")
else:
    df = pd.read_excel(dataset_file)

print("📌 Dataset columns:", df.columns.tolist())

# --------------------------------------------------
# Auto-detect URL column
# --------------------------------------------------
url_column_candidates = ["url", "URL", "website", "Website", "domain", "Domain"]
url_column = None

for col in url_column_candidates:
    if col in df.columns:
        url_column = col
        break

if url_column is None:
    raise KeyError("❌ No URL column found (expected: url / URL / website / domain)")

print(f"✅ URL column detected: {url_column}")

# --------------------------------------------------
# Auto-detect label column
# --------------------------------------------------
label_column_candidates = [
    "label", "Label",
    "result", "Result",
    "class", "Class",
    "ClassLabel", "classlabel"
]
label_column = None

for col in label_column_candidates:
    if col in df.columns:
        label_column = col
        break

if label_column is None:
    raise KeyError("❌ No label column found (expected: label / Result / class)")

print(f"✅ Label column detected: {label_column}")

# --------------------------------------------------
# Prepare training data
# --------------------------------------------------
X = []
y = []

for _, row in df.iterrows():
    url = str(row[url_column]).strip()
    label = row[label_column]

    # Skip invalid rows
    if not url or pd.isna(label):
        continue

    features, _ = extract_features(url)
    X.append(features)
    y.append(int(label))

print(f"📊 Total samples used: {len(X)}")

# --------------------------------------------------
# Train-test split
# --------------------------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# --------------------------------------------------
# Train model
# --------------------------------------------------
model = RandomForestClassifier(
    n_estimators=150,
    random_state=42,
    n_jobs=-1
)

model.fit(X_train, y_train)

# --------------------------------------------------
# Evaluate model
# --------------------------------------------------
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

print(f"🎯 Model Accuracy: {accuracy * 100:.2f}%")

# --------------------------------------------------
# Save model
# --------------------------------------------------
os.makedirs(MODEL_DIR, exist_ok=True)

with open(MODEL_PATH, "wb") as f:
    pickle.dump(model, f)

print(f"💾 Model saved at: {MODEL_PATH}")
print("✅ Training completed successfully")
