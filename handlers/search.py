"""
标签搜索处理模块
用户在群组中输入 #标签 搜索相关报告
"""
import logging
import re

from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton

from config import config
from database import search_published_reports_by_tags, get_template_fields

logger = logging.getLogger(__name__)
router = Router()


def _parse_tags_from_text(text: str) -> list[str]:
    """从文本中解析 #标签 列表"""
    return re.findall(r"#(\w+)", text)


def _format_report_summary(report: dict, fields: list) -> str:
    """格式化报告摘要"""
    teacher = report.get("teacher_username", "未知")
    form_data = report.get("form_data", {})
    tags = report.get("tags", [])
    report_id = report.get("id", "?")

    # 取前3个字段作为摘要
    summary_fields = fields[:3] if fields else []
    text = f"📄 **报告 #{report_id}** — @{teacher}\n"

    for field in summary_fields:
        key = field["field_key"]
        label = field["field_label"]
        value = form_data.get(key)
        if value:
            text += f"  • {label}：{value[:30]}{'...' if len(value) > 30 else ''}\n"

    if tags:
        text += f"  🏷 {' '.join('#'+t for t in tags)}\n"

    return text


@router.message(F.text.regexp(r"#\w+"))
async def tag_search_handler(message: Message):
    """处理群组中的 #标签 搜索"""
    text = message.text or ""
    tags = _parse_tags_from_text(text)

    if not tags:
        return

    # 搜索匹配的报告
    reports = await search_published_reports_by_tags(tags, config.SEARCH_RESULT_LIMIT)

    if not reports:
        tags_display = " ".join(f"#{t}" for t in tags)
        await message.reply(
            f"🔍 搜索标签：{tags_display}\n\n❌ 未找到匹配的报告",
            parse_mode="Markdown",
        )
        return

    fields = await get_template_fields()
    tags_display = " ".join(f"#{t}" for t in tags)

    text = f"🔍 **搜索标签：{tags_display}**\n找到 {len(reports)} 份报告\n━━━━━━━━━━━━━━━━━━━━\n\n"

    buttons = []
    for report in reports:
        text += _format_report_summary(report, fields)
        text += "\n"
        buttons.append([
            InlineKeyboardButton(
                text=f"📄 查看报告 #{report['id']}",
                callback_data=f"search:view:{report['id']}"
            )
        ])

    kb = InlineKeyboardMarkup(inline_keyboard=buttons)
    await message.reply(text, reply_markup=kb, parse_mode="Markdown")


@router.callback_query(F.data.startswith("search:view:"))
async def view_report_callback(callback: CallbackQuery):
    """查看完整报告"""
    report_id = int(callback.data.split(":", 2)[2])

    from database import get_db
    import json

    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM published_reports WHERE id = ?",
        (report_id,),
    )
    row = await cursor.fetchone()
    if not row:
        await callback.answer("❌ 报告不存在", show_alert=True)
        return

    report = dict(row)
    report["form_data"] = json.loads(report["form_data"])
    report["tags"] = json.loads(report["tags"])

    fields = await get_template_fields()
    teacher = report["teacher_username"]
    form_data = report["form_data"]
    tags = report["tags"]

    text = (
        f"📋 **报告 #{report_id}**\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 教师：@{teacher}\n\n"
    )

    for field in fields:
        key = field["field_key"]
        label = field["field_label"]
        value = form_data.get(key, "（未填写）")
        text += f"**{label}：**{value}\n"

    if tags:
        text += f"\n🏷 标签：{' '.join('#'+t for t in tags)}"

    published_at = report.get("published_at", "")
    if published_at:
        text += f"\n📅 发布时间：{published_at[:10]}"

    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🔙 关闭", callback_data="search:close")
    ]])

    await callback.message.answer(text, reply_markup=kb, parse_mode="Markdown")
    await callback.answer()


@router.callback_query(F.data == "search:close")
async def close_report(callback: CallbackQuery):
    """关闭报告详情"""
    await callback.message.delete()
    await callback.answer()
