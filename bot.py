 import os
import logging
from datetime import datetime, timedelta

from flask import Flask, request
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)
import asyncio
import asyncpg
from dotenv import load_dotenv

load_dotenv()

# 初始化
TOKEN = os.getenv("BOT_TOKEN")
ADMIN_ID = int(os.getenv("ADMIN_ID"))
CHANNEL_ID = int(os.getenv("CHANNEL_ID"))

app = Flask(__name__)

# 状态与数据库
user_states = {}
db_pool = None
application = None

# 日志
logging.basicConfig(level=logging.INFO)


# 初始化数据库
async def init_db():
    global db_pool
    db_pool = await asyncpg.create_pool(os.getenv("DATABASE_URL"))
    async with db_pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS whitelist (
                user_id BIGINT PRIMARY KEY,
                expires_at TIMESTAMP
            );
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS banlist (
                user_id BIGINT PRIMARY KEY
            );
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS config (
                id SERIAL PRIMARY KEY,
                template TEXT
            );
        """)


# 白名单检查
async def is_whitelisted(user_id):
    async with db_pool.acquire() as conn:
        result = await conn.fetchrow("SELECT expires_at FROM whitelist WHERE user_id = $1", user_id)
        return result and result['expires_at'] > datetime.utcnow()


# 封禁检查
async def is_banned(user_id):
    async with db_pool.acquire() as conn:
        result = await conn.fetchrow("SELECT 1 FROM banlist WHERE user_id = $1", user_id)
        return result is not None


# /start 命令
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if await is_banned(user_id):
        await update.message.reply_text("您已被封禁。")
        return
    if await is_whitelisted(user_id):
        await update.message.reply_text("您已获得发布权限。")
        return
    keyboard = [[InlineKeyboardButton("申请发布权限", callback_data=f"apply_{user_id}")]]
    await update.message.reply_text("请点击按钮申请发布权限：", reply_markup=InlineKeyboardMarkup(keyboard))


# 处理按钮事件
async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data

    if data.startswith("apply_"):
        user_id = int(data.split("_")[1])
        if query.from_user.id != user_id:
            await query.edit_message_text("您无权操作此申请。")
            return
        keyboard = [[
            InlineKeyboardButton("同意", callback_data=f"approve_{user_id}"),
            InlineKeyboardButton("拒绝", callback_data=f"reject_{user_id}")
        ]]
        await context.bot.send_message(
            chat_id=ADMIN_ID,
            text=f"用户 {user_id} 申请发布权限，是否同意？",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
        await query.edit_message_text("申请已提交，等待管理员审核。")

    elif data.startswith("approve_"):
        user_id = int(data.split("_")[1])
        expires = datetime.utcnow() + timedelta(days=30)
        async with db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO whitelist (user_id, expires_at) 
                VALUES ($1, $2)
                ON CONFLICT (user_id) DO UPDATE SET expires_at = $2
            """, user_id, expires)
        await context.bot.send_message(chat_id=user_id, text="您的发布权限已批准，有效期30天。")
        await query.edit_message_text("已批准。")

    elif data.startswith("reject_"):
        user_id = int(data.split("_")[1])
        await context.bot.send_message(chat_id=user_id, text="您的发布权限申请被拒绝。")
        await query.edit_message_text("已拒绝。")


# /publish 命令
async def publish(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if await is_banned(user_id):
        await update.message.reply_text("您已被封禁。")
        return
    if not await is_whitelisted(user_id):
        await update.message.reply_text("您未获得发布权限。")
        return
    user_states[user_id] = {'step': 'awaiting_media'}
    await update.message.reply_text("请发送一张照片或视频。")


# 媒体消息处理
async def media_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    state = user_states.get(user_id)
    if not state or state['step'] != 'awaiting_media':
        return

    if update.message.photo:
        file_id = update.message.photo[-1].file_id
        media_type = 'photo'
    elif update.message.video:
        file_id = update.message.video.file_id
        media_type = 'video'
    else:
        await update.message.reply_text("请发送一张照片或一个视频。")
        return

    state.update({
        'media_type': media_type,
        'file_id': file_id,
        'step': 'awaiting_quantity_price'
    })
    await update.message.reply_text("请输入数量与价格，例如：3,100")


# 文本处理
async def text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    state = user_states.get(user_id)
    if not state:
        return

    if state['step'] == 'awaiting_quantity_price':
        try:
            quantity, price = map(str.strip, update.message.text.split(","))
            state.update({
                'quantity': quantity,
                'price': price,
                'step': 'awaiting_limit_type'
            })
            keyboard = [[
                InlineKeyboardButton("P", callback_data="limit_P"),
                InlineKeyboardButton("PP", callback_data="limit_PP"),
                InlineKeyboardButton("通用", callback_data="limit_general")
            ]]
            await update.message.reply_text("请选择限制类型：", reply_markup=InlineKeyboardMarkup(keyboard))
        except:
            await update.message.reply_text("格式错误，请发送：数量,价格（如：3,100）")

    elif state['step'] == 'awaiting_confirmation':
        if update.message.text.lower() == '是':
            async with db_pool.acquire() as conn:
                config = await conn.fetchrow("SELECT template FROM config ORDER BY id DESC LIMIT 1")
            template = config['template'] if config else "数量：{quantity}\n价格：{price}\n限制：{limit_type}"
            caption = template.format(**state)

            if state['media_type'] == 'photo':
                await context.bot.send_photo(CHANNEL_ID, photo=state['file_id'], caption=caption)
            else:
                await context.bot.send_video(CHANNEL_ID, video=state['file_id'], caption=caption)
            await update.message.reply_text("发布成功！")
            user_states.pop(user_id, None)
        else:
            await update.message.reply_text("发布已取消。")
            user_states.pop(user_id, None)


# 限制按钮
async def limit_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    state = user_states.get(user_id)
    if not state:
        return
    state['limit_type'] = query.data.replace("limit_", "")
    state['step'] = 'awaiting_confirmation'
    preview = f"数量：{state['quantity']}\n价格：{state['price']}\n限制：{state['limit_type']}"
    await query.message.reply_text(f"请确认是否发布以下内容（发送“是”确认）：\n\n{preview}")


# 设置 webhook 路由
@app.route("/webhook", methods=["POST"])
def webhook():
    update = Update.de_json(request.get_json(force=True), application.bot)
    asyncio.run(application.process_update(update))
    return "ok"


# 初始化 bot
async def main():
    global application
    application = Application.builder().token(TOKEN).build()

    await init_db()

    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("publish", publish))
    application.add_handler(CallbackQueryHandler(button_handler, pattern="^(apply_|approve_|reject_)"))
    application.add_handler(CallbackQueryHandler(limit_handler, pattern="^limit_"))
    application.add_handler(MessageHandler(filters.PHOTO | filters.VIDEO, media_handler))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_handler))

    await application.initialize()
    await application.start()
    await application.updater.start_polling()


if __name__ == "__main__":
    asyncio.run(main())