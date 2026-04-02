import re
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from models.report import Report
from config import FRONTEND_URL, API_URL


def _format_report_list(reports: list, title: str) -> str:
    text = f"📋 *{title}*\n共找到 {len(reports)} 份报告\n\n"
    for i, r in enumerate(reports):
        date = r.created_at.strftime("%Y/%m/%d") if r.created_at else ""
        text += f"*{i+1}. {r.title or '无标题'}* (No.{r.report_number})\n"
        text += f"👤 @{r.username or '匿名'} | 📅 {date}\n"
        if r.tags:
            text += f"🏷 {' '.join('#'+t for t in r.tags)}\n"
        if r.description:
            desc = r.description[:80] + "..." if len(r.description) > 80 else r.description
            text += f"📝 {desc}\n"
        text += "\n"
    return text


async def handle_query_report(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "🔍 *查阅报告*\n\n请发送查询内容：\n\n"
        "• 发送 `@用户名` 查询该用户的报告\n"
        "• 发送 `#标签` 查询相关标签的报告\n\n"
        "例如：`@zhangsan` 或 `#项目报告`",
        parse_mode="Markdown",
    )


async def search_by_username(update: Update, context: ContextTypes.DEFAULT_TYPE, db: AsyncSession) -> None:
    raw = update.message.text.strip()
    clean = raw.lstrip("@")[:64]
    result = await db.execute(
        select(Report)
        .where(Report.status == "approved")
        .where(func.lower(Report.username) == clean.lower())
        .order_by(Report.created_at.desc())
        .limit(10)
    )
    reports = result.scalars().all()
    if not reports:
        await update.message.reply_text(f"📭 未找到用户 @{clean} 的报告。")
        return
    text = _format_report_list(reports, f"@{clean} 的报告")
    await update.message.reply_text(text, parse_mode="Markdown", disable_web_page_preview=True)


async def search_by_tag(update: Update, context: ContextTypes.DEFAULT_TYPE, db: AsyncSession) -> None:
    raw = update.message.text.strip()
    clean = raw.lstrip("#")[:64]
    result = await db.execute(
        select(Report)
        .where(Report.status == "approved")
        .where(func.lower(func.array_to_string(Report.tags, ",")).contains(clean.lower()))
        .order_by(Report.created_at.desc())
        .limit(10)
    )
    reports = result.scalars().all()
    if not reports:
        await update.message.reply_text(f"📭 未找到标签 #{clean} 的报告。")
        return
    text = _format_report_list(reports, f"#{clean} 的报告")
    await update.message.reply_text(text, parse_mode="Markdown", disable_web_page_preview=True)


async def handle_search_message(update: Update, context: ContextTypes.DEFAULT_TYPE, db: AsyncSession) -> None:
    text = update.message.text.strip()
    if text.startswith("@"):
        await search_by_username(update, context, db)
    elif text.startswith("#"):
        await search_by_tag(update, context, db)


async def handle_write_report(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    frontend_url = FRONTEND_URL or API_URL
    report_url = f"{frontend_url}/report?userId={user_id}"
    await update.message.reply_text(
        "📝 *填写报告*\n\n点击下方按钮进入报告填写页面：",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("📝 填写报告", url=report_url)]]),
    )


async def handle_contact_admin(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text("📞 *联系管理员*\n\n如有问题请联系管理员。", parse_mode="Markdown")


async def handle_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "❓ *操作帮助*\n\n"
        "• 📝 写报告 - 进入 Mini App 填写并提交报告\n"
        "• 🔍 查阅报告 - 搜索已审核通过的报告\n"
        "  - 发送 `@用户名` 按用户搜索\n"
        "  - 发送 `#标签` 按标签搜索\n"
        "• 📞 联系管理员 - 获取管理员联系方式\n\n"
        "如有其他问题，请联系管理员。",
        parse_mode="Markdown",
    )
