# 📚 Setup & Deployment Guide

This document provides tested local setup steps that match the repository code and `requirements.txt` pins.

---

## System Requirements

- **OS:** Windows, macOS, or Linux
- **Python:** 3.8 or higher
- **Disk:** ~1GB free (depends on datasets and models)

For small development testing, 4GB RAM is sufficient. For training on larger datasets, use more memory/CPU.

---

## Local Development Quickstart

1. Clone the repository and change into the project folder.

```bash
git clone <your-repo-url>
cd "Phishing URL Detection"
```

2. Create and activate a virtual environment

Windows:

```powershell
python -m venv venv
venv\Scripts\activate
```

macOS / Linux:

```bash
python3 -m venv venv
source venv/bin/activate
```

3. Install dependencies (uses exact pins in `requirements.txt`)

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

4. Initialize database (the app will create `instance/phishguard.db` automatically on first run)

```bash
python app.py
```

Once started, the app prints the local URL (http://localhost:5000) and creates the SQLite file.

---

## Training the ML model

Place a CSV/XLSX dataset file in the `dataset/` folder. The training script auto-detects a URL column (e.g., `url`, `URL`, `domain`) and a label column (e.g., `label`, `Result`, `class`).

To train:

```bash
python ml/train_model.py
```

The script trains a RandomForest model and writes `model/phishing_model.pkl`.

Notes:
- Training imports `ml.features.extract_features` to produce numeric feature vectors.
- For quick experiments, use `ml/quick_train.py` if available.

---

## Environment variables

- `SECRET_KEY` — Flask secret key (defaults to a safe dev value if unset).
- `DATABASE_URL` or `SQLALCHEMY_DATABASE_URI` — use for an external DB (Postgres, etc.). If unset, the app uses `instance/phishguard.db` locally or `/tmp/phishguard.db` on Vercel.

---

## Production & Deployment notes

- The app is written to be compatible with simple WSGI hosting. For production, run under `gunicorn`/`uvicorn` behind a reverse proxy and set `SECRET_KEY` and a managed database via `DATABASE_URL`.
- On Vercel the repository detects Vercel env vars and switches to `/tmp/phishguard.db` (ephemeral store). Provide a managed DB for persistent storage.

---

## Troubleshooting

- If the ML model fails to load, ensure `model/phishing_model.pkl` exists and matches the scikit-learn version pinned in `requirements.txt`.
- WHOIS lookups may fail due to network or rate limits; the app performs best-effort WHOIS enrichment and continues on failure.

 
from app import app
from utils.database import init_db
with app.app_context():
  init_db(app)
print('Database initialized')
PY

# This creates (local):
# - instance/phishguard.db (SQLite database)
# - Default admin user (username: admin, password: admin123)
# - Database schema with `User`, `URLCheck`, `SystemLog` tables
```

### Step 5: Start Development Server

```bash
# Run Flask development server
python app.py

# Output:
# * Serving Flask app 'app'
# * Debug mode: on
# * Running on http://127.0.0.1:5000
# Press CTRL+C to quit
```

### Step 6: Access Application

Open browser and navigate to: **http://localhost:5000**

**Default Credentials:**
- Username: `admin`
- Password: `admin123`

---

## Database Configuration

### SQLite (Default for local development)

**Location:** `instance/phishguard.db` (project `instance/` folder) — the app will create this automatically on startup.

**Behavior on Vercel:** When running on Vercel the application will use `/tmp/phishguard.db` due to the ephemeral runtime filesystem. This is suitable for demos but not for persistent production data.

**Environment variable fallback:** The application will use an explicit `DATABASE_URL` or `SQLALCHEMY_DATABASE_URI` environment variable if provided. For production, use a managed database (Postgres, MySQL, Vercel Postgres, Supabase) and set `DATABASE_URL` accordingly.

**Configuration (example using env var):**
```python
# If you set DATABASE_URL, the app will use that value automatically.
SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///instance/phishguard.db')
SQLALCHEMY_TRACK_MODIFICATIONS = False
```

**Advantages:**
- ✅ No external server needed
- ✅ File-based storage
- ✅ Perfect for development

**Limitations:**
- Limited concurrent access
- Not suitable for large-scale production
- Not recommended for distributed systems

### PostgreSQL (Recommended for Production)

**Installation:**
```bash
# On Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# On macOS (using Homebrew)
brew install postgresql

# On Windows
# Download from https://www.postgresql.org/download/windows/
```

**Create Database:**
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE phishing_detection;
CREATE USER phish_user WITH PASSWORD 'secure_password_here';
ALTER ROLE phish_user SET client_encoding TO 'utf8';
ALTER ROLE phish_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE phish_user SET default_transaction_deferrable TO on;
GRANT ALL PRIVILEGES ON DATABASE phishing_detection TO phish_user;
\q
```

**Install psycopg2:**
```bash
pip install psycopg2-binary
```

**Update Configuration (config.py):**
```python
SQLALCHEMY_DATABASE_URI = 'postgresql://phish_user:secure_password_here@localhost:5432/phishing_detection'
SQLALCHEMY_POOL_SIZE = 10
SQLALCHEMY_POOL_RECYCLE = 3600
SQLALCHEMY_POOL_PRE_PING = True
```

**Database Backup:**
```bash
# Backup PostgreSQL database
pg_dump -U phish_user phishing_detection > backup.sql

# Restore from backup
psql -U phish_user phishing_detection < backup.sql
```

### Database Migrations

```bash
# Initialize migration repository (first time only)
flask db init

# Create migration
flask db migrate -m "Initial migration"

# Apply migrations
flask db upgrade

# Rollback migration
flask db downgrade
```

---

## ML Model Setup

### Using Pre-trained Model

If a trained model exists in `model/` directory:

```bash
# The app will automatically load the model on startup
# Check /api/predict endpoint for functionality
```

### Training New Model

**Option 1: Quick Training (Recommended for Development)**

```bash
# Run quick training script
python -m ml.quick_train

# This trains on a small sample dataset
# Quick to complete (< 1 minute)
# Suitable for testing
```

**Option 2: Full Training**

```bash
# Prepare training data
# Place CSV file in dataset/ folder
# Required columns: url, label
# Label values: phishing OR legitimate

# Run full training
python -m ml.train_model

# This trains on all available data
# Takes longer but produces better model
```

**Option 3: Custom Training**

```python
# custom_train.py
from ml.train_model import train_model

# Your training parameters
config = {
    'test_size': 0.2,
    'random_state': 42,
    'model_type': 'random_forest',  # or 'logistic_regression'
    'max_depth': 10,
    'n_estimators': 100
}

train_model(config)
```

---

## Environment Configuration

### Create .env File

```bash
# Create .env in project root
touch .env  # On macOS/Linux
# or right-click and create new file on Windows
```

### .env Content

```env
# Flask Configuration
FLASK_ENV=development
FLASK_DEBUG=True
SECRET_KEY=dev-secret-key-change-in-production-12345

# JWT Configuration
JWT_SECRET=jwt-secret-key-change-in-production-98765
JWT_EXPIRATION_HOURS=24

# Database Configuration
DATABASE_URL=sqlite:///instance/phishguard.db
# For PostgreSQL: postgresql://user:password@localhost:5432/phishing_detection

# Security Configuration
CORS_ORIGINS=http://localhost:5000,http://localhost:3000,http://127.0.0.1:5000
CORS_ALLOW_HEADERS=Content-Type,Authorization
CORS_ALLOW_METHODS=GET,POST,PUT,DELETE,OPTIONS

# Logging Configuration
LOG_LEVEL=INFO
LOG_FILE=logs/app.log
LOG_MAX_BYTES=10485760
LOG_BACKUP_COUNT=10

# Model Configuration
MODEL_PATH=model/phishing_model.pkl
FEATURES_PATH=model/features.pkl
MIN_CONFIDENCE=70

# API Configuration
API_TIMEOUT=30
MAX_URL_LENGTH=2048
BATCH_SIZE=100

# Email Configuration (Optional)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
```

### Load Environment Variables

```python
# In app.py or config.py
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv('SECRET_KEY', 'default-dev-key')
JWT_SECRET = os.getenv('JWT_SECRET', 'default-jwt-key')
```

---

## Production Deployment

### Pre-deployment Checklist

```
☐ Change SECRET_KEY and JWT_SECRET
☐ Set FLASK_ENV=production
☐ Disable debug mode (FLASK_DEBUG=False)
☐ Configure strong database credentials
☐ Set up HTTPS/SSL certificates
☐ Configure CORS_ORIGINS for your domain
☐ Set up proper logging
☐ Create database backups
☐ Run security audit
☐ Test all endpoints
```

### Using Gunicorn (Production WSGI Server)

**Install Gunicorn:**
```bash
pip install gunicorn
```

**Run with Gunicorn:**
```bash
# Basic
gunicorn app:app

# With specific options
gunicorn -w 4 -b 0.0.0.0:5000 --timeout 120 app:app

# With logging
gunicorn \
  -w 4 \
  -b 0.0.0.0:5000 \
  --access-logfile logs/access.log \
  --error-logfile logs/error.log \
  --log-level info \
  app:app
```

**Parameters:**
- `-w` - Number of worker processes (4 recommended)
- `-b` - Bind address and port
- `--timeout` - Worker timeout in seconds
- `--access-logfile` - Access log location
- `--error-logfile` - Error log location

### Using Nginx (Reverse Proxy)

**Install Nginx:**
```bash
# Ubuntu/Debian
sudo apt-get install nginx

# macOS
brew install nginx
```

**Nginx Configuration (/etc/nginx/sites-available/phishing):**
```nginx
server {
    listen 80;
    server_name phishguard.example.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name phishguard.example.com;

    # SSL Configuration
    ssl_certificate /etc/ssl/certs/your_cert.crt;
    ssl_certificate_key /etc/ssl/private/your_key.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Proxy to Gunicorn
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files
    location /static/ {
        alias /path/to/static/;
        expires 30d;
    }
}
```

**Enable Configuration:**
```bash
sudo ln -s /etc/nginx/sites-available/phishing /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

### SSL/TLS Certificate

**Using Let's Encrypt (Free):**
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d phishguard.example.com
```

---

## Vercel Deployment

This project is commonly deployed on Vercel for serverless hosting. Vercel provides an easy way to deploy the app, but note that the filesystem is ephemeral — persistent storage requires an external database.

Quick steps:

1. Install the Vercel CLI (optional):

```bash
npm i -g vercel
```

2. From the project root, login and deploy:

```bash
vercel login
vercel --prod
```

3. In the Vercel dashboard set environment variables (e.g., `SECRET_KEY`, `DATABASE_URL`) if you want persistent storage.

Notes:

- When Vercel environment variables are present the app will use `/tmp/phishguard.db` (ephemeral). For persistence provide a managed DB via `DATABASE_URL`.
- To allow demo access on Vercel without auth, the app creates a `demo` user unless `REQUIRE_AUTH=1` is set.

---
## Advanced Configuration

### Rate Limiting

```python
# In app.py
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

@app.route('/api/predict', methods=['POST'])
@limiter.limit("10 per minute")
def predict():
    # Implementation
    pass
```

### Caching

```python
# In app.py
from flask_caching import Cache

cache = Cache(app, config={
    'CACHE_TYPE': 'redis',
    'CACHE_REDIS_URL': 'redis://localhost:6379/0'
})

@app.route('/api/stats')
@cache.cached(timeout=300)  # Cache for 5 minutes
def get_stats():
    # Implementation
    pass
```

### Session Configuration

```python
# app.py
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_PERMANENT'] = False
app.config['SESSION_USE_SIGNER'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = 3600  # 1 hour
```

---

## Monitoring & Logging

### Application Logs

```python
# logs/app.log
import logging
from logging.handlers import RotatingFileHandler

if not app.debug:
    handler = RotatingFileHandler(
        'logs/app.log',
        maxBytes=10485760,  # 10MB
        backupCount=10
    )
    handler.setLevel(logging.INFO)
    app.logger.addHandler(handler)
```

### System Monitoring

```bash
# Monitor running process
ps aux | grep app.py

# Monitor resource usage
top -p $(pgrep -f app.py)

# View system logs
journalctl -u phishguard -f  # For systemd service
```

### Database Monitoring

```bash
# SQLite database size (local)
ls -lh instance/phishguard.db

# Check database integrity (local)
sqlite3 instance/phishguard.db "PRAGMA integrity_check;"

# Vacuum database (optimize) (local)
sqlite3 instance/phishguard.db "VACUUM;"
```

### Systemd Service (Linux)

**Create /etc/systemd/system/phishguard.service:**
```ini
[Unit]
Description=PhishGuard Phishing Detection Service
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/phishguard
ExecStart=/usr/bin/python3 /var/www/phishguard/app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Enable and Start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable phishguard
sudo systemctl start phishguard
sudo systemctl status phishguard
```

---

## Troubleshooting

### Common Issues

#### 1. "ModuleNotFoundError: No module named 'flask'"

```bash
# Ensure virtual environment is activated
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

#### 2. "Port 5000 already in use"

```bash
# Find process using port 5000
lsof -i :5000  # macOS/Linux
netstat -ano | findstr :5000  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows

# Use different port
python app.py --port 8000
```

#### 3. "Database locked" (SQLite)

```bash
# Delete corrupted local database
rm instance/phishguard.db

# Reinitialize (recommended using app context)
python - <<'PY'
from app import app
from utils.database import init_db
with app.app_context():
  init_db(app)
print('Database initialized')
PY
```

#### 4. "ML model not found"

```bash
# Train new model
python -m ml.quick_train

# Or copy existing model to model/
cp /path/to/model.pkl model/phishing_model.pkl
```

#### 5. "CORS errors in browser"

```python
# Update CORS configuration in app.py or .env
CORS_ORIGINS = ['http://localhost:5000', 'https://yourdomain.com']

# Or in app.py
CORS(app, resources={
    r"/api/*": {"origins": ["http://localhost:5000"]}
})
```

### Debug Mode

```python
# Enable detailed debugging
FLASK_ENV=development
FLASK_DEBUG=True
SQLALCHEMY_ECHO=True  # Log all SQL queries
```

### Getting Help

1. Check logs: `logs/app.log`
2. Enable debug mode for more information
3. Test the app manually at http://localhost:5000
4. Check GitHub issues: https://github.com/yourusername/phishing-detection/issues
5. Contact support: support@phishguard.dev

---

## Performance Optimization

### Tips for Production

1. **Use PostgreSQL instead of SQLite**
   - Better for concurrent access
   - More features for optimization

2. **Enable query caching**
   - Reduce database load
   - Faster response times

3. **Compress static files**
   - Reduce bandwidth usage
   - Faster page loads

4. **Use CDN for static assets**
   - Distribute content globally
   - Reduce server load

5. **Monitor and optimize slow queries**
   - Enable SQL logging
   - Identify performance bottlenecks

6. **Implement API rate limiting**
   - Prevent abuse
   - Fair resource allocation

---

**Last Updated:** April 4, 2026  
**Version:** 1.0.0  
**Status:** ✅ Ready State
