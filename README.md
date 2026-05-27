# 🛡️ PhishGuard — Phishing URL Detection System

**Last Updated:** April 4, 2026  
**Status:** ✅ Ready State

PhishGuard is a full-stack Flask web application that detects phishing URLs using a scikit-learn ML model. It provides an interactive web UI, user authentication, an admin panel, WHOIS enrichment, and persistent scan history.

**Quick highlights**: ML-powered URL analysis, real-time scanning, WHOIS enrichment, user dashboard with history, admin tools, and a responsive UI.

---

## 📚 Documentation Hub

- **[📁 Project Structure](PROJECT_STRUCTURE.md)** — Complete file/folder map and organization
- **[🔌 API Reference](docs/API.md)** — All endpoints, authentication, and response formats
- **[⚙️ Setup & Deployment](docs/SETUP.md)** — Local setup, training, and production deployment

---

## ⚡ Quick Start

### Requirements
- Python 3.8+
- pip
- ~1GB disk space

### Installation

1. **Clone and setup virtual environment:**

```bash
git clone https://github.com/Nikit-370/Phishguard.git
cd Phishguard
python -m venv venv
venv\Scripts\activate  # Windows
# or
source venv/bin/activate  # macOS/Linux
```

2. **Install dependencies:**

```bash
pip install -r requirements.txt
```

3. **Start the app:**

```bash
python app.py
```

The app runs on **http://localhost:5000**. Database (`instance/phishguard.db`) is auto-created on first run.

---

## 🚀 Basic Usage

### Register + Login
```bash
POST /api/auth/register
{
  "username": "user",
  "email": "user@example.com",
  "password": "securepass"
}
```

### Detect Phishing URL
```bash
POST /api/detect
{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "prediction": 0,
  "confidence": 0.95,
  "features": {...},
  "whois": {...}
}
```

---

## 📖 For More Information

- **Setup & Deployment Details** → See [docs/SETUP.md](docs/SETUP.md)
- **Complete API Reference** → See [docs/API.md](docs/API.md)
- **Project Structure** → See [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)
- **Training the Model** → See [docs/SETUP.md#training](docs/SETUP.md#model-training)

---

## 💡 Key Technologies

- **Backend:** Flask, SQLAlchemy, Flask-CORS, Flask-JWT
- **ML:** scikit-learn, pandas, numpy
- **Frontend:** HTML5, CSS3, JavaScript
- **Database:** SQLite (local), Postgres (production)
- **Deployment:** Vercel

---

## ℹ️ Notes

- Database is auto-created on first run
- Logs are written to `logs/app.log`
- Trained ML model included (`model/phishing_model.pkl`)
- Optional: Train custom model with `python ml/train_model.py`

---

**For comprehensive setup, API documentation, and deployment instructions, please refer to the documentation links above.**

### 4. Run the Application

```bash
python app.py
```

The server starts at **http://localhost:5000**.

---

## 🔐 Default Credentials

| Username | Password   | Role  |
|----------|-----------|-------|
| `admin`  | `admin123` | Admin |
| `root`   | `root123`  | User  |

> These accounts are auto-seeded by `init_db()` if they don't exist.

---

## 🌐 API Endpoints

### Authentication
| Method | Endpoint             | Auth | Description              |
|--------|----------------------|------|--------------------------|
| POST   | `/api/auth/register` | —    | Register a new user      |
| GET    | `/api/auth/verify`   | Basic | Verify credentials       |

### Phishing Detection
| Method | Endpoint       | Auth  | Description                    |
|--------|---------------|-------|--------------------------------|
| POST   | `/api/detect`  | Basic | Analyze URL for phishing       |

### History & Stats
| Method | Endpoint                | Auth  | Description                     |
|--------|------------------------|-------|---------------------------------|
| GET    | `/api/history`          | Basic | Get user's scan history         |
| DELETE | `/api/history/<id>`     | Basic | Delete a specific history item  |
| POST   | `/api/history/clear`    | Basic | Clear all user history          |
| GET    | `/api/stats`            | Basic | Get detection stats             |

### Admin (requires admin role)
| Method | Endpoint                           | Auth  | Description                |
|--------|------------------------------------|-------|----------------------------|
| GET    | `/api/admin/users`                 | Basic | List all users             |
| GET    | `/api/admin/users/<id>`            | Basic | Get user details           |
| PUT    | `/api/admin/users/<id>`            | Basic | Update user details        |
| GET    | `/api/admin/users/<id>/history`    | Basic | Get user's scan history    |
| GET    | `/api/admin/logs`                  | Basic | Get system logs            |

### Web Pages
| Route        | Page             |
|-------------|------------------|
| `/`          | Landing page     |
| `/login`     | Login & signup   |
| `/dashboard` | User dashboard   |
| `/admin`     | Admin panel      |

---

## 🤖 ML Features Extracted (17)

| Feature               | Description                               |
|-----------------------|-------------------------------------------|
| `url_length`          | Total character length of the URL         |
| `has_ip`              | URL contains an IP address                |
| `has_at`              | Presence of `@` symbol                    |
| `has_redirect`        | Contains `//` redirect pattern            |
| `https`               | Uses HTTPS protocol                       |
| `dot_count`           | Number of dots in the URL                 |
| `hyphen_count`        | Number of hyphens                         |
| `port_present`        | Non-standard port specified               |
| `subdomain_count`     | Number of subdomains                      |
| `special_char_count`  | Count of special characters               |
| `digit_count`         | Number of digits in the URL               |
| `has_query_string`    | Presence of query parameters              |
| `path_length`         | Length of the URL path                    |
| `domain_length`       | Length of the domain name                 |
| `is_encoded`          | Contains URL-encoded characters           |
| `entropy`             | Shannon entropy of the URL string         |
| `suspicious_words_count` | Count of phishing-related keywords     |

---

## 🎨 Design System

The CSS architecture uses a **global design token system** in `style.css` with CSS custom properties:

- **Theming**: `[data-theme="dark"]` / `[data-theme="light"]` with 30+ CSS variables
- **Components**: Glass panels, premium buttons, toggle switches, icon circles, badges
- **Shared**: Input groups, modals, toasts, tables, and icon buttons are in `style.css` for cross-page consistency
- **Page-specific**: Each page has its own CSS file for unique elements (orbs, activity streams, etc.)

---

## 🔧 Configuration

| Setting               | Location       | Default                              |
|-----------------------|---------------|--------------------------------------|
| Database URI          | `app.py`       | Auto-detected: `instance/phishguard.db` (local) or `/tmp/phishguard.db` (Vercel) |
| Secret Key            | `app.py:77`    | `phishing-system-secret-key-...`     |
| Model Path            | `config.py:7`  | `model/phishing_model.pkl`           |
| Log File              | `config.py:9`  | `logs/app.log`                       |
| Max URL Length         | `config.py:11` | `2000` characters                    |

> ⚠️ Change `SECRET_KEY` before deploying to production.

---

## 🚢 Deployment & Database (Vercel)

This project uses SQLite for local development and an environment-aware path for deployments on Vercel.

- Behavior: on startup the app checks for common Vercel environment variables (`VERCEL`, `VERCEL_ENV`, `VERCEL_URL`). If present the app will use `/tmp/phishguard.db` as the SQLite file. Otherwise it creates and uses `instance/phishguard.db` in the project root.
- Location of logic: see `app.py` (the `_get_database_uri()` helper) and `utils/database.py` (`get_sqlite_path()` and `get_sqlite_connection()`).

Important caveats:
- Vercel's filesystem is ephemeral. Files written to `/tmp` are temporary and not suitable for persistent production storage. Data will be lost between deployments or cold starts.
- Multiple instances/functions do not share the same `/tmp` file. Concurrent or scaled deployments will have inconsistent local state.
- The app also supports an explicit `DATABASE_URL` or `SQLALCHEMY_DATABASE_URI` environment variable. If set, the application will use that value preferentially. If initialization fails (bad URL or filesystem errors), the app will attempt to fall back to an in-memory SQLite database to keep the app running for testing.
- Use SQLite only for local development, demos, or small single-instance deployments.

Quick verification

- Run locally and confirm the DB file is created:

```powershell
python app.py
Get-ChildItem .\instance\phishguard.db
```

- Deploy to Vercel and verify logs contain the message `Using database at: /tmp/phishguard.db` (the app prints the chosen path at startup). Test endpoints to confirm DB writes succeed (remember data is ephemeral on Vercel).

Raw sqlite helper example (included): `utils/database.py` provides `sample_insert_raw_log()` and `get_sqlite_connection()` for quick manual inserts and tests.

### Vercel Deploy Checklist

Follow these minimal steps to deploy this app on Vercel (serverless):

- Ensure `vercel.json`, `api/index.py`, and `vercel-wsgi` are present (they are added in this repo).
- Add required environment variables in the Vercel project settings: at minimum `SECRET_KEY`. Add `DATABASE_URL` if you plan to use an external DB.
- Deploy from the repository root (the folder containing `vercel.json`) with:

```bash
vercel --prod
```

- After deployment, open `https://<your-deployment-url>/health` to confirm the app is running and DB selection shows `on_vercel: true` or indicates `/tmp` usage.
- Check Vercel function logs for startup errors and for the printed DB path.

Notes:
- Local `instance/` files are ignored on Vercel — use `/tmp` or `DATABASE_URL`.
- Prefer a managed DB (Postgres, Vercel Postgres, Supabase) for production; set `DATABASE_URL` accordingly.

---

## 📦 Dependencies

```
flask==2.3.3
flask-cors==4.0.0
flask-sqlalchemy==3.0.5
pandas==2.0.3
numpy==1.24.3
scikit-learn==1.3.0
requests==2.31.0
werkzeug==2.3.7
python-dotenv==1.0.0
python-whois==0.9.4
```


---

## Deployment

This project is deployed on Vercel. The Flask app auto-detects Vercel environment variables and uses an ephemeral SQLite database at `/tmp/phishguard.db` when running on Vercel. For persistent storage in production, provide a managed database by setting `DATABASE_URL` or `SQLALCHEMY_DATABASE_URI`.

Quick Vercel steps:

1. Install the Vercel CLI (optional):

```bash
npm i -g vercel
```

2. From the project root, login and deploy:

```bash
vercel login
vercel --prod
```

3. In the Vercel dashboard, add any environment variables you need (for example `SECRET_KEY`, or a managed `DATABASE_URL` to persist data).

Notes:
- Vercel's filesystem is ephemeral; do not rely on `instance/phishguard.db` for long-term storage on Vercel.
- The app contains logic to fall back to an in-memory DB if initialization fails; for production use a managed DB.

---

## 📝 License

This project is released under the MIT License — see the `LICENSE` file in the repository for the full text. In short, you are free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software, provided that the original copyright and license notice are included in all copies or substantial portions of the Software.
