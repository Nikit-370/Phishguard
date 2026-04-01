try:
    from vercel_wsgi import VercelWsgi
except Exception:
    VercelWsgi = None

from app import app

if VercelWsgi:
    handler = VercelWsgi(app)
else:
    def handler(event, context):
        return {"statusCode": 502, "headers": {"Content-Type": "text/plain"}, "body": "vercel-wsgi not installed"}
