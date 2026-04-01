"""
企业级认证服务
扩展基础认证服务，提供企业级功能
"""
import logging
import os
import time
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class AuthServiceEnterprise:
    """企业级认证服务"""

    def __init__(self):
        from services.auth_service import AuthService
        self._base = AuthService()
        self._refresh_tokens: Dict[str, dict] = {}
        self._api_keys: Dict[str, dict] = {}

    def create_access_token(self, user_id: int, extra: Optional[dict] = None) -> str:
        return self._base.create_access_token(user_id, extra)

    def verify_access_token(self, token: str) -> Optional[int]:
        return self._base.verify_access_token(token)

    def create_refresh_token(self, user_id: int) -> str:
        """创建刷新令牌"""
        import secrets
        refresh_token = secrets.token_urlsafe(64)
        self._refresh_tokens[refresh_token] = {
            "user_id": user_id,
            "created_at": time.time(),
            "expires_at": time.time() + 86400 * 30,  # 30 天
        }
        return refresh_token

    def refresh_access_token(self, refresh_token: str) -> Optional[str]:
        """使用刷新令牌获取新的访问令牌"""
        token_data = self._refresh_tokens.get(refresh_token)
        if not token_data:
            return None
        if time.time() > token_data["expires_at"]:
            del self._refresh_tokens[refresh_token]
            return None
        return self.create_access_token(token_data["user_id"])

    def issue_api_key(self, user_id: int, name: str = "") -> Tuple[str, str]:
        """为用户签发 API 密钥，返回 (plain_key, key_id)"""
        import secrets
        plain_key, hashed_key = self._base.generate_api_key()
        key_id = secrets.token_hex(8)
        self._api_keys[key_id] = {
            "user_id": user_id,
            "name": name,
            "hashed_key": hashed_key,
            "created_at": time.time(),
        }
        return plain_key, key_id

    def verify_api_key_by_id(self, plain_key: str, key_id: str) -> Optional[int]:
        """验证 API 密钥，返回 user_id"""
        key_data = self._api_keys.get(key_id)
        if not key_data:
            return None
        if self._base.verify_api_key(plain_key, key_data["hashed_key"]):
            return key_data["user_id"]
        return None

    def hash_password(self, password: str) -> str:
        return self._base.hash_password(password)

    def verify_password(self, password: str, hashed: str) -> bool:
        return self._base.verify_password(password, hashed)

    def list_api_keys(self, user_id: int) -> List[dict]:
        """列出用户的所有 API 密钥（不含明文密钥）"""
        return [
            {"key_id": kid, "name": v["name"], "created_at": v["created_at"]}
            for kid, v in self._api_keys.items()
            if v["user_id"] == user_id
        ]

    def revoke_api_key(self, key_id: str, user_id: int) -> bool:
        """撤销 API 密钥"""
        key_data = self._api_keys.get(key_id)
        if key_data and key_data["user_id"] == user_id:
            del self._api_keys[key_id]
            return True
        return False
