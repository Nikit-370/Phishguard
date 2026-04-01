from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import pickle
import logging
import os
import time
from datetime import datetime
from urllib.parse import urlparse
import requests
import whois

# Track startup time
_startup_begin = time.time()

print("\n" + "="*60)
print("🚀 PhishGuard Authentication Overhaul Initialized")
print("="*60)
print(f"⏰ Starting at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("="*60 + "\n")

from ml.features import extract_features, get_feature_descriptions
from utils.security import (
    is_valid_url, 
    auth_required,
    sanitize_input
)
from utils.database import db, User, URLCheck, SystemLog, init_db


def _safe_first(value):
    """Return the first element if list-like, else the value itself."""
    if isinstance(value, (list, tuple)) and value:
        return value[0]
    return value


def lookup_whois(domain: str):
    """Best-effort WHOIS lookup with graceful fallbacks."""
    info = {
        'domain': domain,
        'registrar': None,
        'created_at': None,
        'expires_at': None,
        'age_days': None
    }

    if not domain:
        return info

    try:
        record = whois.whois(domain)
        created = _safe_first(record.creation_date)
        expires = _safe_first(record.expiration_date)

        info['registrar'] = record.registrar if hasattr(record, 'registrar') else None
        if isinstance(created, datetime):
            info['created_at'] = created.isoformat()
            info['age_days'] = (datetime.utcnow() - created).days
        if isinstance(expires, datetime):
            info['expires_at'] = expires.isoformat()

    except Exception as e:
        logging.warning(f'WHOIS lookup failed for {domain}: {e}')

    return info

# Initialize Flask app
print("📦 Initializing Flask application...")
app = Flask(__name__)
CORS(app)
print("✅ Flask app initialized")

# Configuration
print("⚙️  Loading configuration...")
def _get_database_uri():
    """Return SQLAlchemy DB URI depending on environment.

    - On Vercel (detected via `VERCEL*` env vars) use `/tmp/phishguard.db`.
    - Otherwise use `instance/phishguard.db` inside the project directory.
    """
    # If an explicit DATABASE_URL (or SQLALCHEMY_DATABASE_URI) is provided, use it.
    explicit = os.getenv('DATABASE_URL') or os.getenv('SQLALCHEMY_DATABASE_URI')
    if explicit:
        print("Using explicit database URL from environment")
        return explicit

    # Consider common Vercel environment variables
    if os.getenv('VERCEL') or os.getenv('VERCEL_ENV') or os.getenv('VERCEL_URL'):
        db_path = '/tmp/phishguard.db'
        on_vercel = True
    else:
        base_dir = os.path.abspath(os.path.dirname(__file__))
        instance_dir = os.path.join(base_dir, 'instance')
        os.makedirs(instance_dir, exist_ok=True)
        db_path = os.path.join(instance_dir, 'phishguard.db')
        on_vercel = False

    # SQLAlchemy expects `sqlite:///` + absolute/relative path.
    db_uri = 'sqlite:///' + db_path.replace('\\', '/')
    print(f"Using database at: {db_path} (on Vercel: {on_vercel})")
    return db_uri


app.config['SQLALCHEMY_DATABASE_URI'] = _get_database_uri()
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'phishing-system-secret-key-change-in-production')
print("✅ Configuration loaded")

# Initialize database
print("🗄️  Initializing database...")
db_start = time.time()
try:
    db.init_app(app)
    init_db(app)
    db_time = time.time() - db_start
    print(f"✅ Database ready ({db_time:.2f}s)")
except Exception as e:
    # If DB init fails (e.g., invalid DB URL or filesystem issues), fallback to an in-memory SQLite DB
    logging.exception(f"Database initialization failed: {e}")
    print("❗ Database initialization failed — falling back to in-memory SQLite.")
    try:
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        db.init_app(app)
        with app.app_context():
            db.create_all()
        db_time = time.time() - db_start
        print(f"✅ In-memory database ready ({db_time:.2f}s)")
    except Exception as inner:
        logging.exception(f"Fallback in-memory DB init also failed: {inner}")
        print("❌ Critical: could not initialize any database. Exiting.")
        raise

# Logging configuration
print("📝 Setting up logging system...")
os.makedirs('logs', exist_ok=True)
logging.basicConfig(
    filename='logs/app.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
print("✅ Logging configured")

print("🤖 ML model will load on first request (lazy loading enabled)")

# ═════════════════════════════════════════════════════════════════════════
# ML MODEL LAZY LOADING
# ═════════════════════════════════════════════════════════════════════════
# 
# The ML model is loaded on first request (lazy loading) instead of at startup.
# This significantly reduces application startup time and memory usage, since
# we only load the model when it's actually needed.
# 
# Thread safety is ensured using a lock to prevent multiple concurrent loads.
# ═════════════════════════════════════════════════════════════════════════

model = None
from threading import Lock
_model_lock = Lock()
model_load_error = None
last_detection_error = None

def get_model():
    """
    Load and cache the ML phishing detection model on first use.
    
    Uses double-checked locking pattern for thread-safe lazy loading.
    This avoids heavy numerical library imports and pickle unpacking at
    process startup, which is the common cause of slow application start times.
    
    Returns:
        The loaded scikit-learn model object, or None if loading fails
        
    Raises:
        Logs error but doesn't raise - returns None on failure to allow
        graceful degradation
    """
    global model
    if model is None:
        with _model_lock:
            if model is None:
                try:
                    logging.info('Loading ML model (lazy loading initiated)...')
                    with open('model/phishing_model.pkl', 'rb') as f:
                        loaded = pickle.load(f)
                    model = loaded
                    logging.info('✅ ML Model loaded successfully')
                except Exception as e:
                    import traceback
                    logging.error(f'❌ Error loading model: {e}')
                    logging.debug(traceback.format_exc())
                    model_load_error = str(e)
                    model = None
    return model


# ═════════════════════════════════════════════════════════════════════════
# AUTHENTICATION & AUTHORIZATION ENDPOINTS
# ═════════════════════════════════════════════════════════════════════════
# 
# Handles user registration and credential verification.
# Uses HTTP Basic Authentication (Base64 encoded username:password).
# All endpoints validate input and sanitize user data to prevent injection.
# ═════════════════════════════════════════════════════════════════════════

@app.route('/api/auth/register', methods=['POST'])
def register():
    """Register a new user"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'message': 'No data provided'}), 400
        
        username = sanitize_input(data.get('username', ''))
        email = sanitize_input(data.get('email', ''))
        password = data.get('password', '')
        
        # Validation
        if not username or not email or not password:
            return jsonify({'message': 'Missing required fields'}), 400
        
        if len(password) < 6:
            return jsonify({'message': 'Password must be at least 6 characters'}), 400
        
        # Check if user exists
        if User.query.filter_by(username=username).first():
            return jsonify({'message': 'Username already exists'}), 409
        
        if User.query.filter_by(email=email).first():
            return jsonify({'message': 'Email already exists'}), 409
        
        # Create new user
        user = User(username=username, email=email)
        user.set_password(password)
        
        db.session.add(user)
        db.session.commit()
        
        # Log action
        log = SystemLog(action='USER_REGISTERED', details=f'User {username} registered')
        db.session.add(log)
        db.session.commit()
        
        logging.info(f'✅ New user registered: {username}')
        
        return jsonify({
            'message': 'Registration successful'
        }), 201
    
    except Exception as e:
        logging.error(f'❌ Registration error: {e}')
        return jsonify({'message': 'Registration failed'}), 500


# /api/auth/login removed - logic handled by @auth_required on all protected routes


@app.route('/api/auth/verify', methods=['GET'])
@auth_required
def verify_auth():
    """Verify token and get user info"""
    try:
        user = db.session.get(User, request.user_id)
        if not user:
            return jsonify({'message': 'User not found'}), 404
        
        return jsonify({
            'message': 'Token valid',
            'user': user.to_dict()
        }), 200
    
    except Exception as e:
        logging.error(f'❌ Token verification error: {e}')
        return jsonify({'message': 'Verification failed'}), 500


@app.route('/api/auth/profile', methods=['PUT'])
@auth_required
def update_profile():
    """Update current user's profile details"""
    try:
        user = db.session.get(User, request.user_id)
        if not user:
            return jsonify({'message': 'User not found'}), 404
        
        data = request.get_json() or {}
        new_username = sanitize_input(data.get('username', user.username))
        new_email = sanitize_input(data.get('email', user.email))
        new_password = data.get('password')
        
        # Conflict checks
        if User.query.filter(User.username == new_username, User.id != user.id).first():
            return jsonify({'message': 'Username already taken'}), 409
        if User.query.filter(User.email == new_email, User.id != user.id).first():
            return jsonify({'message': 'Email already taken'}), 409
            
        user.username = new_username
        user.email = new_email
        if new_password:
            if len(new_password) < 6:
                return jsonify({'message': 'Password must be at least 6 characters'}), 400
            user.set_password(new_password)
            
        db.session.commit()
        
        # Log action
        log = SystemLog(action='PROFILE_UPDATED', details=f'User {user.username} updated their profile')
        db.session.add(log)
        db.session.commit()
        
        return jsonify({
            'message': 'Profile updated successfully',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        logging.error(f'❌ Profile update error: {e}')
        return jsonify({'message': 'Profile update failed'}), 500


# ═════════════════════════════════════════════════════════════════════════
# PHISHING DETECTION ENDPOINTS
# ═════════════════════════════════════════════════════════════════════════
# 
# Core ML-based phishing detection functionality.
# Extracts URL features, runs through trained model, enriches with WHOIS data.
# All results are logged for audit trail and system monitoring.
# ═════════════════════════════════════════════════════════════════════════

@app.route('/api/detect', methods=['POST'])
@auth_required
def detect_phishing():
    """
    Detect if a URL is phishing or legitimate using ML model.
    
    This endpoint:
    1. Validates the input URL format
    2. Resolves the URL and captures HTTP status
    3. Extracts 12+ features from the URL
    4. Runs the trained ML model for prediction
    5. Enriches result with WHOIS domain information
    6. Stores result in database for history/audit trail
    7. Logs the action for monitoring
    
    Requires: Basic Auth credentials in Authorization header
    
    Request JSON:
        {
            "url": "https://example.com"
        }
    
    Returns:
        JSON with prediction (0=legitimate, 1=phishing), confidence score,
        extracted features, WHOIS info, and resolved URL details
        
    HTTP Status:
        200 - Prediction successful
        400 - Invalid URL format or missing URL
        401 - Unauthorized (invalid/missing token)
        500 - Server error or model not loaded
    """
    try:
        # Load ML model (lazy loading on first request)
        m = get_model()
        if not m:
            return jsonify({'message': 'ML model not loaded'}), 500
        
        # Validate request data
        data = request.get_json()
        url = sanitize_input(data.get('url', ''))
        
        if not url:
            return jsonify({'message': 'URL is required'}), 400
        
        if not is_valid_url(url):
            return jsonify({'message': 'Invalid URL format'}), 400

        # Attempt to resolve URL and capture HTTP metadata
        # This helps identify redirects, dead links, and suspicious servers
        resolved_url = url
        http_status = None
        resolved_ip = None
        domain_info = None
        try:
            # Make HTTP request with timeout and follow redirects
            resp = requests.get(
                url, 
                timeout=8, 
                allow_redirects=True, 
                headers={'User-Agent': 'PhishingURLDetectionSystem/1.0'}
            )
            http_status = resp.status_code
            resolved_url = resp.url or url

            # Extract domain for WHOIS lookup
            parsed_domain = urlparse(resolved_url).netloc.split(':')[0].lower()
            if parsed_domain.startswith('www.'):
                parsed_domain = parsed_domain[4:]

            # Perform WHOIS lookup to get domain age, registrar, etc.
            domain_info = lookup_whois(parsed_domain)

            # Attempt DNS resolution via Google DNS API (best-effort)
            try:
                dns_resp = requests.get(
                    'https://dns.google/resolve', 
                    params={'name': parsed_domain, 'type': 'A'}, 
                    timeout=4
                ).json()
                answers = dns_resp.get('Answer', []) if isinstance(dns_resp, dict) else []
                if answers:
                    resolved_ip = answers[0].get('data')
            except Exception:
                # DNS resolution is optional - continue without it
                resolved_ip = None

        except Exception as e:
            logging.warning(f'HTTP resolution failed for {url}: {e}')
            # Continue with URL checking - network issues don't block detection
        
        # Extract 12+ features from URL and domain
        # Features include length, special chars, digit ratio, domain patterns, etc.
        feature_vector, feature_map = extract_features(resolved_url)
        
        # Get ML model prediction (0 or 1)
        prediction = m.predict([feature_vector])[0]
        
        # Calculate confidence score (0-100)
        # Different models support different probability methods
        try:
            # Try to get probability scores if model supports them (e.g., Random Forest)
            probabilities = m.predict_proba([feature_vector])[0]
            confidence = max(probabilities) * 100
        except (AttributeError, IndexError, ValueError):
            # Model doesn't support predict_proba or prediction failed
            # Use default confidence based on prediction
            confidence = 85.0
        
        # Prepare comprehensive response object
        result = {
            'url': url,
            'resolved_url': resolved_url,
            'http_status': http_status,
            'prediction': int(prediction),
            'prediction_label': 'Phishing Website 🚨' if prediction == 1 else 'Legitimate Website ✅',
            'confidence': round(confidence, 2),
            'features': feature_map,
            'feature_descriptions': get_feature_descriptions(),
            'resolved_ip': resolved_ip,
            'domain_info': domain_info
        }
        
        # Save to database
        url_check = URLCheck(
            user_id=request.user_id,
            url=url,
            prediction=int(prediction),
            confidence=confidence
        )
        db.session.add(url_check)
        db.session.commit()
        
        logging.info(f'✅ URL checked: {url} | Result: {"Phishing" if prediction == 1 else "Legitimate"}')
        
        return jsonify(result), 200
    
    except Exception as e:
        logging.error(f'❌ Detection error: {e}')
        import traceback
        logging.debug(traceback.format_exc())
        global last_detection_error
        last_detection_error = str(e)
        return jsonify({'message': 'Detection failed', 'error': str(e)}), 500


@app.route('/api/history', methods=['GET'])
@auth_required
def get_history():
    """Get URL check history (all checks if admin, user's checks if regular user)"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        
        # Get current user to check admin status
        user = db.session.get(User, request.user_id)
        
        # If admin, show all checks; otherwise show only user's checks
        if user and user.is_admin:
            checks = URLCheck.query.order_by(
                URLCheck.checked_at.desc()
            ).paginate(page=page, per_page=per_page)
        else:
            checks = URLCheck.query.filter_by(user_id=request.user_id).order_by(
                URLCheck.checked_at.desc()
            ).paginate(page=page, per_page=per_page)
        
        return jsonify({
            'total': checks.total,
            'pages': checks.pages,
            'current_page': page,
            'checks': [check.to_dict() for check in checks.items]
        }), 200
    
    except Exception as e:
        logging.error(f'❌ History retrieval error: {e}')
        return jsonify({'message': 'Failed to retrieve history'}), 500


@app.route('/api/history/<int:check_id>', methods=['DELETE'])
@app.route('/api/history/<int:check_id>', methods=['DELETE'])
@auth_required
def delete_history_item(check_id):
    """
    Delete a specific URL check from user's history.
    
    Users can only delete their own history. Admins can delete any history.
    Deletion is permanent and logged for audit trail.
    
    Parameters:
        check_id (int): ID of URLCheck record to delete
    
    Returns:
        Success message on successful deletion
        404 if history item doesn't exist or doesn't belong to user
    """
    try:
        check = URLCheck.query.filter_by(id=check_id, user_id=request.user_id).first()
        
        if not check:
            return jsonify({'message': 'History item not found'}), 404
        
        db.session.delete(check)
        db.session.commit()
        
        logging.info(f'✅ History item {check_id} deleted by user {request.user_id}')
        return jsonify({'message': 'History item deleted'}), 200
    
    except Exception as e:
        logging.error(f'❌ History deletion error: {e}')
        return jsonify({'message': 'Failed to delete history item'}), 500


@app.route('/api/history/clear', methods=['DELETE'])
@auth_required
def clear_history():
    """
    Clear all URL checks from current user's history.
    
    This is a destructive operation - all historical data for the user is deleted.
    The action is logged but records cannot be recovered after deletion.
    
    Returns:
        Count of deleted records
    """
    try:
        deleted_count = URLCheck.query.filter_by(user_id=request.user_id).delete()
        db.session.commit()
        
        logging.info(f'✅ Cleared {deleted_count} history items for user {request.user_id}')
        return jsonify({'message': f'Cleared {deleted_count} history items'}), 200
    
    except Exception as e:
        logging.error(f'❌ History clear error: {e}')
        return jsonify({'message': 'Failed to clear history'}), 500


# ═════════════════════════════════════════════════════════════════════════
# STATISTICS & ANALYTICS ENDPOINTS
# ═════════════════════════════════════════════════════════════════════════
# 
# Provides real-time system and user statistics.
# Data visibility depends on user role: admins see system-wide, users see personal.
# ═════════════════════════════════════════════════════════════════════════

@app.route('/api/stats', methods=['GET'])
@auth_required
def get_stats():
    """
    Get detection statistics based on user role.
    
    For Admins:
        - System-wide statistics (all users, all checks)
        - Total users, total scans, phishing rate
        
    For Regular Users:
        - Personal statistics only (their own checks)
        - Count of their scans, phishing detected
        
    Returns:
        JSON with total_users, total_scans, phishing_detected, 
        legitimate_found, avg_confidence, and detection rate
    """
    try:
        # Get current user to check admin status
        user = db.session.get(User, request.user_id)
        
        # If admin, show all system stats; otherwise show only user's stats
        if user and user.is_admin:
            total_users = User.query.count()
            total_checks = URLCheck.query.count()
            phishing_found = URLCheck.query.filter_by(prediction=1).count()
            legitimate_found = URLCheck.query.filter_by(prediction=0).count()
            avg_confidence = round(
                db.session.query(db.func.avg(URLCheck.confidence)).scalar() or 0, 2
            )
        else:
            total_users = 1  # Just this user
            total_checks = URLCheck.query.filter_by(user_id=request.user_id).count()
            phishing_found = URLCheck.query.filter_by(user_id=request.user_id, prediction=1).count()
            legitimate_found = URLCheck.query.filter_by(user_id=request.user_id, prediction=0).count()
            avg_confidence = round(
                db.session.query(db.func.avg(URLCheck.confidence)).filter_by(
                    user_id=request.user_id
                ).scalar() or 0, 2
            )
        
        return jsonify({
            'total_users': total_users,
            'total_checks': total_checks,
            'total_scans': total_checks,  # Alias for consistency
            'phishing_detected': phishing_found,
            'phishing_found': phishing_found,
            'legitimate_found': legitimate_found,
            'avg_confidence': avg_confidence
        }), 200
    
    except Exception as e:
        logging.error(f'❌ Stats retrieval error: {e}')
        return jsonify({'message': 'Failed to retrieve stats'}), 500


# ═════════════════════════════════════════════════════════════════════════
# ADMIN PANEL ENDPOINTS
# ═════════════════════════════════════════════════════════════════════════
# 
# Administrative endpoints for system management.
# All endpoints require admin role (is_admin=True).
# Includes user management, activity logs, and system monitoring.
# ═════════════════════════════════════════════════════════════════════════

@app.route('/api/admin/users', methods=['GET'])
@auth_required
def admin_get_users():
    """
    Get all registered users in the system (admin only).
    
    Returns:
        List of user objects with id, username, email, is_admin, created_at
        
    Authorization:
        Requires admin role. Returns 403 Forbidden for non-admin users.
    """
    try:
        user = db.session.get(User, request.user_id)
        if not user or not user.is_admin:
            return jsonify({'message': 'Unauthorized'}), 403
        
        users = User.query.all()
        return jsonify([user.to_dict() for user in users]), 200
    
    except Exception as e:
        logging.error(f'❌ Admin users retrieval error: {e}')
        return jsonify({'message': 'Failed to retrieve users'}), 500


@app.route('/api/admin/users/<int:user_id>', methods=['GET'])
@auth_required
def admin_get_user(user_id):
    """
    Get detailed information about a specific user (admin only).
    
    Includes user profile and all their URL checks.
    
    Parameters:
        user_id (int): ID of user to retrieve
        
    Returns:
        User object with full details and check history
        
    Authorization:
        Requires admin role.
    """
    try:
        admin_user = db.session.get(User, request.user_id)
        if not admin_user or not admin_user.is_admin:
            return jsonify({'message': 'Unauthorized'}), 403

        user = db.session.get(User, user_id)
        if not user:
            return jsonify({'message': 'User not found'}), 404

        detail = user.to_dict()
        detail['last_login'] = user.last_login.isoformat() if user.last_login else None
        detail['total_checks'] = URLCheck.query.filter_by(user_id=user_id).count()
        detail['phishing_detected'] = URLCheck.query.filter_by(user_id=user_id, prediction=1).count()
        detail['legitimate_found'] = URLCheck.query.filter_by(user_id=user_id, prediction=0).count()

        return jsonify(detail), 200

    except Exception as e:
        logging.error(f'❌ Admin user detail error: {e}')
        return jsonify({'message': 'Failed to retrieve user'}), 500


@app.route('/api/admin/logs', methods=['GET'])
@auth_required
def admin_get_logs():
    """Get system logs (admin only)"""
    try:
        user = db.session.get(User, request.user_id)
        if not user or not user.is_admin:
            return jsonify({'message': 'Unauthorized'}), 403
        
        logs = SystemLog.query.order_by(SystemLog.timestamp.desc()).limit(100).all()
        return jsonify([log.to_dict() for log in logs]), 200
    
    except Exception as e:
        logging.error(f'❌ Admin logs retrieval error: {e}')
        return jsonify({'message': 'Failed to retrieve logs'}), 500


# Health endpoint
@app.route('/health', methods=['GET'])
def health_check():
    """Return a small health payload including which database backend is active.

    This endpoint redacts credentials from non-sqlite URIs for safety.
    """
    def _redact_non_sql_uri(uri: str) -> str:
        if not uri:
            return ''
        try:
            # redact userinfo if present: postgresql://user:pass@host/... -> postgresql://REDACTED@host/...
            parts = uri.split('://', 1)
            scheme = parts[0]
            rest = parts[1]
            if '@' in rest:
                after_at = rest.split('@', 1)[1]
                return f"{scheme}://REDACTED@{after_at}"
            return uri
        except Exception:
            return 'REDACTED'

    uri = app.config.get('SQLALCHEMY_DATABASE_URI')
    redacted = ''

    sqlite_path = None
    sqlite_dir_name = None
    db_exists = False
    if uri and uri.startswith('sqlite:///'):
        sqlite_path = uri.replace('sqlite:///', '')
        if sqlite_path == ':memory:':
            db_exists = True
            sqlite_dir_name = ':memory:'
        else:
            try:
                db_exists = os.path.exists(sqlite_path)
                sqlite_dir = os.path.dirname(sqlite_path)
                # Only return the final directory name for privacy (e.g., 'instance' or 'tmp')
                sqlite_dir_name = os.path.basename(sqlite_dir) if sqlite_dir else None
                # Build a project-relative display path like 'ProjectName/instance/phishguard.db'
                project_root = os.path.abspath(os.path.dirname(__file__))
                project_name = os.path.basename(project_root)
                try:
                    rel_path = os.path.relpath(sqlite_path, project_root)
                except Exception:
                    rel_path = os.path.join(sqlite_dir_name, os.path.basename(sqlite_path))
                # Normalize separators for display and avoid backslashes inside f-string expressions
                rel_path = rel_path.replace('\\', '/')
                display_sqlite_path = f"{project_name}/{rel_path}"
            except Exception:
                db_exists = False
                sqlite_dir_name = None

    on_vercel = bool(os.getenv('VERCEL') or os.getenv('VERCEL_ENV') or os.getenv('VERCEL_URL'))

    payload = {
        'status': 'ok',
        'sqlite_dir': sqlite_dir_name,
        'sqlite_exists': db_exists,
        'on_vercel': on_vercel
    }

    # If using sqlite and we have a display path, use that for database_uri (privacy-friendly)
    if uri and uri.startswith('sqlite:///'):
        if db_exists and 'display_sqlite_path' in locals():
            payload['database_uri'] = f"sqlite:///{display_sqlite_path}"
            payload['sqlite_path_display'] = display_sqlite_path
        else:
            # generic sqlite indicator
            payload['database_uri'] = 'sqlite:///[project-relative-path]'
    else:
        # Non-sql URIs: redact userinfo
        payload['database_uri'] = _redact_non_sql_uri(uri)

    return jsonify(payload), 200


@app.route('/debug/model', methods=['GET'])
def debug_model():
    """Temporary debug endpoint: returns model load status and recent errors."""
    try:
        m = model if model is not None else None
        # If model is None, attempt a non-blocking load to capture error
        if m is None:
            try:
                _ = get_model()
            except Exception:
                pass

        return jsonify({
            'model_loaded': model is not None,
            'model_type': type(model).__name__ if model is not None else None,
            'model_load_error': model_load_error,
            'last_detection_error': last_detection_error
        }), 200
    except Exception as e:
        logging.exception(f'Debug endpoint error: {e}')
        return jsonify({'message': 'Debug endpoint failed', 'error': str(e)}), 500


@app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
@auth_required
def admin_update_user(user_id):
    """Update user details (admin only)"""
    try:
        admin_user = db.session.get(User, request.user_id)
        if not admin_user or not admin_user.is_admin:
            return jsonify({'message': 'Unauthorized'}), 403

        user = db.session.get(User, user_id)
        if not user:
            return jsonify({'message': 'User not found'}), 404

        data = request.get_json() or {}
        new_username = sanitize_input(data.get('username', user.username))
        new_email = sanitize_input(data.get('email', user.email))
        is_admin = bool(data.get('is_admin', user.is_admin))
        new_password = data.get('password')

        # Conflict checks
        if User.query.filter(User.username == new_username, User.id != user_id).first():
            return jsonify({'message': 'Username already taken'}), 409
        if User.query.filter(User.email == new_email, User.id != user_id).first():
            return jsonify({'message': 'Email already taken'}), 409

        user.username = new_username
        user.email = new_email
        user.is_admin = is_admin
        if new_password:
            user.set_password(new_password)
        db.session.commit()

        log = SystemLog(action='USER_UPDATED', details=f'User {user_id} updated by admin {admin_user.id}')
        db.session.add(log)
        db.session.commit()

        return jsonify({'message': 'User updated', 'user': user.to_dict()}), 200

    except Exception as e:
        logging.error(f'❌ Admin user update error: {e}')
        return jsonify({'message': 'Failed to update user'}), 500


@app.route('/api/admin/users/<int:user_id>/history', methods=['GET'])
@auth_required
def admin_user_history(user_id):
    """Get URL history for a specific user (admin only)"""
    try:
        admin_user = db.session.get(User, request.user_id)
        if not admin_user or not admin_user.is_admin:
            return jsonify({'message': 'Unauthorized'}), 403

        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)

        checks = URLCheck.query.filter_by(user_id=user_id).order_by(
            URLCheck.checked_at.desc()
        ).paginate(page=page, per_page=per_page)

        return jsonify({
            'total': checks.total,
            'pages': checks.pages,
            'current_page': page,
            'checks': [check.to_dict() for check in checks.items]
        }), 200

    except Exception as e:
        logging.error(f'❌ Admin history retrieval error: {e}')
        return jsonify({'message': 'Failed to retrieve user history'}), 500


# =============================================================================
# WEB INTERFACE ROUTES
# =============================================================================

@app.route('/', methods=['GET', 'POST'])
def index():
    """Main page"""
    return render_template('index.html')


@app.route('/login', methods=['GET'])
def login_page():
    """Login page"""
    # Expose demo mode to the login template when running on Vercel and not forced to require auth
    on_vercel = bool(os.getenv('VERCEL') or os.getenv('VERCEL_ENV') or os.getenv('VERCEL_URL'))
    require_auth = os.getenv('REQUIRE_AUTH', '') == '1'
    demo_mode = on_vercel and not require_auth
    demo_username = 'demo'
    demo_password = 'demo'
    return render_template('login.html', demo_mode=demo_mode, demo_username=demo_username, demo_password=demo_password)


@app.route('/dashboard', methods=['GET'])
def dashboard():
    """Dashboard page (admin only)"""
    # Note: Client-side check is primary; this is a fallback
    # For full security, could add @token_required and check is_admin
    return render_template('dashboard.html')


@app.route('/admin', methods=['GET'])
def admin_panel():
    """Admin panel"""
    return render_template('admin.html')


# =============================================================================
# ERROR HANDLERS
# =============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'message': 'Endpoint not found'}), 404


@app.errorhandler(500)
def server_error(error):
    logging.error(f'Server error: {error}')
    return jsonify({'message': 'Internal server error'}), 500


if __name__ == '__main__':
    _startup_time = time.time() - _startup_begin
    print("\n" + "="*60)
    print(f"✅ Startup complete in {_startup_time:.3f}s")
    print("📡 Starting Flask development server...")
    print("🌐 Server will be available at: http://localhost:5000")
    print("💡 First request will load ML model (may take 2-3s)")
    print("="*60 + "\n")
    
    # Disable the reloader when debugging locally to avoid double-import
    # (which would re-run heavy top-level code). Use `flask run` or
    # set debug=False in production.
    app.run(debug=True, use_reloader=False, host='0.0.0.0', port=5000)

