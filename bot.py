import os
import json
import logging
from datetime import datetime, timedelta
from flask import Flask, request
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, ApplicationBuilder, CommandHandler, MessageHandler, CallbackQueryHandler,
    ContextTypes, filters
)

# Logging
logging.basicConfig(
    format='%(asctime)s - %(levelname)s - %(message)s',
    level=logging.INFO,
)

# 环境变量
BOT_TOKEN = os.getenv("BOT_TOKEN")
CHANNEL_ID = int(os.getenv("CHANNEL_ID"))
ADMIN_ID = int(os.getenv("ADMIN_ID"))
RENDER_EXTERNAL_URL = os.getenv("RENDER_EXTERNAL_URL", "").strip().rstrip("/")

if not BOT_TOKEN or not CHANNEL_ID or not ADMIN_ID or not RENDER_EXTERNAL_URL.startswith("https://"):
    raise ValueError("请正确设置环境变量：BOT_TOKEN、CHANNEL_ID、ADMIN_ID、RENDER_EXTERNAL_URL（HTTPS）")

# 文件和状态
DATA_FILE = "data.json"
user_states = {}

# Flask App
flask_app = Flask(__name__)
application: Application = ApplicationBuilder().token(BOT_TOKEN).build()


# --- 数据读写 ---
def load_data():
    if not os.path.exists(DATA_FILE):
        data = {
            "whitelist": {},
            "banlist": [],
            "config": {
                "template": "数量：{quantity}\n价格：{price}\n限制：{limit_type}"
            }
        }
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f)
    else:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    return data

def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# --- 权限判断 ---
async def is_banned(user_id):
    return user_id in load_data().get("banlist", [])

async def is_whitelisted(user_id):
    expires_str = load_data().get("whitelist", {}).get(str(user_id))
    if expires_str:
        return datetime.fromisoformat(expires_str) > datetime.utcnow()
    return False

# --- 命令和回调 ---
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if await is_banned(user_id):
        await update.message.reply_text("您已被封禁。")
        return
    if await is_whitelisted(user_id):
        await update.message.reply_text("您已获得发布权限。发送 /publish 开始发布。")
        return
    keyboard = [[InlineKeyboardButton("申请发布权限", callback_data=f"apply_{user_id}")]]
    await update.message.reply_text("请点击下方按钮申请发布权限：", reply_markup=InlineKeyboardMarkup(keyboard))

async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data
    if data.startswith("apply_"):
        user_id = int(data.split("_")[1])
        if query.from_user.id != user_id:
            await query.edit_message_text("您无权申请此权限。")
            return
        keyboard = [
            [InlineKeyboardButton("同意", callback_data=f"approve_{user_id}"),
             InlineKeyboardButton("拒绝", callback_data=f"reject_{user_id}")]
        ]
        await context.bot.send_message(
            chat_id=ADMIN_ID,
            text=f"用户 {user_id} 申请发布权限，是否同意？",
            reply_markup=InlineKeyboardMarkup(keyboard),
        )
        await query.edit_message_text("申请已提交，请等待审核。")

    elif data.startswith("approve_"):
        user_id = int(data.split("_")[1])
        data_json = load_data()
        data_json["whitelist"][str(user_id)] = (datetime.utcnow() + timedelta(days=30)).isoformat()
        save_data(data_json)
        await context.bot.send_message(chat_id=user_id, text="您的发布权限已被批准，有效期30天。")
        await query.edit_message_text("已批准。")

    elif data.startswith("reject_"):
        user_id = int(data.split("_")[1])
        await context.bot.send_message(chat_id=user_id, text="您的发布权限申请被拒绝。")
        await query.edit_message_text("已拒绝。")

async def ban(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("您无权执行此操作。")
        return
    if not context.args:
        await update.message.reply_text("请提供要封禁的用户ID。")
        return
    try:
        user_id = int(context.args[0])
        data = load_data()
        if user_id not in data["banlist"]:
            data["banlist"].append(user_id)
            save_data(data)
        await update.message.reply_text(f"已封禁用户 {user_id}。")
    except:
        await update.message.reply_text("用户ID格式错误。")

async def publish(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if await is_banned(user_id):
        await update.message.reply_text("您已被封禁。")
        return
    if not await is_whitelisted(user_id):
        await update.message.reply_text("您没有发布权限。")
        return
    user_states[user_id] = {"step": "awaiting_media"}
    await update.message.reply_text("请发送一张照片或一个视频。")

async def media_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = update.message
    user_id = msg.from_user.id
    if user_id not in user_states or user_states[user_id].get("step") != "awaiting_media":
        return
    if msg.photo:
        user_states[user_id].update({
            "media_type": "photo",
            "file_id": msg.photo[-1].file_id,
            "step": "awaiting_quantity_price",
        })
    elif msg.video:
        user_states[user_id].update({
            "media_type": "video",
            "file_id": msg.video.file_id,
            "step": "awaiting_quantity_price",
        })
    else:
        await msg.reply_text("请发送照片或视频。")
        return
    await msg.reply_text("请发送数量和价格，用英文逗号分隔，如：3,100")

async def text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    state = user_states.get(user_id)
    if not state:
        return
    msg = update.message
    if state.get("step") == "awaiting_quantity_price":
        try:
            quantity, price = map(str.strip, msg.text.split(","))
            state.update({"quantity": quantity, "price": price, "step": "awaiting_limit_type"})
            keyboard = [
                [InlineKeyboardButton("P", callback_data="limit_P"),
                 InlineKeyboardButton("PP", callback_data="limit_PP"),
                 InlineKeyboardButton("通用", callback_data="limit_general")]
            ]
            await msg.reply_text("请选择限制类型：", reply_markup=InlineKeyboardMarkup(keyboard))
        except:
            await msg.reply_text("格式错误，请发送：数量,价格")
    elif state.get("step") == "awaiting_confirmation":
        if msg.text.strip() == "是":
            template = load_data()["config"]["template"]
            caption = template.format(
                quantity=state["quantity"], price=state["price"], limit_type=state["limit_type"]
            )
            if state["media_type"] == "photo":
                await context.bot.send_photo(chat_id=CHANNEL_ID, photo=state["file_id"], caption=caption)
            else:
                await context.bot.send_video(chat_id=CHANNEL_ID, video=state["file_id"], caption=caption)
            await msg.reply_text("发布成功！")
        else:
            await msg.reply_text("发布取消。")
        user_states.pop(user_id, None)

async def limit_type_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    state = user_states.get(user_id)
    if not state:
        await query.edit_message_text("会话已过期，请重新发送 /publish")
        return
    limit_map = {"limit_P": "P", "limit_PP": "PP", "limit_general": "通用"}
    state["limit_type"] = limit_map.get(query.data, "通用")
    state["step"] = "awaiting_confirmation"
    await query.edit_message_text(
        f"确认发布？\n数量：{state['quantity']}\n价格：{state['price']}\n限制：{state['limit_type']}\n\n回复“是”确认"
    )

# --- Webhook 路由 ---
@flask_app.post(f"/{BOT_TOKEN}")
async def webhook_handler():
    await application.update_queue.put(Update.de_json(request.get_json(force=True), application.bot))
    return "OK"

# --- 初始化 ---
async def main():
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("publish", publish))
    application.add_handler(CommandHandler("ban", ban))
    application.add_handler(CallbackQueryHandler(button_handler, pattern="^(apply_|approve_|reject_)"))
    application.add_handler(CallbackQueryHandler(limit_type_handler, pattern="^limit_"))
    application.add_handler(MessageHandler(filters.PHOTO | filters.VIDEO, media_handler))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_handler))

    webhook_url = f"{RENDER_EXTERNAL_URL}/{BOT_TOKEN}"
    await application.bot.set_webhook(webhook_url)
    await application.initialize()
    await application.start()
    logging.info(f"✅ Webhook 已设置为：{webhook_url}")

import asyncio
if __name__ == "__main__":
    asyncio.run(main())
    flask_app.run(host="0.0.0.0", port=10000)