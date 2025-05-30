import logging
from flask import Flask, request
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, InputMediaPhoto, InputMediaVideo
from telegram.ext import (
    ApplicationBuilder, ContextTypes, CommandHandler, MessageHandler, CallbackQueryHandler, filters
)
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, User, Draft, Coupon
import os

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Flask 应用
app = Flask(__name__)

# 配置
BOT_TOKEN = os.getenv("BOT_TOKEN", "7098191858:AAEOL8NazzqpCh9iJjv-YpkTUFukfEbdFyg")
WEBHOOK_URL = os.getenv("WEBHOOK_URL", "https://yhq.onrender.com")
ADMIN_ID = 7848870377
CHANNEL_ID = -1002669687216

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://yhq_user:xuG8E0b9bVDdgF8mh6zHLpVE6hOUp9g2@dpg-d0sgh4qdbo4c73f2e5rg-a/yhq"
)
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

# 状态常量
STATE_AWAIT_MEDIA = "awaiting_media"
STATE_AWAIT_QUANTITY = "awaiting_quantity"
STATE_AWAIT_PRICE = "awaiting_price"
STATE_AWAIT_LIMIT = "awaiting_limit"
STATE_CONFIRM = "confirm_publish"

# 发布会话缓存
publish_sessions = {}

# 初始化 Bot
bot_app = ApplicationBuilder().token(BOT_TOKEN).build()

# /start
async def send_welcome(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    username = update.effective_user.username
    full_name = update.effective_user.full_name
    with SessionLocal() as db:
        user = db.query(User).filter(User.telegram_id == telegram_id).first()
        if not user:
            user = User(telegram_id=telegram_id, username=username)
            db.add(user)
            db.commit()
            await context.bot.send_message(chat_id=ADMIN_ID, text=f"📥 用户申请发布权限：\n用户名：@{username}\n昵称：{full_name}")
        if user.is_member:
            await update.message.reply_text("欢迎回来，您已获得发布权限。发送 /publish 开始发布。")
        else:
            await update.message.reply_text("您尚未获得发布权限，请等待管理员审核。")

# 管理员命令：添加会员
async def add_member(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("无权限")
        return
    if not context.args:
        await update.message.reply_text("用法：/add_member 用户名（不带 @）")
        return
    username = context.args[0].lstrip("@")
    with SessionLocal() as db:
        user = db.query(User).filter(User.username == username).first()
        if user:
            user.is_member = True
            db.commit()
            await update.message.reply_text(f"✅ 已授权 @{username} 成为会员。")
        else:
            await update.message.reply_text(f"未找到用户 @{username}。")

# /publish 开始发布
async def start_publish(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    with SessionLocal() as db:
        user = db.query(User).filter(User.telegram_id == telegram_id).first()
        if not user or not user.is_member:
            await update.message.reply_text("您未被授权发布内容。")
            return
        user.status = STATE_AWAIT_MEDIA
        db.commit()
    publish_sessions[telegram_id] = {
        "coupons": [],
        "current_coupon": {},
        "media_file_id": None,
        "media_type": None
    }
    await update.message.reply_text("请发送一张照片或视频。")

# 消息处理
async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    text = update.message.text or ""
    with SessionLocal() as db:
        user = db.query(User).filter(User.telegram_id == telegram_id).first()
        if not user or not user.is_member:
            await update.message.reply_text("您未被授权发布内容。")
            return
        state = user.status
        session = publish_sessions.get(telegram_id)
        if not session:
            await update.message.reply_text("请先使用 /publish 开始发布。")
            return
        if state == STATE_AWAIT_MEDIA:
            if update.message.photo:
                file_id = update.message.photo[-1].file_id
                media_type = "photo"
            elif update.message.video:
                file_id = update.message.video.file_id
                media_type = "video"
            else:
                await update.message.reply_text("请发送一张照片或视频。")
                return
            session["media_file_id"] = file_id
            session["media_type"] = media_type
            user.status = STATE_AWAIT_QUANTITY
            db.commit()
            await update.message.reply_text("请输入优惠券数量。")
        elif state == STATE_AWAIT_QUANTITY:
            if not text.isdigit():
                await update.message.reply_text("请输入数字。")
                return
            session["current_coupon"]["quantity"] = int(text)
            user.status = STATE_AWAIT_PRICE
            db.commit()
            await update.message.reply_text("请输入价格。")
        elif state == STATE_AWAIT_PRICE:
            session["current_coupon"]["price"] = text
            user.status = STATE_AWAIT_LIMIT
            db.commit()
            await update.message.reply_text("请输入限制（如：限 P / 限 PP / 通用）。")
        elif state == STATE_AWAIT_LIMIT:
            session["current_coupon"]["limit_type"] = text
            session["coupons"].append(session["current_coupon"])
            session["current_coupon"] = {}
            user.status = STATE_CONFIRM
            db.commit()
            keyboard = [
                [InlineKeyboardButton("继续添加", callback_data="add_more")],
                [InlineKeyboardButton("完成发布", callback_data="finish")]
            ]
            await update.message.reply_text("已添加优惠券。请选择：", reply_markup=InlineKeyboardMarkup(keyboard))

# 按钮处理
async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    telegram_id = query.from_user.id
    await query.answer()
    data = query.data
    with SessionLocal() as db:
        user = db.query(User).filter(User.telegram_id == telegram_id).first()
        session = publish_sessions.get(telegram_id)
        if not user or not session:
            await query.edit_message_text("会话已过期，请重新开始。")
            return
        if data == "add_more":
            user.status = STATE_AWAIT_QUANTITY
            db.commit()
            await query.edit_message_text("请输入优惠券数量。")
        elif data == "finish":
            user.status = ""
            db.commit()
            media = session["media_file_id"]
            mtype = session["media_type"]
            text = "\n".join(
                f"{i+1}. 数量: {c['quantity']}，价格: {c['price']}，限制: {c['limit_type']}"
                for i, c in enumerate(session["coupons"])
            )
            caption = f"【发布预览】\n{text}\n\n请选择操作："
            keyboard = InlineKeyboardMarkup([
                [InlineKeyboardButton("发布", callback_data="publish")],
                [InlineKeyboardButton("取消", callback_data="cancel")]
            ])
            media_obj = InputMediaPhoto(media=media, caption=caption) if mtype == "photo" else InputMediaVideo(media=media, caption=caption)
            await query.edit_message_media(media=media_obj, reply_markup=keyboard)
        elif data == "publish":
            media = session["media_file_id"]
            mtype = session["media_type"]
            text = "\n".join(
                f"{i+1}. 数量: {c['quantity']}，价格: {c['price']}，限制: {c['limit_type']}"
                for i, c in enumerate(session["coupons"])
            )
            caption = f"📢 优惠券发布\n{text}"
            if mtype == "photo":
                await context.bot.send_photo(chat_id=CHANNEL_ID, photo=media, caption=caption)
            else:
                await context.bot.send_video(chat_id=CHANNEL_ID, video=media, caption=caption)
            await query.edit_message_text("✅ 已发布到频道。")
            del publish_sessions[telegram_id]
        elif data == "cancel":
            user.status = ""
            db.commit()
            await query.edit_message_text("❌ 发布已取消。")
            del publish_sessions[telegram_id]

# Webhook 路由
@app.route(f"/{BOT_TOKEN}", methods=["POST"])
async def webhook() -> str:
    await bot_app.update_queue.put(Update.de_json(request.get_json(force=True), bot_app.bot))
    return "OK"

# 设置 Webhook
@app.before_first_request
def setup_webhook():
    import asyncio
    asyncio.create_task(bot_app.bot.set_webhook(url=f"{WEBHOOK_URL}/{BOT_TOKEN}"))

# 添加处理器
bot_app.add_handler(CommandHandler("start", send_welcome))
bot_app.add_handler(CommandHandler("publish", start_publish))
bot_app.add_handler(CommandHandler("add_member", add_member))
bot_app.add_handler(MessageHandler(filters.TEXT | filters.PHOTO | filters.VIDEO, handle_message))
bot_app.add_handler(CallbackQueryHandler(button_handler))

# 启动 Flask
if __name__ == "__main__":
    app.run(port=5000)