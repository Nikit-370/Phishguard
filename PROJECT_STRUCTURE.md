# 📁 PhishGuard Project Structure

This file provides a concise map of the repository and the purpose of key files and folders. The layout below matches the actual code in the repository.

**← [Back to README](README.md) | [API Docs](docs/API.md) | [Setup Guide](docs/SETUP.md)**

---

## Root (selected files)

```
Phishing URL Detection/
├── app.py                                  # Main Flask application (API routes + web views)
├── config.py                               # Optional configuration helpers
├── requirements.txt                        # Exact Python packages used by the project
├── README.md                               # Install/run instructions
├── PROJECT_STRUCTURE.md                    # Overview of repository layout
└── vercel.json                             # Vercel deployment configuration
```

---

## API (/api)

```
api/
└── index.py                # Vercel API endpoint handler
```

---

## Documentation (/docs)

```
docs/
├── API.md                  # API reference for endpoints: auth, detect, history, admin
└── SETUP.md                # Setup & deployment instructions
```

---

## Machine Learning (/ml)

```
ml/
├── features.py             # Feature extraction for URLs (used by training and detection)
├── train_model.py          # Training script: reads dataset/*, trains RandomForest, writes model/phishing_model.pkl
├── quick_train.py          # Smaller utility for quick iterations
└── model_loader.py         # (if present) helper for loading models safely
```

Notes: training writes `model/phishing_model.pkl` by default. Training auto-detects URL and label columns in the dataset CSV/XLSX.

---

## Utilities (/utils)

```
utils/
├── database.py             # SQLAlchemy models and DB init (User, URLCheck, SystemLog)
├── security.py             # Input sanitization, URL validation, auth decorators
```

---

## Web templates & static

```
templates/
├── admin.html              # Admin dashboard page
├── dashboard.html          # User dashboard page
├── index.html              # Homepage
├── login.html              # Login page
└── result.html             # Scan result page

static/
├── css/
│   ├── admin.css           # Admin dashboard styles
│   ├── dashboard.css       # Dashboard styles
│   ├── index.css           # Homepage styles
│   ├── login.css           # Login page styles
│   ├── result.css          # Result page styles
│   └── style.css           # General styles
├── js/
│   ├── admin.js            # Admin dashboard script
│   ├── auth.js             # Authentication script
│   ├── dashboard.js        # Dashboard script
│   └── script.js           # General script
└── img/                    # Images and assets
```

---

## Data & Datasets

```
data/
└── commoncrawl_sample.csv                  # Sample URLs for testing

dataset/
└── URL Dataset.xlsx                        # Training dataset

model/
├── phishing_model.pkl                      # Trained ML model
└── model.pkl                               # Alternative model file
```

---

## Database & Logs

```
instance/ (local only)
├── phishguard.db           # SQLite database file (local development)
└── FullDBWipe.py           # Database reset utility

# On Vercel deployments the app uses `/tmp/phishguard.db` (ephemeral)
# The app also supports `DATABASE_URL` / `SQLALCHEMY_DATABASE_URI` env var for managed DBs

logs/
└── app.log                 # Application activity logs
```
## Directory Purpose Summary

| Directory | Purpose | Files |
|-----------|---------|-------|
| **Root** | Core application files | 6 files |
| **/api** | API endpoints | 1 file (index.py) |
| **/docs** | All documentation | 2 files |
| **/ml** | Machine learning code | 4 files |
| **/utils** | Shared utilities | 2 files |
| **/templates** | Active HTML templates | 5 files |
| **/static/css** | Stylesheets | 6 CSS files |
| **/static/js** | JavaScript files | 4 JS files |
| **/static/img** | Images and assets | Images |
| **/data** | Sample datasets | 1 CSV file |
| **/dataset** | Training data | 1 XLSX file |
| **/model** | Trained models | 2 PKL files |
| **/instance** | Database & utils | 2 files |
| **/logs** | Application logs | 1 log file |

---

## File Organization Benefits

✅ **Clean Root Directory** - Only essential configuration and main app files
✅ **Organized Documentation** - All docs in `/docs`
✅ **Clear Separation** - Code, data, templates, and docs properly separated
✅ **Easy Navigation** - Logical structure for developers
✅ **Professional Appearance** - Industry-standard organization

---

## Quick Navigation

- **Start Here:** README.md
- **API Docs:** docs/API.md
- **Setup Guide:** docs/SETUP.md
- **Main App:** app.py
- **Train Model:** ml/train_model.py
- **View Logs:** logs/app.log
- **Database:** instance/phishguard.db

Note: The application chooses the database path at startup. Locally it creates `instance/phishguard.db`; on Vercel it uses `/tmp/phishguard.db`. If you provide a `DATABASE_URL` or `SQLALCHEMY_DATABASE_URI` environment variable the app will use that instead.

---

**Project Structure Version:** 1.0.0  
**Last Updated:** April 4, 2026  
**Status:** ✅ Ready State
