import re
import math
from urllib.parse import urlparse
from collections import Counter

FEATURE_ORDER = [
    "url_length",
    "has_ip",
    "has_at",
    "has_redirect",
    "https",
    "dot_count",
    "hyphen_count",
    "port_present",
    "subdomain_count",
    "special_char_count",
    "digit_count",
    "has_query_string",
    "path_length",
    "domain_length",
    "is_encoded",
    "entropy",
    "suspicious_words_count"
]

SUSPICIOUS_WORDS = [
    'login', 'verify', 'update', 'account', 'banking', 'secure', 
    'ebayisapi', 'webscr', 'signin', 'mail', 'install', 'confirm',
    'live', 'office', 'service', 'support', 'customer', 'check'
]

def calculate_entropy(text):
    if not text:
        return 0
    probs = [n_x/len(text) for n_x in Counter(text).values()]
    return -sum(p * math.log(p, 2) for p in probs)

def extract_features(url):
    """Extract features from URL for ML model"""
    try:
        parsed = urlparse(url)
        url_lower = url.lower()
        
        # Count special characters
        special_chars = len(re.findall(r'[!@#$%^&*()_+=\[\]{};:\'",.<>?/\\|`~]', url))
        
        # Count digits
        digit_count = sum(1 for char in url if char.isdigit())
        
        # Extract domain and subdomain info
        domain = parsed.netloc
        domain_parts = domain.split('.')
        subdomain_count = max(0, len(domain_parts) - 2)
        
        # Path info
        path_length = len(parsed.path) if parsed.path else 0
        
        # New features
        domain_length = len(domain)
        is_encoded = 1 if '%' in url else 0
        entropy = calculate_entropy(url)
        
        suspicious_words_count = 0
        for word in SUSPICIOUS_WORDS:
            if word in url_lower:
                suspicious_words_count += 1
        
        features = {
            "url_length": min(len(url), 2000),
            "has_ip": 1 if re.search(r"\d+\.\d+\.\d+\.\d+", url) else 0,
            "has_at": 1 if "@" in url else 0,
            "has_redirect": 1 if "//" in url[8:] else 0,
            "https": 1 if parsed.scheme == "https" else 0,
            "dot_count": url.count("."),
            "hyphen_count": url.count("-"),
            "port_present": 1 if ":" in parsed.netloc else 0,
            "subdomain_count": min(subdomain_count, 10),
            "special_char_count": min(special_chars, 50),
            "digit_count": min(digit_count, 50),
            "has_query_string": 1 if parsed.query else 0,
            "path_length": min(path_length, 500),
            "domain_length": min(domain_length, 255),
            "is_encoded": is_encoded,
            "entropy": round(entropy, 4),
            "suspicious_words_count": suspicious_words_count
        }
        
        return [features[f] for f in FEATURE_ORDER], features
    
    except Exception as e:
        print(f"Error extracting features: {e}")
        # Return default features on error
        return [0] * len(FEATURE_ORDER), {key: 0 for key in FEATURE_ORDER}


def get_feature_descriptions():
    """Get descriptions of each feature"""
    return {
        "url_length": "Total length of the URL",
        "has_ip": "URL contains IP address instead of domain",
        "has_at": "Presence of '@' symbol",
        "has_redirect": "Multiple '//' indicating redirects",
        "https": "Uses secure HTTPS protocol",
        "dot_count": "Number of dots in URL",
        "hyphen_count": "Number of hyphens in domain",
        "port_present": "Non-standard port specified",
        "subdomain_count": "Number of subdomains",
        "special_char_count": "Count of special characters",
        "digit_count": "Count of digits in URL",
        "has_query_string": "Presence of query parameters",
        "path_length": "Length of URL path component",
        "domain_length": "Length of the domain name",
        "is_encoded": "URL contains encoded characters (%)",
        "entropy": "Information entropy of the URL string",
        "suspicious_words_count": "Number of sensitive keywords found"
    }

