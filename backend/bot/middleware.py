from telegram import Update
from telegram.ext import ContextTypes
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert
from models.user import User
from bot.keyboards import get_admin_config, build_subscribe_keyboard
from config import ADMIN_ID


async def upsert_user(db: AsyncSession, telegram_user) -> None:
    stmt = pg_insert(User).values(
        user_id=telegram_user.id,
        username=telegram_user.username or "",
        first_name=telegram_user.first_name or "",
        last_name=telegram_user.last_name or "",
    ).on_conflict_do_update(
        index_elements=["user_id"],
        set_={
            "username": telegram_user.username or "",
            "first_name": telegram_user.first_name or "",
            "last_name": telegram_user.last_name or "",
        },
    )
    await db.execute(stmt)
    await db.commit()


async def check_subscription(update: Update, context: ContextTypes.DEFAULT_TYPE, db: AsyncSession) -> bool:
    admin = await get_admin_config(db)
    if not admin.channel_id:
        return True

    user_id = update.effective_user.id
    if user_id == ADMIN_ID:
        return True

    try:
        member = await context.bot.get_chat_member(admin.channel_id, user_id)
        return member.status in ("member", "administrator", "creator")
    except Exception:
        return False
