"""
@用户名 提及处理模块
在群组中 @用户名 查询教师评价统计卡片
"""
import logging
import re

from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import Command

from database import get_teacher_stats, get_recent_evaluations, get_ranking
from config import config

logger = logging.getLogger(__name__)
router = Router()


def _parse_username_from_text(text: str) -> str | None:
    """从文本中解析 @用户名"""
    match = re.search(r"@(\w+)", text)
    if match:
        return match.group(1)
    return None


def _build_stats_card(username: str, stats: dict) -> str:
    """构建评价统计卡片文本"""
    total = stats["total"]
    recommended = stats["recommended"]
    not_recommended = stats["not_recommended"]

    if total == 0:
        rate_bar = "暂无评价"
    else:
        ratio = recommended / total
        filled = int(ratio * 10)
        rate_bar = "🟢" * filled + "⬜" * (10 - filled)

    return (
        f"👤 **@{username} 的评价统计**\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"📊 总评价数：{total} 条\n"
        f"👍 推荐：{recommended} 条\n"
        f"👎 不推荐：{not_recommended} 条\n"
        f"📈 推荐率：{rate_bar}\n"
        f"━━━━━━━━━━━━━━━━━━━━"
    )


def _build_stats_keyboard(username: str) -> InlineKeyboardMarkup:
    """构建统计卡片按钮"""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="👍 推荐", callback_data=f"rate:recommend:{username}"),
            InlineKeyboardButton(text="👎 不推荐", callback_data=f"rate:not_recommend:{username}"),
        ],
        [
            InlineKeyboardButton(text="📝 写报告", callback_data=f"report:start:{username}"),
            InlineKeyboardButton(text="🔄 刷新", callback_data=f"mention:refresh:{username}"),
        ],
    ])


@router.message(F.text.regexp(r"^@\w+"))
async def mention_handler(message: Message):
    """处理群组中的 @用户名 查询"""
    text = message.text or ""
    username = _parse_username_from_text(text)
    if not username:
        return

    # 跳过查询自己
    if message.from_user and message.from_user.username == username:
        return

    stats = await get_teacher_stats(username)
    card_text = _build_stats_card(username, stats)
    kb = _build_stats_keyboard(username)

    await message.reply(card_text, reply_markup=kb, parse_mode="Markdown")


@router.callback_query(F.data.startswith("mention:refresh:"))
async def refresh_stats_callback(callback: CallbackQuery):
    """刷新统计卡片"""
    username = callback.data.split(":", 2)[2]
    stats = await get_teacher_stats(username)
    card_text = _build_stats_card(username, stats)
    kb = _build_stats_keyboard(username)

    await callback.message.edit_text(card_text, reply_markup=kb, parse_mode="Markdown")
    await callback.answer("✅ 已刷新")


@router.message(Command("ranking"))
async def ranking_handler(message: Message):
    """显示推荐排行榜"""
    rankings = await get_ranking(config.RANKING_LIMIT)

    if not rankings:
        await message.answer("📊 暂无排行榜数据")
        return

    text = "🏆 **教师推荐排行榜**\n━━━━━━━━━━━━━━━━━━━━\n"
    medals = ["🥇", "🥈", "🥉"]

    for i, r in enumerate(rankings):
        medal = medals[i] if i < 3 else f"{i + 1}."
        username = r["teacher_username"]
        recommended = r["recommended"]
        total = r["total"]
        text += f"{medal} **@{username}**\n   👍 {recommended} 推荐 / {total} 总计\n"

    await message.answer(text, parse_mode="Markdown")
