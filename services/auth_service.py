"""
认证服务
封装 utils.auth 的认证功能
"""
import logging
import os
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


class AuthService:
    """认证业务服务"""

    def __init__(self):
        from utils.auth import JWTManager, PasswordManager, APIKeyManager, SessionManager
        secret_key = os.getenv("SECRET_KEY", os.getenv("JWT_SECRET_KEY", "change-me"))
        self.jwt = JWTManager(secret_key)
        self.passwords = PasswordManager()
        self.api_keys = APIKeyManager()
        self.sessions = SessionManager()
        self._expires_in = int(os.getenv("JWT_EXPIRES_IN", "3600"))

    def create_access_token(self, user_id: int, extra: Optional[dict] = None) -> str:
        """为用户创建访问令牌"""
        payload = {"sub": str(user_id), **(extra or {})}
        return self.jwt.encode(payload, expires_in_seconds=self._expires_in)

    def verify_access_token(self, token: str) -> Optional[int]:
        """验证访问令牌，返回 user_id"""
        payload = self.jwt.decode(token)
        if not payload:
            return None
        try:
            return int(payload["sub"])
        except (KeyError, ValueError):
            return None

    def hash_password(self, password: str) -> str:
        return self.passwords.hash_password(password)

    def verify_password(self, password: str, hashed: str) -> bool:
        return self.passwords.verify_password(password, hashed)

    def generate_api_key(self) -> Tuple[str, str]:
        """生成 API 密钥，返回 (plain, hashed)"""
        return self.api_keys.generate_api_key()

    def verify_api_key(self, plain_key: str, hashed_key: str) -> bool:
        return self.api_keys.verify_api_key(plain_key, hashed_key)

    def create_session(self, user_id: int, data: Optional[dict] = None) -> str:
        return self.sessions.create_session(user_id, data)

    def get_session(self, session_id: str) -> Optional[dict]:
        return self.sessions.get_session(session_id)

    def delete_session(self, session_id: str) -> bool:
        return self.sessions.delete_session(session_id)

    def validate_telegram_auth(self, data: dict, bot_token: str) -> bool:
        """验证 Telegram 登录数据"""
        import hashlib
        import hmac
        import time

        auth_date = int(data.get("auth_date", 0))
        if time.time() - auth_date > 86400:
            return False

        check_hash = data.pop("hash", "")
        data_check_string = "\n".join(
            f"{k}={v}" for k, v in sorted(data.items())
        )
        secret_key = hashlib.sha256(bot_token.encode()).digest()
        expected = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, check_hash)


# 全局实例
auth_service = AuthService()
