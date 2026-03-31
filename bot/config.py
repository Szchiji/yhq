"""
Bot 配置模块
"""
import os
from dotenv import load_dotenv

load_dotenv()


class BotConfig:
    """Bot 配置"""
    BOT_TOKEN: str = os.getenv("BOT_TOKEN", "")
    BOT_USERNAME: str = os.getenv("BOT_USERNAME", os.getenv("TELEGRAM_BOT_USERNAME", ""))
    ADMIN_IDS: list = [
        int(x.strip())
        for x in os.getenv("ADMIN_IDS", "").split(",")
        if x.strip().isdigit()
    ]
    DATABASE_TYPE: str = os.getenv("DATABASE_TYPE", "sqlite")
    SQLITE_DB_PATH: str = os.getenv("SQLITE_DB_PATH", "data/bot.db")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    MIN_REASON_LENGTH: int = int(os.getenv("MIN_REASON_LENGTH", "12"))
    MIN_SCREENSHOTS: int = int(os.getenv("MIN_SCREENSHOTS", "1"))
    MAX_SCREENSHOTS: int = int(os.getenv("MAX_SCREENSHOTS", "3"))

    @classmethod
    def is_admin(cls, user_id: int) -> bool:
        return user_id in cls.ADMIN_IDS

    @classmethod
    def validate(cls) -> bool:
        if not cls.BOT_TOKEN:
            raise ValueError("BOT_TOKEN 未配置")
        return True


bot_config = BotConfig()
