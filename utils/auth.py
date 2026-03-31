"""
认证系统模块
支持 JWT、密码加密、API密钥和会话管理
"""

import hashlib
import hmac
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Tuple

import logging

logger = logging.getLogger(__name__)


# ============================================================
# JWT 实现（轻量级，无额外依赖）
# ============================================================

import base64
import json


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64decode(data: str) -> bytes:
    padding = 4 - len(data) % 4
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data)


class JWTManager:
    """轻量级 JWT 管理器（使用 HMAC-SHA256）"""

    def __init__(self, secret_key: str, algorithm: str = "HS256"):
        self.secret_key = secret_key.encode()
        self.algorithm = algorithm

    def encode(self, payload: dict, expires_in_seconds: int = 3600) -> str:
        """生成 JWT 令牌"""
        header = {"alg": self.algorithm, "typ": "JWT"}
        now = int(time.time())
        payload = {
            **payload,
            "iat": now,
            "exp": now + expires_in_seconds,
        }

        header_b64 = _b64encode(json.dumps(header, separators=(",", ":")).encode())
        payload_b64 = _b64encode(json.dumps(payload, separators=(",", ":")).encode())
        message = f"{header_b64}.{payload_b64}"

        sig = hmac.new(self.secret_key, message.encode(), hashlib.sha256).digest()
        sig_b64 = _b64encode(sig)

        return f"{message}.{sig_b64}"

    def decode(self, token: str) -> Optional[dict]:
        """解码并验证 JWT 令牌"""
        try:
            parts = token.split(".")
            if len(parts) != 3:
                return None

            header_b64, payload_b64, sig_b64 = parts
            message = f"{header_b64}.{payload_b64}"

            expected_sig = hmac.new(
                self.secret_key, message.encode(), hashlib.sha256
            ).digest()
            actual_sig = _b64decode(sig_b64)

            if not hmac.compare_digest(expected_sig, actual_sig):
                logger.warning("JWT 签名验证失败")
                return None

            payload = json.loads(_b64decode(payload_b64))
            if payload.get("exp", 0) < int(time.time()):
                logger.warning("JWT 令牌已过期")
                return None

            return payload
        except Exception as e:
            logger.error(f"JWT 解码失败：{e}")
            return None

    def is_valid(self, token: str) -> bool:
        """检查令牌是否有效"""
        return self.decode(token) is not None


# ============================================================
# 密码管理
# ============================================================

class PasswordManager:
    """密码加密和验证（使用 PBKDF2-SHA256）"""

    ITERATIONS = 260000
    SALT_LENGTH = 32

    @classmethod
    def hash_password(cls, password: str) -> str:
        """对密码进行哈希加密"""
        salt = os.urandom(cls.SALT_LENGTH)
        key = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode(),
            salt,
            cls.ITERATIONS,
        )
        salt_hex = salt.hex()
        key_hex = key.hex()
        return f"pbkdf2:sha256:{cls.ITERATIONS}${salt_hex}${key_hex}"

    @classmethod
    def verify_password(cls, password: str, hashed: str) -> bool:
        """验证密码"""
        try:
            method, _, rest = hashed.partition(":")
            if method != "pbkdf2":
                return False
            _, _, rest = rest.partition(":")
            iterations_str, _, rest = rest.partition("$")
            salt_hex, _, key_hex = rest.partition("$")

            iterations = int(iterations_str)
            salt = bytes.fromhex(salt_hex)
            expected_key = bytes.fromhex(key_hex)

            actual_key = hashlib.pbkdf2_hmac(
                "sha256",
                password.encode(),
                salt,
                iterations,
            )
            return hmac.compare_digest(expected_key, actual_key)
        except Exception as e:
            logger.error(f"密码验证失败：{e}")
            return False

    @classmethod
    def generate_password(cls, length: int = 16) -> str:
        """生成随机强密码"""
        alphabet = (
            "abcdefghijklmnopqrstuvwxyz"
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
            "0123456789"
            "!@#$%^&*"
        )
        return "".join(secrets.choice(alphabet) for _ in range(length))


# ============================================================
# API 密钥管理
# ============================================================

class APIKeyManager:
    """API 密钥生成和验证"""

    PREFIX = "yhq"
    KEY_LENGTH = 32

    @classmethod
    def generate_api_key(cls, prefix: str = "") -> Tuple[str, str]:
        """
        生成 API 密钥
        返回 (plain_key, hashed_key) 元组
        """
        prefix = prefix or cls.PREFIX
        raw = secrets.token_urlsafe(cls.KEY_LENGTH)
        plain_key = f"{prefix}_{raw}"
        hashed_key = hashlib.sha256(plain_key.encode()).hexdigest()
        return plain_key, hashed_key

    @classmethod
    def hash_api_key(cls, plain_key: str) -> str:
        """
        对 API 密钥进行哈希。
        API 密钥是由 secrets.token_urlsafe(32) 生成的高熵随机令牌（非用户密码），
        因此 SHA-256 是合适的哈希算法（无需密码哈希的密钥拉伸）。
        """
        return hashlib.sha256(plain_key.encode()).hexdigest()

    @classmethod
    def verify_api_key(cls, plain_key: str, hashed_key: str) -> bool:
        """
        验证 API 密钥。
        API 密钥是高熵随机令牌，SHA-256 是适合的哈希算法。
        使用 hmac.compare_digest 进行防时序攻击的比较。
        """
        # API 密钥为随机生成的高熵令牌（非用户密码），SHA-256 在此场景下是安全的
        actual = hashlib.sha256(plain_key.encode()).hexdigest()
        return hmac.compare_digest(actual, hashed_key)


# ============================================================
# 会话管理
# ============================================================

class SessionManager:
    """内存会话管理"""

    def __init__(self, session_ttl_seconds: int = 3600):
        self._sessions: Dict[str, dict] = {}
        self._ttl = session_ttl_seconds

    def create_session(self, user_id: int, data: Optional[dict] = None) -> str:
        """创建新会话，返回 session_id"""
        session_id = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        self._sessions[session_id] = {
            "user_id": user_id,
            "created_at": now.isoformat(),
            "expires_at": (now + timedelta(seconds=self._ttl)).isoformat(),
            "data": data or {},
        }
        logger.info(f"已为用户 {user_id} 创建会话 {session_id[:8]}...")
        return session_id

    def get_session(self, session_id: str) -> Optional[dict]:
        """获取会话数据，过期则返回 None"""
        session = self._sessions.get(session_id)
        if not session:
            return None
        expires = datetime.fromisoformat(session["expires_at"])
        if datetime.now(timezone.utc) > expires:
            self.delete_session(session_id)
            return None
        return session

    def update_session(self, session_id: str, data: dict) -> bool:
        """更新会话数据"""
        session = self.get_session(session_id)
        if not session:
            return False
        self._sessions[session_id]["data"].update(data)
        return True

    def delete_session(self, session_id: str) -> bool:
        """删除会话"""
        return self._sessions.pop(session_id, None) is not None

    def cleanup_expired(self):
        """清理过期会话"""
        now = datetime.now(timezone.utc)
        expired = [
            sid
            for sid, s in self._sessions.items()
            if datetime.fromisoformat(s["expires_at"]) < now
        ]
        for sid in expired:
            del self._sessions[sid]
        if expired:
            logger.info(f"清理了 {len(expired)} 个过期会话")

    def get_active_sessions(self) -> int:
        """获取活跃会话数量"""
        self.cleanup_expired()
        return len(self._sessions)


# ============================================================
# 统一认证管理器
# ============================================================

class AuthManager:
    """统一认证管理器"""

    def __init__(self):
        secret_key = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(32))
        self.jwt = JWTManager(secret_key)
        self.passwords = PasswordManager()
        self.api_keys = APIKeyManager()
        self.sessions = SessionManager()
        self._jwt_expires_in = int(os.getenv("JWT_EXPIRES_IN", "3600"))

    def create_access_token(self, user_id: int, extra: Optional[dict] = None) -> str:
        """为用户创建访问令牌"""
        payload = {"sub": str(user_id), **(extra or {})}
        return self.jwt.encode(payload, expires_in_seconds=self._jwt_expires_in)

    def verify_access_token(self, token: str) -> Optional[int]:
        """验证访问令牌并返回 user_id"""
        payload = self.jwt.decode(token)
        if not payload:
            return None
        try:
            return int(payload["sub"])
        except (KeyError, ValueError):
            return None


# 全局实例
auth_manager = AuthManager()
