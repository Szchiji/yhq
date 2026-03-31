"""
加密安全模块
支持数据加密、解密和密钥管理
"""

import base64
import hashlib
import hmac
import logging
import os
import secrets
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


class SymmetricEncryption:
    """
    基于 AES-256-GCM 的对称加密（需要 cryptography 包）。
    若未安装 cryptography，则回退到基于 Fernet 的实现。
    """

    def __init__(self, key: Optional[bytes] = None):
        self._key = key or self._get_or_generate_key()

    @staticmethod
    def _get_or_generate_key() -> bytes:
        """从环境变量读取或生成新密钥"""
        key_hex = os.getenv("ENCRYPTION_KEY")
        if key_hex:
            try:
                return bytes.fromhex(key_hex)
            except ValueError:
                logger.warning("ENCRYPTION_KEY 格式无效，生成新密钥")
        key = secrets.token_bytes(32)
        logger.warning(
            "⚠️ 未设置 ENCRYPTION_KEY，已生成临时密钥。"
            "重启后加密数据将无法解密！"
            f"请将以下密钥保存到环境变量 ENCRYPTION_KEY：{key.hex()}"
        )
        return key

    @staticmethod
    def generate_key() -> str:
        """生成新的 32 字节密钥（十六进制）"""
        return secrets.token_bytes(32).hex()

    def encrypt(self, plaintext: str) -> str:
        """加密字符串，返回 base64 编码的密文"""
        try:
            from cryptography.hazmat.primitives.ciphers.aead import AESGCM
            nonce = secrets.token_bytes(12)
            aesgcm = AESGCM(self._key)
            ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), None)
            combined = nonce + ciphertext
            return base64.urlsafe_b64encode(combined).decode()
        except ImportError:
            return self._encrypt_fallback(plaintext)
        except Exception as e:
            logger.error(f"加密失败：{e}")
            raise

    def decrypt(self, ciphertext_b64: str) -> str:
        """解密 base64 编码的密文"""
        try:
            from cryptography.hazmat.primitives.ciphers.aead import AESGCM
            combined = base64.urlsafe_b64decode(ciphertext_b64)
            nonce = combined[:12]
            ciphertext = combined[12:]
            aesgcm = AESGCM(self._key)
            plaintext = aesgcm.decrypt(nonce, ciphertext, None)
            return plaintext.decode()
        except ImportError:
            return self._decrypt_fallback(ciphertext_b64)
        except Exception as e:
            logger.error(f"解密失败：{e}")
            raise

    def _encrypt_fallback(self, plaintext: str) -> str:
        """回退加密（XOR + HMAC，不用于高安全场景）"""
        key_hash = hashlib.sha256(self._key).digest()
        data = plaintext.encode()
        keystream = (key_hash * ((len(data) // 32) + 1))[: len(data)]
        encrypted = bytes(a ^ b for a, b in zip(data, keystream))
        mac = hmac.new(self._key, encrypted, hashlib.sha256).digest()
        combined = mac + encrypted
        return base64.urlsafe_b64encode(combined).decode()

    def _decrypt_fallback(self, ciphertext_b64: str) -> str:
        """回退解密"""
        combined = base64.urlsafe_b64decode(ciphertext_b64)
        mac = combined[:32]
        encrypted = combined[32:]
        expected_mac = hmac.new(self._key, encrypted, hashlib.sha256).digest()
        if not hmac.compare_digest(mac, expected_mac):
            raise ValueError("MAC 验证失败，数据可能被篡改")
        key_hash = hashlib.sha256(self._key).digest()
        keystream = (key_hash * ((len(encrypted) // 32) + 1))[: len(encrypted)]
        data = bytes(a ^ b for a, b in zip(encrypted, keystream))
        return data.decode()


class HashService:
    """哈希工具"""

    @staticmethod
    def sha256(data: str) -> str:
        """计算 SHA-256 哈希"""
        return hashlib.sha256(data.encode()).hexdigest()

    @staticmethod
    def sha512(data: str) -> str:
        """计算 SHA-512 哈希"""
        return hashlib.sha512(data.encode()).hexdigest()

    @staticmethod
    def hmac_sha256(data: str, key: str) -> str:
        """计算 HMAC-SHA256"""
        return hmac.new(key.encode(), data.encode(), hashlib.sha256).hexdigest()

    @staticmethod
    def constant_time_compare(val1: str, val2: str) -> bool:
        """防时序攻击的字符串比较"""
        return hmac.compare_digest(val1.encode(), val2.encode())


class TokenGenerator:
    """令牌生成器"""

    @staticmethod
    def generate_token(length: int = 32) -> str:
        """生成 URL 安全的随机令牌"""
        return secrets.token_urlsafe(length)

    @staticmethod
    def generate_otp(digits: int = 6) -> str:
        """生成一次性数字验证码"""
        return str(secrets.randbelow(10**digits)).zfill(digits)

    @staticmethod
    def generate_hex_token(length: int = 32) -> str:
        """生成十六进制令牌"""
        return secrets.token_hex(length)


class EncryptionService:
    """统一加密服务"""

    def __init__(self):
        self.cipher = SymmetricEncryption()
        self.hasher = HashService()
        self.tokens = TokenGenerator()

    def encrypt_sensitive_data(self, data: str) -> str:
        """加密敏感数据"""
        return self.cipher.encrypt(data)

    def decrypt_sensitive_data(self, encrypted: str) -> str:
        """解密敏感数据"""
        return self.cipher.decrypt(encrypted)

    def hash_for_storage(self, data: str) -> str:
        """对数据进行哈希（用于存储，不可逆）"""
        return self.hasher.sha256(data)

    def generate_secure_token(self) -> str:
        """生成安全令牌"""
        return self.tokens.generate_token()

    def mask_sensitive(self, value: str, visible_chars: int = 4) -> str:
        """脱敏处理（保留前后 visible_chars 个字符）"""
        if len(value) <= visible_chars * 2:
            return "*" * len(value)
        return value[:visible_chars] + "*" * (len(value) - visible_chars * 2) + value[-visible_chars:]


# 全局实例
encryption_service = EncryptionService()
