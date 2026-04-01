import hashlib
import hmac
import json
from urllib.parse import parse_qsl
from typing import Optional

from jose import jwt, JWTError
from fastapi import Request
from config import BOT_TOKEN, JWT_SECRET, ADMIN_ID


def verify_telegram_init_data(init_data: str) -> Optional[dict]:
    """Verify Telegram Web App initData and return parsed user dict or None."""
    params = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = params.pop("hash", None)
    if not received_hash:
        return None

    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(params.items())
    )

    secret_key = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_hash, received_hash):
        return None

    user_str = params.get("user")
    if not user_str:
        return None
    try:
        return json.loads(user_str)
    except (json.JSONDecodeError, ValueError):
        return None


def generate_token(payload: dict) -> str:
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def verify_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except JWTError:
        return None


def get_token_from_request(request: Request) -> Optional[str]:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


def require_auth(request: Request):
    token = get_token_from_request(request)
    if not token:
        return None
    return verify_token(token)


def require_admin_check(request: Request):
    user = require_auth(request)
    if not user:
        return None
    if not user.get("isAdmin"):
        return None
    return user
