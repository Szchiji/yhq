from flask import Flask, request
from telegram import Bot, Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, ContextTypes, filters
import os
import json

# === 你的配置信息 ===
BOT_TOKEN = "7098191858:AAEOL8NazzqpCh9iJjv-YpkTUFukfEbdFyg"
ADMIN_ID = 7848870377
CHANNEL_ID = -1002669687216
WEBHOOK_URL = "https://yhq.onrender.com/webhook"
DATA_FILE = "data.json"

# === Flask 应用 ===
app = Flask(__name__)
bot = Bot(BOT_TOKEN)

# === JSON 数据读写 ===
def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    return {"whitelist": [], "banlist": [], "template": "默认模板"}

def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f)

data = load_data()

# === Telegram Handler ===
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if user_id in data["banlist"]:
        await update.message.reply_text("你已被封禁，无法使用本服务。")
    elif user_id in data["whitelist"]:
        await update.message.reply_text("你已获得发布权限，使用 /publish 发布。")
    else:
        await update.message.reply_text("请等待管理员审核你的发布权限。")
        await context.bot.send_message(chat_id=ADMIN_ID, text=f"用户 {user_id} 请求发布权限。使用 /approve {user_id} 或 /ban {user_id}")

async def approve(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    try:
        user_id = int(context.args[0])
        if user_id not in data["whitelist"]:
            data["whitelist"].append(user_id)
            save_data(data)
            await context.bot.send_message(chat_id=user_id, text="你已获得发布权限。使用 /publish 发布内容。")
            await update.message.reply_text("✅ 已批准")
    except:
        await update.message.reply_text("用法：/approve 用户ID")

async def ban(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    try:
        user_id = int(context.args[0])
        if user_id not in data["banlist"]:
            data["banlist"].append(user_id)
            if user_id in data["whitelist"]:
                data["whitelist"].remove(user_id)
            save_data(data)
            await context.bot.send_message(chat_id=user_id, text="你已被封禁，无法继续使用。")
            await update.message.reply_text("✅ 已封禁")
    except:
        await update.message.reply_text("用法：/ban 用户ID")

async def publish(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if user_id not in data["whitelist"]:
        await update.message.reply_text("你没有发布权限，请先使用 /start 申请。")
        return

    context.user_data["draft"] = update.message.text or "无内容"

    keyboard = [
        [
            InlineKeyboardButton("✅ 确认发布", callback_data="confirm_publish"),
            InlineKeyboardButton("❌ 取消", callback_data="cancel_publish")
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(f"以下是你的发布内容预览：\n\n{context.user_data['draft']}", reply_markup=reply_markup)

async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user_id = query.from_user.id
    await query.answer()

    if "draft" not in context.user_data:
        await query.edit_message_text("内容已失效，请重新使用 /publish")
        return

    if query.data == "confirm_publish":
        content = context.user_data["draft"]
        await context.bot.send_message(chat_id=CHANNEL_ID, text=content)
        await query.edit_message_text("✅ 发布成功")
        context.user_data.clear()
    elif query.data == "cancel_publish":
        await query.edit_message_text("❌ 发布已取消")
        context.user_data.clear()

# === Flask Webhook 接口 ===
@app.route(f"/webhook", methods=["POST"])
def webhook():
    update = Update.de_json(request.get_json(force=True), bot)
    application.update_queue.put_nowait(update)
    return "ok"

@app.route("/")
def home():
    return "机器人正在运行中"

# === Telegram Application 初始化 ===
application = Application.builder().token(BOT_TOKEN).build()

application.add_handler(CommandHandler("start", start))
application.add_handler(CommandHandler("approve", approve))
application.add_handler(CommandHandler("ban", ban))
application.add_handler(CommandHandler("publish", publish))
application.add_handler(CallbackQueryHandler(button_callback))
application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, publish))

# === 启动 Flask 并设置 Webhook ===
if __name__ == '__main__':
    import asyncio
    asyncio.run(bot.set_webhook(WEBHOOK_URL))
    app.run(host="0.0.0.0", port=int(os.environ.get('PORT', 5000)))