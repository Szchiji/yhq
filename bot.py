import os
import json
import logging
from datetime import datetime, timedelta
from flask import Flask, request, Response
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, MessageHandler, CallbackQueryHandler,
    ContextTypes, filters
)

# 日志设置
logging.basicConfig(level=logging.INFO)

# 环境变量
BOT_TOKEN = os.getenv("BOT_TOKEN")
CHANNEL_ID = int(os.getenv("CHANNEL_ID"))
ADMIN_ID = int(os.getenv("ADMIN_ID"))

DATA_FILE = "data.json"
WEBHOOK_PATH = "/webhook"

# Flask 应用初始化
app = Flask(__name__)

# 用户状态缓存
user_states = {}

# 加载/保存数据
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

# 权限判断
async def is_banned(user_id): return user_id in load_data()["banlist"]
async def is_whitelisted(user_id):
    data = load_data()["whitelist"].get(str(user_id))
    return datetime.fromisoformat(data) > datetime.utcnow() if data else False

# 命令和回调处理
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if await is_banned(user_id):
        await update.message.reply_text("您已被封禁，无法使用此机器人。")
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
        keyboard = [[
            InlineKeyboardButton("同意", callback_data=f"approve_{user_id}"),
            InlineKeyboardButton("拒绝", callback_data=f"reject_{user_id}")
        ]]
        await context.bot.send_message(chat_id=ADMIN_ID,
            text=f"用户 {user_id} 申请发布权限，是否同意？",
            reply_markup=InlineKeyboardMarkup(keyboard))
        await query.edit_message_text("已提交申请，请等待管理员审核。")

    elif data.startswith("approve_"):
        user_id = int(data.split("_")[1])
        data_json = load_data()
        data_json["whitelist"][str(user_id)] = (datetime.utcnow() + timedelta(days=30)).isoformat()
        save_data(data_json)
        await context.bot.send_message(chat_id=user_id, text="您的发布权限已被批准，有效期30天。")
        await query.edit_message_text("已批准用户的发布权限。")

    elif data.startswith("reject_"):
        user_id = int(data.split("_")[1])
        await context.bot.send_message(chat_id=user_id, text="您的发布权限申请被拒绝。")
        await query.edit_message_text("已拒绝用户的发布权限。")

async def ban(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("您无权执行此操作。")
        return
    if not context.args:
        await update.message.reply_text("请提供要封禁的用户ID。")
        return
    try:
        user_id = int(context.args[0])
        data_json = load_data()
        if user_id not in data_json["banlist"]:
            data_json["banlist"].append(user_id)
            save_data(data_json)
        await update.message.reply_text(f"已封禁用户 {user_id}。")
    except:
        await update.message.reply_text("用户ID格式错误。")

async def publish(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if await is_banned(user_id):
        await update.message.reply_text("您已被封禁，无法发布内容。")
        return
    if not await is_whitelisted(user_id):
        await update.message.reply_text("您未获得发布权限，请先申请。")
        return
    user_states[user_id] = {"step": "awaiting_media"}
    await update.message.reply_text("请发送一张照片或一个视频。")

async def media_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if user_id not in user_states or user_states[user_id].get("step") != "awaiting_media":
        return
    msg = update.message
    if msg.photo:
        file_id = msg.photo[-1].file_id
        media_type = "photo"
    elif msg.video:
        file_id = msg.video.file_id
        media_type = "video"
    else:
        await msg.reply_text("请发送一张照片或一个视频。")
        return
    user_states[user_id].update({"media_type": media_type, "file_id": file_id, "step": "awaiting_quantity_price"})
    await msg.reply_text("请发送优惠券数量和价格，格式：数量,价格（例如：3,100）")

async def text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if user_id not in user_states:
        return
    state = user_states[user_id]
    msg = update.message

    if state.get("step") == "awaiting_quantity_price":
        try:
            quantity, price = map(str.strip, msg.text.split(","))
            state.update({
                "quantity": quantity,
                "price": price,
                "step": "awaiting_limit_type"
            })
            keyboard = [[
                InlineKeyboardButton("P", callback_data="limit_P"),
                InlineKeyboardButton("PP", callback_data="limit_PP"),
                InlineKeyboardButton("通用", callback_data="limit_general")
            ]]
            await msg.reply_text("请选择优惠券限制类型：", reply_markup=InlineKeyboardMarkup(keyboard))
        except:
            await msg.reply_text("格式错误，请使用：数量,价格")
    elif state.get("step") == "awaiting_confirmation":
        if msg.text.strip() == "是":
            template = load_data()["config"].get("template", "数量：{quantity}\n价格：{price}\n限制：{limit_type}")
            caption = template.format(
                quantity=state["quantity"],
                price=state["price"],
                limit_type=state["limit_type"]
            )
            if state["media_type"] == "photo":
                await context.bot.send_photo(chat_id=CHANNEL_ID, photo=state["file_id"], caption=caption)
            else:
                await context.bot.send_video(chat_id=CHANNEL_ID, video=state["file_id"], caption=caption)
            await msg.reply_text("发布成功！")
            user_states.pop(user_id, None)
        else:
            await msg.reply_text("发布取消。")
            user_states.pop(user_id, None)

async def limit_type_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    if user_id not in user_states:
        await query.edit_message_text("会话已过期，请重新发送 /publish")
        return
    state = user_states[user_id]
    if state.get("step") != "awaiting_limit_type":
        await query.edit_message_text("无效操作。")
        return
    data = query.data
    state["limit_type"] = {"limit_P": "P", "limit_PP": "PP", "limit_general": "通用"}.get(data, "通用")
    state["step"] = "awaiting_confirmation"
    await query.edit_message_text(
        f"确认发布以下内容？\n数量：{state['quantity']}\n价格：{state['price']}\n限制：{state['limit_type']}\n\n发送“是”确认，发送其他取消。"
    )

# 应用与 Webhook 注册
async def setup_webhook(application: Application):
    webhook_url = f"https://{os.getenv('RENDER_EXTERNAL_URL').strip('/')}{WEBHOOK_PATH}"
    await application.bot.set_webhook(webhook_url)

@app.route(WEBHOOK_PATH, methods=["POST"])
async def webhook():
    data = request.get_data().decode("utf-8")
    update = Update.de_json(json.loads(data), bot_app.bot)
    await bot_app.process_update(update)
    return Response("ok", status=200)

# 构建 Telegram 应用
bot_app = Application.builder().token(BOT_TOKEN).build()
bot_app.add_handler(CommandHandler("start", start))
bot_app.add_handler(CommandHandler("ban", ban))
bot_app.add_handler(CommandHandler("publish", publish))
bot_app.add_handler(CallbackQueryHandler(button_handler, pattern="^(apply_|approve_|reject_)"))
bot_app.add_handler(CallbackQueryHandler(limit_type_handler, pattern="^limit_"))
bot_app.add_handler(MessageHandler(filters.PHOTO | filters.VIDEO, media_handler))
bot_app.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), text_handler))

# 启动函数
if __name__ == "__main__":
    import asyncio
    asyncio.run(setup_webhook(bot_app))
    app.run(host="0.0.0.0", port=10000)