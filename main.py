import os
import logging
import asyncio
from datetime import datetime, timedelta

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, InputMediaPhoto, InputMediaVideo
from telegram.ext import (
    ApplicationBuilder,
    ContextTypes,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    filters,
)
import asyncpg
from dotenv import load_dotenv

load_dotenv()

# 配置日志
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# 环境变量
BOT_TOKEN = os.getenv("BOT_TOKEN")
CHANNEL_ID = int(os.getenv("CHANNEL_ID"))
ADMIN_ID = int(os.getenv("ADMIN_ID"))
DATABASE_URL = os.getenv("DATABASE_URL")

# 数据库连接池
db_pool = None

# 发布流程状态
user_states = {}

async def init_db():
    global db_pool
    db_pool = await asyncpg.create_pool(DATABASE_URL)
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

# 检查用户是否在白名单中
async def is_whitelisted(user_id):
    async with db_pool.acquire() as conn:
        result = await conn.fetchrow("SELECT expires_at FROM whitelist WHERE user_id = $1", user_id)
        if result:
            return result['expires_at'] > datetime.utcnow()
        return False

# 检查用户是否被封禁
async def is_banned(user_id):
    async with db_pool.acquire() as conn:
        result = await conn.fetchrow("SELECT 1 FROM banlist WHERE user_id = $1", user_id)
        return result is not None

# /start 命令处理
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if await is_banned(user_id):
        await update.message.reply_text("您已被封禁，无法使用此机器人。")
        return
    if await is_whitelisted(user_id):
        await update.message.reply_text("您已获得发布权限。")
        return
    # 发送申请按钮
    keyboard = [
        [InlineKeyboardButton("申请发布权限", callback_data=f"apply_{user_id}")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text("请点击下方按钮申请发布权限：", reply_markup=reply_markup)

# 处理回调查询
async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data
    if data.startswith("apply_"):
        user_id = int(data.split("_")[1])
        if query.from_user.id != user_id:
            await query.edit_message_text("您无权申请此权限。")
            return
        # 通知管理员审核
        keyboard = [
            [
                InlineKeyboardButton("同意", callback_data=f"approve_{user_id}"),
                InlineKeyboardButton("拒绝", callback_data=f"reject_{user_id}")
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await context.bot.send_message(
            chat_id=ADMIN_ID,
            text=f"用户 {user_id} 申请发布权限，是否同意？",
            reply_markup=reply_markup
        )
        await query.edit_message_text("已提交申请，请等待管理员审核。")
    elif data.startswith("approve_"):
        user_id = int(data.split("_")[1])
        expires_at = datetime.utcnow() + timedelta(days=30)
        async with db_pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO whitelist (user_id, expires_at) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET expires_at = $2",
                user_id, expires_at
            )
        await context.bot.send_message(chat_id=user_id, text="您的发布权限已被批准，有效期30天。")
        await query.edit_message_text("已批准用户的发布权限。")
    elif data.startswith("reject_"):
        user_id = int(data.split("_")[1])
        await context.bot.send_message(chat_id=user_id, text="您的发布权限申请被拒绝。")
        await query.edit_message_text("已拒绝用户的发布权限。")

# /ban 命令处理
async def ban(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("您无权执行此操作。")
        return
    if not context.args:
        await update.message.reply_text("请提供要封禁的用户ID。")
        return
    user_id = int(context.args[0])
    async with db_pool.acquire() as conn:
        await conn.execute("INSERT INTO banlist (user_id) VALUES ($1) ON CONFLICT DO NOTHING", user_id)
    await update.message.reply_text(f"已封禁用户 {user_id}。")

# /publish 命令处理
async def publish(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if await is_banned(user_id):
        await update.message.reply_text("您已被封禁，无法发布内容。")
        return
    if not await is_whitelisted(user_id):
        await update.message.reply_text("您未获得发布权限，请先申请。")
        return
    user_states[user_id] = {'step': 'awaiting_media'}
    await update.message.reply_text("请发送一张照片或一个视频。")

# 处理媒体消息
async def media_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if user_id not in user_states or user_states[user_id]['step'] != 'awaiting_media':
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
    user_states[user_id].update({
        'media_type': media_type,
        'file_id': file_id,
        'step': 'awaiting_quantity_price'
    })
    await update.message.reply_text("请发送优惠券数量和价格，格式为：数量,价格（例如：3,100）")

# 处理文本消息
async def text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if user_id not in user_states:
        return
    state = user_states[user_id]
    if state['step'] == 'awaiting_quantity_price':
        try:
            quantity, price = map(str.strip, update.message.text.split(","))
            state.update({
                'quantity': quantity,
                'price': price,
                'step': 'awaiting_limit_type'
            })
            keyboard = [
                [
                    InlineKeyboardButton("P", callback_data="limit_P"),
                    InlineKeyboardButton("PP", callback_data="limit_PP"),
                    InlineKeyboardButton("通用", callback_data="limit_general")
                ]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            await update.message.reply_text("请选择优惠券限制类型：", reply_markup=reply_markup)
        except:
            await update.message.reply_text("格式错误，请发送数量和价格，格式为：数量,价格（例如：3,100）")
    elif state['step'] == 'awaiting_confirmation':
        if update.message.text.lower() == '是':
            # 发布到频道
            async with db_pool.acquire() as conn:
                result = await conn.fetchrow("SELECT template FROM config ORDER BY id DESC LIMIT 1")
                template = result['template'] if result else "数量：{quantity}\n价格：{price}\n限制：{limit_type}"
            caption = template.format(
                quantity=state['quantity'],
                price=state['price'],
                limit_type=state['limit_type']
            )
            if state['media_type'] == 'photo':
                await context.bot.send_photo(chat_id=CHANNEL_ID, photo=state['file_id'], caption=caption)
            else:
                await context.bot.send_video(chat_id=CHANNEL_ID, video=state['file_id'], caption=caption)
            await33
