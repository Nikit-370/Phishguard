# 🔌 PhishGuard API Documentation

Complete API reference for the PhishGuard Phishing URL Detection System.

> Note: The application chooses the database backend at startup. Locally it uses `instance/phishguard.db`; on Vercel it uses `/tmp/phishguard.db` (ephemeral). You can also provide `DATABASE_URL` or `SQLALCHEMY_DATABASE_URI` to point to a managed database. See `docs/SETUP.md` for details.

---

## Table of Contents

1. [Authentication](#authentication-endpoints)
2. [Detection](#detection-endpoints)
3. [History](#history-endpoints)
4. [Admin](#admin-endpoints)
5. [Statistics](#statistics-endpoints)
## Authentication Endpoints

The application uses HTTP Basic Authentication for protected endpoints. Include Basic Auth credentials in the request (username/password). For demo deployments on Vercel the app can allow a demo user unless `REQUIRE_AUTH=1` is set.

### POST /api/auth/register
Register a new user account.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response (201 - Created):**
```json
{
  "message": "Registration successful"
}
```

**Validation Rules:**
- Username: 3-80 characters, alphanumeric + underscore
- Email: valid email format
- Password: minimum 6 characters required by the implementation

---

### GET /api/auth/verify
Verify credentials (protected). Use Basic Auth header. Returns the current user info if credentials are valid.

**Request Headers:**
```
Authorization: Basic <base64(username:password)>
```

**Response (200 - OK):**
```json
{
  "message": "Token valid",
  "user": { "id": 1, "username": "john_doe", "email": "john@example.com" }
}
```

---

### PUT /api/auth/profile
Update the current user's profile (protected; Basic Auth required).

**Request Body:** (any of the fields below)
```json
{
  "username": "newname",
  "email": "new@example.com",
  "password": "newpassword"
}
```

**Response (200 - OK):** updated user info
**Token Format:**
```
Authorization: Bearer <token>
```

**Token Expiration:** 24 hours (configurable)

---

## Detection Endpoints

### POST /api/predict
Detect if a URL is phishing or legitimate.

**Request Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "url": "https://example-phishing.tk"
}
```

**Response (200 - OK):**
```json
{
  "success": true,
  "url": "https://example-phishing.tk",
  "prediction": 1,
  "prediction_label": "PHISHING",
  "confidence": 92.45,
  "is_phishing": true,
  "features": {
    "url_length": 28,
    "domain_age_days": 15,
    "has_ip_address": false,
    "has_special_chars": true,
    "special_char_count": 2,
    "contains_digits": true,
    "contains_uppercase": true,
    "dot_count": 3,
    "hyphen_count": 1,
    "underscore_count": 0,
    "suspicious_words": 1,
    "tld_suspicious": false
  },
  "whois_info": {
    "registrar": "Namecheap, Inc.",
    "created_date": "2025-01-10",
    "updated_date": "2025-01-15",
    "expires_date": "2026-01-10",
    "domain_age_days": 15,
    "is_recent": true,
    "registrant_country": "US"
  },
  "dns_info": {
    "domain": "example-phishing.tk",
    "has_dns_records": true,
    "http_status": 404,
    "is_live": false
  },
  "model_metadata": {
    "model_version": "1.0.0",
    "feature_count": 12,
    "accuracy": 0.9245
  },
  "checked_at": "2026-01-25T10:30:15Z"
}
```

**Error Responses:**
```json
{
  "error": "Invalid URL format",
  "code": 400
}
```

```json
{
  "error": "Unauthorized",
  "code": 401
}
```

**Prediction Values:**
- `0` - Legitimate URL
- `1` - Phishing URL

**Confidence Range:** 0-100 (percentage)

---

## History Endpoints

### GET /api/history
Get user's URL check history with pagination.

**Request Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `page` (optional) - Page number (default: 1)
- `per_page` (optional) - Items per page (default: 5)

**Example Request:**
```
GET /api/history?page=1&per_page=5
```

**Response (200 - OK):**
```json
{
  "success": true,
  "checks": [
    {
      "id": 47,
      "url": "https://example.com",
      "prediction": 0,
      "prediction_label": "LEGITIMATE",
      "confidence": 98.5,
      "checked_at": "2026-01-25T10:30:00Z",
      "username": "john_doe"
    },
    {
      "id": 46,
      "url": "https://phishing-site.tk",
      "prediction": 1,
      "prediction_label": "PHISHING",
      "confidence": 95.2,
      "checked_at": "2026-01-25T10:29:15Z",
      "username": "john_doe"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 5,
    "total": 47,
    "pages": 10
  }
}
```

**Filter by Prediction (Future Enhancement):**
```
GET /api/history?page=1&per_page=5&prediction=1
```

---

### GET /api/history/<check_id>
Get details of a specific history entry.

**Request Headers:**
```
Authorization: Bearer <jwt_token>
```

**Example Request:**
```
GET /api/history/47
```

**Response (200 - OK):**
```json
{
  "success": true,
  "check": {
    "id": 47,
    "url": "https://example.com",
    "resolved_url": "https://example.com/",
    "prediction": 0,
    "confidence": 98.5,
    "features": {...},
    "whois_info": {...},
    "checked_at": "2026-01-25T10:30:00Z"
  }
}
```

---

### DELETE /api/history/<check_id>
Delete a specific history entry.

**Request Headers:**
```
Authorization: Bearer <jwt_token>
```

**Example Request:**
```
DELETE /api/history/47
```

**Response (200 - OK):**
```json
{
  "success": true,
  "message": "History entry deleted successfully",
  "deleted_id": 47
}
```

**Error Response (404):**
```json
{
  "error": "History entry not found",
  "code": 404
}
```

---

### DELETE /api/history/clear-all
Delete all history entries for current user.

**Request Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 - OK):**
```json
{
  "success": true,
  "message": "All history cleared",
  "deleted_count": 47
}
```

---

## Admin Endpoints

### GET /api/admin/users
Get all registered users (admin only).

**Request Headers:**
```
Authorization: Bearer <admin_jwt_token>
```

**Query Parameters:**
- `page` (optional) - Page number
- `per_page` (optional) - Items per page
- `role` (optional) - Filter by role (admin/user)

**Response (200 - OK):**
```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "is_admin": true,
      "created_at": "2025-01-01T00:00:00Z",
      "check_count": 4759,
      "last_check": "2026-01-25T10:30:00Z"
    },
    {
      "id": 2,
      "username": "john_doe",
      "email": "john@example.com",
      "is_admin": false,
      "created_at": "2025-06-15T14:22:00Z",
      "check_count": 47,
      "last_check": "2026-01-25T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 5,
    "total": 15,
    "pages": 3
  }
}
```

**Error Response (403 - Forbidden):**
```json
{
  "error": "Admin privileges required",
  "code": 403
}
```

---

### GET /api/admin/users/<user_id>
Get specific user details (admin only).

**Request Headers:**
```
Authorization: Bearer <admin_jwt_token>
```

**Response (200 - OK):**
```json
{
  "success": true,
  "user": {
    "id": 2,
    "username": "john_doe",
    "email": "john@example.com",
    "is_admin": false,
    "created_at": "2025-06-15T14:22:00Z",
    "check_count": 47,
    "checks": [
      {
        "url": "https://example.com",
        "prediction": 0,
        "confidence": 98.5,
        "checked_at": "2026-01-25T10:30:00Z"
      }
    ]
  }
}
```

---

### PUT /api/admin/users/<user_id>
Update user information (admin only).

**Request Headers:**
```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "new_email@example.com",
  "is_admin": false
}
```

**Response (200 - OK):**
```json
{
  "success": true,
  "message": "User updated successfully",
  "user": {
    "id": 2,
    "username": "john_doe",
    "email": "new_email@example.com",
    "is_admin": false
  }
}
```

---

### DELETE /api/admin/users/<user_id>
Delete a user account (admin only).

**Request Headers:**
```
Authorization: Bearer <admin_jwt_token>
```

**Response (200 - OK):**
```json
{
  "success": true,
  "message": "User deleted successfully",
  "deleted_user_id": 2
}
```

---

### GET /api/admin/logs
Get system activity logs (admin only).

**Request Headers:**
```
Authorization: Bearer <admin_jwt_token>
```

**Query Parameters:**
- `page` (optional) - Page number
- `per_page` (optional) - Items per page
- `action` (optional) - Filter by action type
- `user_id` (optional) - Filter by user

**Response (200 - OK):**
```json
{
  "success": true,
  "logs": [
    {
      "id": 123,
      "action": "URL_CHECKED",
      "user_id": 2,
      "username": "john_doe",
      "timestamp": "2026-01-25T10:30:00Z",
      "details": "URL check: https://example.com (prediction: LEGITIMATE)"
    },
    {
      "id": 122,
      "action": "USER_REGISTERED",
      "user_id": 3,
      "username": null,
      "timestamp": "2026-01-25T09:15:00Z",
      "details": "New user registration: jane_doe"
    },
    {
      "id": 121,
      "action": "USER_LOGIN",
      "user_id": 2,
      "username": "john_doe",
      "timestamp": "2026-01-25T08:45:00Z",
      "details": "User login successful"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 5,
    "total": 456,
    "pages": 92
  }
}
```

**Action Types:**
- `USER_REGISTERED` - New user registration
- `USER_LOGIN` - User login
- `URL_CHECKED` - URL checked
- `USER_DELETED` - User deleted
- `HISTORY_CLEARED` - User cleared history
- `PASSWORD_CHANGED` - Password changed

---

### GET /api/admin/logs/<log_id>
Get specific log entry (admin only).

**Response (200 - OK):**
```json
{
  "success": true,
  "log": {
    "id": 123,
    "action": "URL_CHECKED",
    "user_id": 2,
    "username": "john_doe",
    "timestamp": "2026-01-25T10:30:00Z",
    "details": "URL check: https://example.com (prediction: LEGITIMATE)",
    "request_data": {
      "url": "https://example.com"
    },
    "response_data": {
      "prediction": 0,
      "confidence": 98.5
    }
  }
}
```

---

## Statistics Endpoints

### GET /api/stats
Get system statistics.

**Request Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 - OK):**

**For Admin Users:**
```json
{
  "success": true,
  "stats": {
    "total_users": 15,
    "total_scans": 4759,
    "phishing_detected": 1311,
    "legitimate_found": 3448,
    "avg_confidence": 85.72,
    "detection_rate": 27.55,
    "today_scans": 142,
    "today_phishing": 38,
    "this_week_scans": 856,
    "this_week_phishing": 247
  }
}
```

**For Regular Users:**
```json
{
  "success": true,
  "stats": {
    "total_scans": 47,
    "phishing_detected": 12,
    "legitimate_found": 35,
    "avg_confidence": 89.3,
    "detection_rate": 25.53,
    "today_scans": 5,
    "today_phishing": 1,
    "this_week_scans": 15,
    "this_week_phishing": 4
  }
}
```

**Statistics Definitions:**
- `total_scans` - Total URLs checked
- `phishing_detected` - Count of detected phishing URLs
- `legitimate_found` - Count of legitimate URLs
- `avg_confidence` - Average prediction confidence (%)
- `detection_rate` - Percentage of phishing URLs detected
- `today_scans` - Scans performed today
- `today_phishing` - Phishing URLs detected today

---

## Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "error": "Error message",
  "code": 400,
  "details": "Additional error details"
}
```

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Authentication required/failed |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Service temporarily unavailable |

### Common Error Responses

**Authentication Error (401):**
```json
{
  "error": "Unauthorized: Invalid or expired token",
  "code": 401
}
```

**Permission Error (403):**
```json
{
  "error": "Forbidden: Admin privileges required",
  "code": 403
}
```

**Validation Error (400):**
```json
{
  "error": "Invalid request",
  "code": 400,
  "details": {
    "url": "Invalid URL format"
  }
}
```

---

## Rate Limiting

**Current Configuration:**
- Per user: 100 requests per minute
- Per IP: 1000 requests per minute
- Burst limit: 10 requests per second

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1643187315
```

**Rate Limit Exceeded Response (429):**
```json
{
  "error": "Too many requests",
  "code": 429,
  "retry_after": 30
}
```

---

## Examples

### Complete User Flow

#### 1. Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@example.com",
    "password": "securepass123"
  }'
```

#### 2. Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "password": "securepass123"
  }'
```

#### 3. Check URL
```bash
curl -X POST http://localhost:5000/api/predict \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com"
  }'
```

#### 4. Get History
```bash
curl -X GET "http://localhost:5000/api/history?page=1&per_page=5" \
  -H "Authorization: Bearer <token>"
```

### Python Example

```python
import requests

# Login
response = requests.post('http://localhost:5000/api/auth/login', json={
    'username': 'john_doe',
    'password': 'securepass123'
})

token = response.json()['token']

# Check URL
response = requests.post('http://localhost:5000/api/predict',
    headers={'Authorization': f'Bearer {token}'},
    json={'url': 'https://example.com'}
)

prediction = response.json()
print(f"URL: {prediction['url']}")
print(f"Prediction: {prediction['prediction_label']}")
print(f"Confidence: {prediction['confidence']}%")
```

---

## Webhooks & Async Operations

Currently not implemented. Planned for v2.0.

---

## API Versioning

Current API Version: **v1.0**

Future versions will use URL versioning:
- `v1` - Current (backward compatible)
- `v2` - Planned enhancements

---

## Support

For API issues or questions:
- Email: api-support@phishguard.dev
- Documentation: https://docs.phishguard.dev
- Status Page: https://status.phishguard.dev

---

**Last Updated:** April 4, 2026  
**API Version:** 1.0.0  
**Status:** ✅ Ready State
