from typing import Optional
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.admin import Admin, _DEFAULT_KEYBOARDS, _DEFAULT_START_CONTENT
from config import ADMIN_ID


async def get_admin_config(db: AsyncSession) -> Admin:
    result = await db.execute(select(Admin).where(Admin.admin_id == ADMIN_ID))
    admin = result.scalar_one_or_none()
    if not admin:
        admin = Admin(admin_id=ADMIN_ID)
        db.add(admin)
        await db.commit()
        await db.refresh(admin)
    return admin


def build_main_keyboard(admin: Admin) -> ReplyKeyboardMarkup:
    keyboards = admin.keyboards or _DEFAULT_KEYBOARDS
    buttons = [[k["text"]] for k in keyboards]
    return ReplyKeyboardMarkup(buttons, resize_keyboard=True)


def build_start_inline_keyboard(admin: Admin) -> Optional[InlineKeyboardMarkup]:
    buttons = (admin.start_content or {}).get("buttons", [])
    if not buttons:
        return None
    rows = []
    for btn in buttons:
        if btn.get("url"):
            rows.append([InlineKeyboardButton(btn["text"], url=btn["url"])])
        else:
            rows.append([InlineKeyboardButton(btn["text"], callback_data=btn.get("action", "noop"))])
    return InlineKeyboardMarkup(rows)


def build_subscribe_keyboard(channel_id: str) -> InlineKeyboardMarkup:
    if channel_id.startswith("@"):
        channel_link = f"https://t.me/{channel_id[1:]}"
    else:
        channel_link = f"https://t.me/c/{channel_id.replace('-100', '')}"
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("📢 点击订阅频道", url=channel_link)],
        [InlineKeyboardButton("✅ 我已订阅", callback_data="check_subscription")],
    ])
