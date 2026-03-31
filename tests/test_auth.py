"""
认证系统测试
"""

import pytest
from utils.auth import JWTManager, PasswordManager, APIKeyManager, SessionManager


class TestJWTManager:
    def setup_method(self):
        self.jwt = JWTManager("test-secret-key")

    def test_encode_decode(self):
        payload = {"sub": "123", "role": "user"}
        token = self.jwt.encode(payload, expires_in_seconds=3600)
        assert token
        decoded = self.jwt.decode(token)
        assert decoded is not None
        assert decoded["sub"] == "123"
        assert decoded["role"] == "user"

    def test_expired_token(self):
        token = self.jwt.encode({"sub": "1"}, expires_in_seconds=-1)
        result = self.jwt.decode(token)
        assert result is None

    def test_invalid_signature(self):
        other_jwt = JWTManager("different-secret")
        token = other_jwt.encode({"sub": "1"})
        result = self.jwt.decode(token)
        assert result is None

    def test_invalid_token_format(self):
        assert self.jwt.decode("not.a.valid.token") is None
        assert self.jwt.decode("") is None

    def test_is_valid(self):
        token = self.jwt.encode({"sub": "1"})
        assert self.jwt.is_valid(token)
        assert not self.jwt.is_valid("bad_token")


class TestPasswordManager:
    def test_hash_and_verify(self):
        password = "my_secure_password_123"
        hashed = PasswordManager.hash_password(password)
        assert hashed != password
        assert PasswordManager.verify_password(password, hashed)

    def test_wrong_password(self):
        hashed = PasswordManager.hash_password("correct_password")
        assert not PasswordManager.verify_password("wrong_password", hashed)

    def test_unique_hashes(self):
        pw = "same_password"
        h1 = PasswordManager.hash_password(pw)
        h2 = PasswordManager.hash_password(pw)
        # 每次 hash 使用不同 salt，结果应不同
        assert h1 != h2
        assert PasswordManager.verify_password(pw, h1)
        assert PasswordManager.verify_password(pw, h2)

    def test_generate_password(self):
        pw = PasswordManager.generate_password(16)
        assert len(pw) == 16


class TestAPIKeyManager:
    def test_generate_and_verify(self):
        plain_key, hashed_key = APIKeyManager.generate_api_key()
        assert plain_key.startswith("yhq_")
        assert APIKeyManager.verify_api_key(plain_key, hashed_key)

    def test_invalid_key(self):
        _, hashed_key = APIKeyManager.generate_api_key()
        assert not APIKeyManager.verify_api_key("wrong_key", hashed_key)

    def test_custom_prefix(self):
        plain_key, _ = APIKeyManager.generate_api_key(prefix="test")
        assert plain_key.startswith("test_")


class TestSessionManager:
    def test_create_and_get_session(self):
        mgr = SessionManager(session_ttl_seconds=3600)
        session_id = mgr.create_session(user_id=42, data={"role": "admin"})
        assert session_id

        session = mgr.get_session(session_id)
        assert session is not None
        assert session["user_id"] == 42
        assert session["data"]["role"] == "admin"

    def test_expired_session(self):
        mgr = SessionManager(session_ttl_seconds=0)
        session_id = mgr.create_session(user_id=1)
        # 过期时间为 0 意味着立刻过期
        import time
        time.sleep(0.01)
        assert mgr.get_session(session_id) is None

    def test_delete_session(self):
        mgr = SessionManager()
        session_id = mgr.create_session(user_id=5)
        assert mgr.delete_session(session_id)
        assert mgr.get_session(session_id) is None

    def test_update_session(self):
        mgr = SessionManager()
        session_id = mgr.create_session(user_id=10, data={"key": "old"})
        mgr.update_session(session_id, {"key": "new", "extra": "value"})
        session = mgr.get_session(session_id)
        assert session["data"]["key"] == "new"
        assert session["data"]["extra"] == "value"
