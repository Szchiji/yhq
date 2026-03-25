"""
配置管理模块
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """应用配置类"""

    # ----------------------------------------
    # Telegram Bot 配置
    # ----------------------------------------
    BOT_TOKEN: str = os.getenv("BOT_TOKEN", "")
    BOT_USERNAME: str = os.getenv("BOT_USERNAME", "")

    # ----------------------------------------
    # 管理员配置
    # ----------------------------------------
    _admin_ids_raw: str = os.getenv("ADMIN_IDS", "")
    ADMIN_IDS: list[int] = [
        int(x.strip())
        for x in _admin_ids_raw.split(",")
        if x.strip().isdigit()
    ]

    # ----------------------------------------
    # 数据库配置
    # ----------------------------------------
    DATABASE_TYPE: str = os.getenv("DATABASE_TYPE", "sqlite")
    SQLITE_DB_PATH: str = os.getenv("SQLITE_DB_PATH", "data/bot.db")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    MYSQL_HOST: str = os.getenv("MYSQL_HOST", "localhost")
    MYSQL_PORT: int = int(os.getenv("MYSQL_PORT", "3306"))
    MYSQL_USER: str = os.getenv("MYSQL_USER", "root")
    MYSQL_PASSWORD: str = os.getenv("MYSQL_PASSWORD", "")
    MYSQL_DATABASE: str = os.getenv("MYSQL_DATABASE", "yhq_db")

    # ----------------------------------------
    # 频道配置
    # ----------------------------------------
    _required_channels_raw: str = os.getenv("REQUIRED_CHANNELS", "")
    REQUIRED_CHANNELS: list[int] = [
        int(x.strip())
        for x in _required_channels_raw.split(",")
        if x.strip().lstrip("-").isdigit()
    ]

    _report_channels_raw: str = os.getenv("REPORT_CHANNELS", "")
    REPORT_CHANNELS: list[int] = [
        int(x.strip())
        for x in _report_channels_raw.split(",")
        if x.strip().lstrip("-").isdigit()
    ]

    # ----------------------------------------
    # 日志配置
    # ----------------------------------------
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # ----------------------------------------
    # 应用配置
    # ----------------------------------------
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "production")
    MIN_REASON_LENGTH: int = int(os.getenv("MIN_REASON_LENGTH", "12"))
    MIN_SCREENSHOTS: int = int(os.getenv("MIN_SCREENSHOTS", "1"))
    MAX_SCREENSHOTS: int = int(os.getenv("MAX_SCREENSHOTS", "3"))
    RANKING_LIMIT: int = int(os.getenv("RANKING_LIMIT", "10"))
    SEARCH_RESULT_LIMIT: int = int(os.getenv("SEARCH_RESULT_LIMIT", "10"))

    @classmethod
    def validate(cls) -> bool:
        """验证必填配置是否存在"""
        if not cls.BOT_TOKEN:
            raise ValueError("BOT_TOKEN 未配置，请在 .env 文件中设置")
        if not cls.ADMIN_IDS:
            raise ValueError("ADMIN_IDS 未配置，请在 .env 文件中设置至少一个管理员 ID")
        return True

    @classmethod
    def is_admin(cls, user_id: int) -> bool:
        """检查用户是否为管理员"""
        return user_id in cls.ADMIN_IDS


config = Config()
