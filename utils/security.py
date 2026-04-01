import os
import re
from flask import request, jsonify
from functools import wraps
from utils.database import db, User

def auth_required(f):
    """
    Decorator for Basic Authentication.
    Expects username and password in request.authorization.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        # Allow public/demo access when running on Vercel (convenience for demos)
        # Set environment variable `REQUIRE_AUTH=1` to force auth even on Vercel.
        on_vercel = bool(os.getenv('VERCEL') or os.getenv('VERCEL_ENV') or os.getenv('VERCEL_URL'))
        require_auth = os.getenv('REQUIRE_AUTH', '') == '1'
        if on_vercel and not require_auth:
            # Ensure a demo user exists and attach it to the request so endpoints depending
            # on `request.user_id` continue to work for demo usage.
            demo = User.query.filter_by(username='demo').first()
            if not demo:
                demo = User(username='demo', email='demo@local')
                demo.set_password('demo')
                db.session.add(demo)
                db.session.commit()
            request.user_id = demo.id
            request.current_user = demo
            return f(*args, **kwargs)

        auth = request.authorization
        if not auth or not auth.username or not auth.password:
            return jsonify({'message': 'Basic Auth credentials required'}), 401
        
        user = User.query.filter_by(username=auth.username).first()
        if not user or not user.check_password(auth.password):
            return jsonify({'message': 'Invalid credentials'}), 401
            
        request.user_id = user.id
        request.current_user = user
        return f(*args, **kwargs)

    return decorated

def is_valid_url(url):
    """Validate URL format and security"""
    if not url:
        return False

    if len(url) > 2048:
        return False

    # Prevent common XSS patterns
    dangerous_patterns = ['<', '>', '"', "'", 'javascript:', 'data:']
    if any(pattern in url.lower() for pattern in dangerous_patterns):
        return False

    pattern = re.compile(
        r'^(http|https)://'           # scheme
        r'([A-Za-z0-9\-]+\.)+[A-Za-z]{2,}'  # domain
        r'(:\d+)?'                    # port
        r'(\/.*)?$'                   # path
    )

    return re.match(pattern, url) is not None

def sanitize_input(input_string, max_length=2048):
    """Sanitize user input"""
    if not isinstance(input_string, str):
        return ""
    
    # Remove dangerous characters
    sanitized = re.sub(r'[<>"\']', '', input_string)
    
    # Limit length
    return sanitized[:max_length].strip()

