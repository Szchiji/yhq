from datetime import datetime
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    ContextTypes,
    filters,
)
from sqlalchemy import select
from db import AsyncSessionLocal
from models.report import Report
from models.admin import Admin
from bot.keyboards import get_admin_config, build_subscribe_keyboard
from bot.middleware import upsert_user, check_subscription
from bot.handlers.start import handle_start, handle_check_subscription, handle_admin_panel
from bot.handlers.report import (
    handle_query_report,
    handle_write_report,
    handle_contact_admin,
    handle_help,
    handle_search_message,
)
from config import BOT_TOKEN, ADMIN_ID


async def _approve_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    report_id = context.matches[0].group(1)
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Report).where(Report.id == report_id))
        report = result.scalar_one_or_none()
        if not report:
            await query.answer("报告不存在")
            return
        report.status = "approved"
        report.reviewed_at = datetime.utcnow()
        report.reviewed_by = ADMIN_ID
        await db.commit()
        await db.refresh(report)

        admin_result = await db.execute(select(Admin).where(Admin.admin_id == ADMIN_ID))
        admin_cfg = admin_result.scalar_one_or_none()

        if admin_cfg and admin_cfg.push_channel_id:
            try:
                tags_str = " ".join(f"#{t}" for t in (report.tags or []))
                await context.bot.send_message(
                    admin_cfg.push_channel_id,
                    f"📋 *报告推送* No.{report.report_number}\n\n"
                    f"👤 @{report.username or '匿名'}\n"
                    f"📌 {report.title or '无标题'}\n\n"
                    f"{report.description or ''}\n\n"
                    f"{'🏷 ' + tags_str if tags_str else ''}",
                    parse_mode="Markdown",
                )
            except Exception as e:
                print(f"Failed to push to channel: {e}")

        approved_msg = (admin_cfg.review_feedback or {}).get("approved") if admin_cfg else None
        approved_msg = approved_msg or "✅ 你的报告已通过审核，已推送到频道。"
        try:
            await context.bot.send_message(report.user_id, approved_msg)
        except Exception:
            pass

    await query.answer("✅ 已通过审核")
    try:
        new_text = (query.message.text or "") + "\n\n✅ 已审核通过"
        await query.edit_message_text(new_text, parse_mode="Markdown")
    except Exception:
        pass


async def _reject_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    report_id = context.matches[0].group(1)
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Report).where(Report.id == report_id))
        report = result.scalar_one_or_none()
        if not report:
            await query.answer("报告不存在")
            return
        report.status = "rejected"
        report.reviewed_at = datetime.utcnow()
        report.reviewed_by = ADMIN_ID
        await db.commit()
        await db.refresh(report)

        admin_result = await db.execute(select(Admin).where(Admin.admin_id == ADMIN_ID))
        admin_cfg = admin_result.scalar_one_or_none()
        rejected_msg = (admin_cfg.review_feedback or {}).get("rejected") if admin_cfg else None
        rejected_msg = rejected_msg or "❌ 你的报告未通过审核，请修改后重新提交。"
        try:
            await context.bot.send_message(report.user_id, rejected_msg)
        except Exception:
            pass

    await query.answer("❌ 已拒绝")
    try:
        new_text = (query.message.text or "") + "\n\n❌ 已拒绝"
        await query.edit_message_text(new_text, parse_mode="Markdown")
    except Exception:
        pass


async def _start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    async with AsyncSessionLocal() as db:
        await handle_start(update, context, db)


async def _admin_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await handle_admin_panel(update, context)


async def _check_subscription_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    async with AsyncSessionLocal() as db:
        await handle_check_subscription(update, context, db)


async def _text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.message.text:
        return
    text = update.message.text.strip()

    async with AsyncSessionLocal() as db:
        try:
            await upsert_user(db, update.effective_user)
        except Exception:
            pass

        if text.startswith("@") or text.startswith("#"):
            await handle_search_message(update, context, db)
            return

        user_id = update.effective_user.id
        if user_id != ADMIN_ID:
            is_subscribed = await check_subscription(update, context, db)
            if not is_subscribed:
                admin = await get_admin_config(db)
                if admin.channel_id:
                    await update.message.reply_text(
                        "⚠️ 请先订阅我们的频道才能使用此机器人！\n\n订阅后点击\u201c我已订阅\u201d按钮继续。",
                        reply_markup=build_subscribe_keyboard(admin.channel_id),
                    )
                    return

        admin = await get_admin_config(db)
        keyboards = admin.keyboards or []
        kb = next((k for k in keyboards if k.get("text") == text), None)
        if kb:
            action = kb.get("action", "")
            if action == "write_report":
                await handle_write_report(update, context)
            elif action == "query_report":
                await handle_query_report(update, context)
            elif action == "contact_admin":
                await handle_contact_admin(update, context)
            elif action == "help":
                await handle_help(update, context)
            else:
                await update.message.reply_text(f"你点击了：{text}")


def create_bot_app() -> Application:
    app = Application.builder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", _start_command))
    app.add_handler(CommandHandler("admin", _admin_command))
    app.add_handler(CallbackQueryHandler(_check_subscription_callback, pattern="^check_subscription$"))
    app.add_handler(CallbackQueryHandler(lambda u, c: u.callback_query.answer(), pattern="^noop$"))
    app.add_handler(CallbackQueryHandler(_approve_callback, pattern=r"^approve_(.+)$"))
    app.add_handler(CallbackQueryHandler(_reject_callback, pattern=r"^reject_(.+)$"))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, _text_handler))

    async def error_handler(update, context):
        print(f"Bot error: {context.error}")

    app.add_error_handler(error_handler)
    return app
