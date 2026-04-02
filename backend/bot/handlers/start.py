from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from sqlalchemy.ext.asyncio import AsyncSession
from bot.keyboards import get_admin_config, build_main_keyboard, build_start_inline_keyboard, build_subscribe_keyboard
from bot.middleware import check_subscription
from config import ADMIN_ID, FRONTEND_URL, API_URL


async def handle_start(update: Update, context: ContextTypes.DEFAULT_TYPE, db: AsyncSession) -> None:
    is_subscribed = await check_subscription(update, context, db)
    admin = await get_admin_config(db)

    if not is_subscribed and admin.channel_id:
        await update.message.reply_text(
            "⚠️ 请先订阅我们的频道才能使用此机器人！\n\n订阅后点击\u201c我已订阅\u201d按钮继续。",
            reply_markup=build_subscribe_keyboard(admin.channel_id),
        )
        return

    main_kb = build_main_keyboard(admin)
    inline_kb = build_start_inline_keyboard(admin)
    start_content = admin.start_content or {}
    start_text = start_content.get("text") or "欢迎使用报告管理机器人！"

    try:
        if start_content.get("mediaType") == "photo" and start_content.get("mediaUrl"):
            await update.message.reply_photo(
                start_content["mediaUrl"],
                caption=start_text,
                reply_markup=inline_kb if inline_kb else main_kb,
            )
        elif start_content.get("mediaType") == "video" and start_content.get("mediaUrl"):
            await update.message.reply_video(
                start_content["mediaUrl"],
                caption=start_text,
                reply_markup=inline_kb if inline_kb else main_kb,
            )
        else:
            await update.message.reply_text(start_text, reply_markup=inline_kb if inline_kb else main_kb)
    except Exception:
        await update.message.reply_text(start_text, reply_markup=main_kb)

    if inline_kb:
        await update.message.reply_text("请选择操作：", reply_markup=main_kb)


async def handle_check_subscription(update: Update, context: ContextTypes.DEFAULT_TYPE, db: AsyncSession) -> None:
    is_subscribed = await check_subscription(update, context, db)
    query = update.callback_query
    if is_subscribed:
        await query.answer("✅ 验证成功！")
        try:
            await query.delete_message()
        except Exception:
            pass
        await handle_start(update, context, db)
    else:
        await query.answer("❌ 尚未订阅，请先订阅频道！", show_alert=True)


async def handle_admin_panel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("❌ 你没有管理员权限。")
        return
    frontend_url = FRONTEND_URL or API_URL
    admin_url = f"{frontend_url}/admin"
    await update.message.reply_text(
        "🔧 *管理员后台*\n\n点击下方按钮进入管理配置界面：",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("⚙️ 进入管理后台", url=admin_url)]]),
    )
