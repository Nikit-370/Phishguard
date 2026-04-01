import os
import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
from ml.features import extract_features

def detect_columns(df):
    cols = list(df.columns)
    url_candidates = [c for c in cols if 'url' in c.lower() or 'link' in c.lower() or 'uri' in c.lower()]
    url_col = url_candidates[0] if url_candidates else cols[0]
    label_candidates = [c for c in cols if c.lower() in ('label','class','target','type','status','classlabel','class_label')]
    label_col = label_candidates[0] if label_candidates else None
    if label_col is None:
        possible = [c for c in cols if c != url_col]
        for c in possible:
            if df[c].nunique(dropna=False) <= 50:
                label_col = c
                break
    if label_col is None:
        raise ValueError('Could not detect label column')
    return url_col, label_col

def normalize_labels(s):
    s2 = s.dropna()
    unique = set(s2.astype(str).str.lower().unique())
    if unique <= {'0','1'} or set(s2.unique()) <= {0,1}:
        return s.map({0:'legitimate',1:'phishing'}).astype(str).values
    low = s.astype(str).str.lower()
    return np.where(low.str.contains('phish'), 'phishing', 'legitimate')

def build_features(urls):
    feats = [extract_features(u) for u in urls]
    keys = list(feats[0].keys())
    X = np.array([[f[k] for k in keys] for f in feats])
    return X, keys

def main():
    DATA_PATH = os.environ.get('TRAINING_DATA') or os.path.join('..','data','url_data.csv')
    if not os.path.exists(DATA_PATH):
        print('Training file not found at', DATA_PATH); return
    if DATA_PATH.lower().endswith(('.xls','.xlsx')):
        df = pd.read_excel(DATA_PATH)
    else:
        df = pd.read_csv(DATA_PATH)
    url_col, label_col = detect_columns(df)
    print('Using', url_col, 'as URL column and', label_col, 'as label')
    df = df[[url_col,label_col]].dropna()
    df.columns = ['url','label']
    y = normalize_labels(df['label'])
    urls = df['url'].tolist()
    X, keys = build_features(urls)

    clf = RandomForestClassifier(n_estimators=100, max_depth=20, random_state=42, n_jobs=1)
    clf.fit(X, y)

    preds = clf.predict(X)
    print(classification_report(y, preds))

    MODEL_DIR = os.path.join(os.path.dirname(__file__), '..', 'model')
    os.makedirs(MODEL_DIR, exist_ok=True)
    MODEL_PATH = os.path.join(MODEL_DIR, 'model.pkl')
    joblib.dump({'model':clf, 'features': keys}, MODEL_PATH)
    print('Model saved to', MODEL_PATH)

if __name__ == '__main__':
    main()
