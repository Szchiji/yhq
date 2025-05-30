import logging
from flask import Flask, request
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, InputMediaPhoto, InputMediaVideo
from telegram.ext import (
    ApplicationBuilder, ContextTypes, CommandHandler, MessageHandler, filters, CallbackQueryHandler
)
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, User, Draft, Coupon

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Flask 应用
app = Flask(__name__)

# Telegram Bot Token
BOT_TOKEN = "7098191858:AAEOL8NazzqpCh9iJjv-YpkTUFukfEbdFyg"

# 数据库配置
DATABASE_URL = "postgresql://yhq_user:xuG8E0b9bVDdgF8mh6zHLpVE6hOUp9g2@dpg-d0sgh4qdbo4c73f2e5rg-a/yhq"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

# 用户状态
user_states = {}

# 发布会话缓存
publish_sessions = {}

# 状态常量
STATE_AWAIT_MEDIA = "awaiting_media"
STATE_AWAIT_QUANTITY = "awaiting_quantity"
STATE_AWAIT_PRICE = "awaiting_price"
STATE_AWAIT_LIMIT = "awaiting_limit"
STATE_CONFIRM = "confirm_publish"

# 开始命令处理
async def send_welcome(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    username = update.effective_user.username
    with SessionLocal() as db:
        user = db.query(User).filter(User.telegram_id == telegram_id).first()
        if not user:
            user = User(telegram_id=telegram_id, username=username, is_member=False)
            db.add(user)
            db.commit()
        if user.is_member:
            await update.message.reply_text("欢迎会员，您可以发送 /publish 开始发布内容。")
        else:
            await update.message.reply_text("您好，您当前未被审核为会员，请等待管理员审核。")

# 发布命令处理
async def start_publish(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    with SessionLocal() as db:
        user = db.query(User).filter(User.telegram_id == telegram_id).first()
        if not user or not user.is_member:
            await update.message.reply_text("抱歉，您不是会员，没有发布权限。")
            return
        user.status = STATE_AWAIT_MEDIA
        db.commit()
    publish_sessions[telegram_id] = {
        "coupons": [],
        "current_coupon": {},
        "media_file_id": None,
        "media_type": None
    }
    await update.message.reply_text("请发送一张照片或者视频开始发布。")

# 消息处理
async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    text = update.message.text if update.message.text else ""
    with SessionLocal() as db:
        user = db.query(User).filter(User.telegram_id == telegram_id).first()
        if not user or not user.is_member:
            await update.message.reply_text("您未被授权发布内容。")
            return
        state = user.status
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
            publish_sessions[telegram_id]["media_file_id"] = file_id
            publish_sessions[telegram_id]["media_type"] = media_type
            user.status = STATE_AWAIT_QUANTITY
            db.commit()
            await update.message.reply_text("请发送优惠券数量。")
        elif state == STATE_AWAIT_QUANTITY:
            if not text.isdigit():
                await update.message.reply_text("请输入优惠券数量（数字）。")
                return
            publish_sessions[telegram_id]["current_coupon"]["quantity"] = int(text)
            user.status = STATE_AWAIT_PRICE
            db.commit()
            await update.message.reply_text("请发送优惠券价格。")
        elif state == STATE_AWAIT_PRICE:
            if not text:
                await update.message.reply_text("请输入优惠券价格。")
                return
            publish_sessions[telegram_id]["current_coupon"]["price"] = text
            user.status = STATE_AWAIT_LIMIT
            db.commit()
            await update.message.reply_text("请发送限制类型（如：限 P / 限 PP / 通用）。")
        elif state == STATE_AWAIT_LIMIT:
            if not text:
                await update.message.reply_text("请输入限制类型（如：限 P / 限 PP / 通用）。")
                return
            publish_sessions[telegram_id]["current_coupon"]["limit_type"] = text
            coupon = publish_sessions[telegram_id]["current_coupon"]
            publish_sessions[telegram_id]["coupons"].append(coupon)
            publish_sessions[telegram_id]["current_coupon"] = {}
            user.status = STATE_CONFIRM
            db.commit()
            keyboard = [
                [InlineKeyboardButton("继续添加", callback_data="add_more")],
                [InlineKeyboardButton("完成发布", callback_data="finish")]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            await update.message.reply_text("优惠券已添加，是否继续添加？", reply_markup=reply_markup)
        else:
            await update.message.reply_text("请使用 /publish 命令开始发布流程。")

# 按钮处理
async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    telegram_id = query.from_user.id
    await query.answer()
    with SessionLocal() as db:
        user = db.query(User).filter(User.telegram_id == telegram_id).first()
        if not user:
            await query.edit_message_text("用户信息未找到。")
            return
        if query.data == "add_more":
            user.status = STATE_AWAIT_QUANTITY
            db.commit()
            await query.edit_message_text("请发送优惠券数量。")
        elif query.data == "finish":
            user.status = ""
            db.commit()
            session = publish_sessions.get(telegram_id)
            if not session:
                await query.edit_message_text("发布会话超时，请重新开始。")
                return
            media_type = session["media_type"]
            media_file_id = session["media_file_id"]
            coupon_texts = []
            for i, c in enumerate(session["coupons"], 1):
                coupon_texts.append(
                    f"{i}. 数量: {c['quantity']}，价格: {c['price']}，限制: {c['limit_type']}"
                )
            coupons_str = "\n".join(coupon_texts)
            preview_text = f"【发布预览】\n\n媒体类型：{media_type}\n优惠券列表：\n{coupons_str}\n\n选择发布或取消。"
            keyboard = [
                [InlineKeyboardButton("发布", callback_data="publish")],
                [InlineKeyboardButton("取消", callback_data="cancel")]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            if media_type == "photo":
                await query.edit_message_media(
                    media=InputMediaPhoto(media=media_file_id, caption=preview_text),
                    reply_markup=reply_markup
                )
            elif media_type == "video":
                await query.edit_message_media(
                    media=InputMediaVideo(media=media_file_id, caption=preview_text),
                    reply_markup=reply_markup
                )
        elif query.data == "publish":
            session = publish_sessions.get(telegram_id)
            if not session:
                await query.edit_message_text("发布 