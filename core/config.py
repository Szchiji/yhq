"""
统一核心配置模块
整合所有配置来源，提供统一的配置接口
"""
import os
from dotenv import load_dotenv

load_dotenv()


class CoreConfig:
    """核心配置类"""

    # ----------------------------------------
    # 应用基础配置
    # ----------------------------------------
    APP_NAME: str = os.getenv("APP_NAME", "Report System")
    APP_VERSION: str = os.getenv("APP_VERSION", "2.0.0")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "production")
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"

    # ----------------------------------------
    # Telegram Bot 配置
    # ----------------------------------------
    BOT_TOKEN: str = os.getenv("BOT_TOKEN", "")
    BOT_USERNAME: str = os.getenv("BOT_USERNAME", os.getenv("TELEGRAM_BOT_USERNAME", ""))

    # ----------------------------------------
    # 管理员配置
    # ----------------------------------------
    _admin_ids_raw: str = os.getenv("ADMIN_IDS", "")
    ADMIN_IDS: list = [
        int(x.strip())
        for x in _admin_ids_raw.split(",")
        if x.strip().isdigit()
    ]

    # ----------------------------------------
    # 数据库配置
    # ----------------------------------------
    DATABASE_TYPE: str = os.getenv("DATABASE_TYPE", "sqlite")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    SQLITE_DB_PATH: str = os.getenv("SQLITE_DB_PATH", "data/bot.db")

    # ----------------------------------------
    # 安全配置
    # ----------------------------------------
    SECRET_KEY: str = os.getenv("SECRET_KEY", os.getenv("JWT_SECRET_KEY", "change-me-in-production"))
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")

    # ----------------------------------------
    # Redis / 缓存配置
    # ----------------------------------------
    REDIS_URL: str = os.getenv("REDIS_URL", "")
    CACHE_BACKEND: str = os.getenv("CACHE_BACKEND", "memory")
    CACHE_TTL_SECONDS: int = int(os.getenv("CACHE_TTL_SECONDS", "3600"))

    # ----------------------------------------
    # SMTP 邮件配置
    # ----------------------------------------
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", os.getenv("SMTP_USER", ""))
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", os.getenv("SMTP_FROM_EMAIL", ""))

    # ----------------------------------------
    # 备份配置
    # ----------------------------------------
    BACKUP_DIR: str = os.getenv("BACKUP_DIR", "backups")
    BACKUP_SCHEDULE_HOUR: int = int(os.getenv("BACKUP_SCHEDULE_HOUR", "2"))
    BACKUP_RETENTION_DAYS: int = int(os.getenv("BACKUP_RETENTION_DAYS", "7"))

    # ----------------------------------------
    # 限流配置
    # ----------------------------------------
    RATE_LIMIT_SUBMIT_REPORT: int = int(os.getenv("RATE_LIMIT_SUBMIT_REPORT", "5"))
    RATE_LIMIT_SEARCH: int = int(os.getenv("RATE_LIMIT_SEARCH", "30"))
    RATE_LIMIT_API: int = int(os.getenv("RATE_LIMIT_API", "100"))

    # ----------------------------------------
    # 日志配置
    # ----------------------------------------
    LOG_DIR: str = os.getenv("LOG_DIR", "logs")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE: str = os.getenv("LOG_FILE", "")

    # ----------------------------------------
    # API 配置
    # ----------------------------------------
    API_ENABLED: bool = os.getenv("API_ENABLED", "false").lower() == "true"
    API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("API_PORT", "8080"))
    API_KEY: str = os.getenv("API_KEY", "")

    # ----------------------------------------
    # Elasticsearch 配置
    # ----------------------------------------
    ELASTICSEARCH_ENABLED: bool = os.getenv("ELASTICSEARCH_ENABLED", "False").lower() == "true"
    ELASTICSEARCH_HOSTS: str = os.getenv("ELASTICSEARCH_HOSTS", "localhost:9200")

    # ----------------------------------------
    # 国际化
    # ----------------------------------------
    DEFAULT_LANGUAGE: str = os.getenv("DEFAULT_LANGUAGE", "zh")

    # ----------------------------------------
    # Bot 运行模式
    # ----------------------------------------
    BOT_MODE: str = os.getenv("BOT_MODE", "polling")
    WEBHOOK_URL: str = os.getenv("WEBHOOK_URL", "")
    WEBHOOK_HOST: str = os.getenv("WEBHOOK_HOST", "0.0.0.0")
    WEBHOOK_PORT: int = int(os.getenv("WEBHOOK_PORT", "8000"))

    @classmethod
    def is_admin(cls, user_id: int) -> bool:
        """检查用户是否为管理员"""
        return user_id in cls.ADMIN_IDS

    @classmethod
    def validate(cls) -> bool:
        """验证必填配置"""
        if not cls.BOT_TOKEN:
            raise ValueError("BOT_TOKEN 未配置")
        return True


core_config = CoreConfig()
