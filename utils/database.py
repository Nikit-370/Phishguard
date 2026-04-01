from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import os
import sqlite3

db = SQLAlchemy()

class User(db.Model):
    """User model for authentication"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    
    # Relationship
    url_checks = db.relationship('URLCheck', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Verify password"""
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'is_admin': self.is_admin,
            'created_at': self.created_at.isoformat()
        }


class URLCheck(db.Model):
    """Model to log URL checks"""
    __tablename__ = 'url_checks'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    url = db.Column(db.String(2048), nullable=False)
    prediction = db.Column(db.Integer, nullable=False)  # 0: Legitimate, 1: Phishing
    confidence = db.Column(db.Float, nullable=False)
    checked_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        # Get username from related user
        from utils.database import User
        user = User.query.get(self.user_id) if self.user_id else None
        username = user.username if user else 'unknown'
        
        return {
            'id': self.id,
            'user_id': self.user_id,
            'username': username,
            'url': self.url,
            'prediction': self.prediction,
            'prediction_label': 'Phishing' if self.prediction == 1 else 'Legitimate',
            'confidence': round(self.confidence, 4),
            'checked_at': self.checked_at.isoformat()
        }


class SystemLog(db.Model):
    """Model for system-wide logging"""
    __tablename__ = 'system_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    action = db.Column(db.String(255), nullable=False)
    details = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'action': self.action,
            'details': self.details,
            'timestamp': self.timestamp.isoformat()
        }


def init_db(app):
    """Initialize database and seed default users if needed."""
    with app.app_context():
        db.create_all()

        # Seed default admin accounts if they don't exist
        if not User.query.filter_by(username='root').first():
            root = User(username='root', email='root@phishguard.local', is_admin=True)
            root.set_password('root123')
            db.session.add(root)

        if not User.query.filter_by(username='admin').first():
            admin = User(username='admin', email='admin@phishguard.local', is_admin=True)
            admin.set_password('admin123')
            db.session.add(admin)

        db.session.commit()


def get_sqlite_path():
    """Return the filesystem path to the SQLite DB depending on environment.

    - On Vercel, returns `/tmp/phishguard.db`.
    - Locally, returns `<project_root>/instance/phishguard.db` (creates folder).
    """
    if os.getenv('VERCEL') or os.getenv('VERCEL_ENV') or os.getenv('VERCEL_URL'):
        return '/tmp/phishguard.db'

    # Project root is one level up from utils/
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    instance_dir = os.path.join(project_root, 'instance')
    os.makedirs(instance_dir, exist_ok=True)
    return os.path.join(instance_dir, 'phishguard.db')


def get_sqlite_connection(timeout: float = 5.0):
    """Get a raw sqlite3 connection to the environment-aware DB path.

    Use `check_same_thread=False` if you plan to share the connection across threads.
    """
    db_path = get_sqlite_path()
    conn = sqlite3.connect(db_path, timeout=timeout, check_same_thread=False)
    return conn


def sample_insert_raw_log(action: str, details: str | None = None):
    """Example of creating a simple table and inserting a row using sqlite3.

    This shows how to open/commit/close the connection safely.
    """
    conn = get_sqlite_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """CREATE TABLE IF NOT EXISTS system_logs_raw (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                details TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        cur.execute(
            "INSERT INTO system_logs_raw (action, details) VALUES (?, ?)",
            (action, details),
        )
        conn.commit()
    finally:
        conn.close()
