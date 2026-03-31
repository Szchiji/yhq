"""
扩展设置模块
提供应用级配置管理，对现有 config.py 进行补充
"""

import os
from dataclasses import dataclass, field
from typing import List, Optional

from dotenv import load_dotenv

load_dotenv()


@dataclass
class Settings:
    """完整应用配置"""

    # ----------------------------------------
    # JWT / 认证
    # ----------------------------------------
    jwt_secret_key: str = field(
        default_factory=lambda: os.getenv("JWT_SECRET_KEY", "change-me-in-production")
    )
    jwt_expires_in: int = field(
        default_factory=lambda: int(os.getenv("JWT_EXPIRES_IN", "3600"))
    )

    # ----------------------------------------
    # Redis / 缓存
    # ----------------------------------------
    redis_url: Optional[str] = field(
        default_factory=lambda: os.getenv("REDIS_URL")
    )
    cache_default_ttl: int = field(
        default_factory=lambda: int(os.getenv("CACHE_DEFAULT_TTL", "300"))
    )

    # ----------------------------------------
    # 限流
    # ----------------------------------------
    rate_limit_user_max: int = field(
        default_factory=lambda: int(os.getenv("RATE_LIMIT_USER_MAX", "10"))
    )
    rate_limit_user_window: int = field(
        default_factory=lambda: int(os.getenv("RATE_LIMIT_USER_WINDOW", "60"))
    )
    rate_limit_ip_max: int = field(
        default_factory=lambda: int(os.getenv("RATE_LIMIT_IP_MAX", "100"))
    )

    # ----------------------------------------
    # 邮件通知
    # ----------------------------------------
    smtp_host: str = field(default_factory=lambda: os.getenv("SMTP_HOST", ""))
    smtp_port: int = field(default_factory=lambda: int(os.getenv("SMTP_PORT", "587")))
    smtp_user: str = field(default_factory=lambda: os.getenv("SMTP_USER", ""))
    smtp_password: str = field(default_factory=lambda: os.getenv("SMTP_PASSWORD", ""))
    smtp_from_email: str = field(default_factory=lambda: os.getenv("SMTP_FROM_EMAIL", ""))
    smtp_use_tls: bool = field(
        default_factory=lambda: os.getenv("SMTP_USE_TLS", "true").lower() == "true"
    )

    # ----------------------------------------
    # 备份
    # ----------------------------------------
    backup_dir: str = field(
        default_factory=lambda: os.getenv("BACKUP_DIR", "backups")
    )
    backup_interval_minutes: int = field(
        default_factory=lambda: int(os.getenv("BACKUP_INTERVAL_MINUTES", "60"))
    )
    backup_retention_days: int = field(
        default_factory=lambda: int(os.getenv("BACKUP_RETENTION_DAYS", "7"))
    )
    backup_encryption_key: Optional[str] = field(
        default_factory=lambda: os.getenv("BACKUP_ENCRYPTION_KEY")
    )

    # ----------------------------------------
    # Elasticsearch
    # ----------------------------------------
    elasticsearch_url: Optional[str] = field(
        default_factory=lambda: os.getenv("ELASTICSEARCH_URL")
    )

    # ----------------------------------------
    # 加密
    # ----------------------------------------
    encryption_key: Optional[str] = field(
        default_factory=lambda: os.getenv("ENCRYPTION_KEY")
    )

    # ----------------------------------------
    # 国际化
    # ----------------------------------------
    default_language: str = field(
        default_factory=lambda: os.getenv("DEFAULT_LANGUAGE", "zh")
    )

    # ----------------------------------------
    # API
    # ----------------------------------------
    api_enabled: bool = field(
        default_factory=lambda: os.getenv("API_ENABLED", "false").lower() == "true"
    )
    api_host: str = field(default_factory=lambda: os.getenv("API_HOST", "0.0.0.0"))
    api_port: int = field(default_factory=lambda: int(os.getenv("API_PORT", "8080")))
    api_key: Optional[str] = field(default_factory=lambda: os.getenv("API_KEY"))

    # ----------------------------------------
    # 日志
    # ----------------------------------------
    log_file: Optional[str] = field(default_factory=lambda: os.getenv("LOG_FILE"))
    log_level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))

    @property
    def is_smtp_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)

    @property
    def is_redis_configured(self) -> bool:
        return bool(self.redis_url)

    @property
    def is_es_configured(self) -> bool:
        return bool(self.elasticsearch_url)


# 全局实例
settings = Settings()
