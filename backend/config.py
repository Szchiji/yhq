import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
ADMIN_ID = int(os.environ.get("ADMIN_ID", "0"))
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/telegram_report_bot")
API_URL = os.environ.get("API_URL", "http://localhost:3000")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
JWT_SECRET = os.environ.get("JWT_SECRET", "change_this_secret")
PORT = int(os.environ.get("PORT", "3000"))
NODE_ENV = os.environ.get("NODE_ENV", "development")
WEBHOOK_DOMAIN = os.environ.get("WEBHOOK_DOMAIN", "")


def make_async_db_url(url: str) -> str:
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    if "postgresql://" in url and "+asyncpg" not in url:
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


ASYNC_DATABASE_URL = make_async_db_url(DATABASE_URL)
