from flask import Flask, request
from telegram import Bot, Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Dispatcher, CommandHandler, MessageHandler, filters
import json
import os

# === 你的配置信息 ===
BOT_TOKEN = "7098191858:AAEOL8NazzqpCh9iJjv-YpkTUFukfEbdFyg"
ADMIN_ID = 7848870377
CHANNEL_ID = -1002669687216
WEBHOOK_URL = "https://yhq.onrender.com/webhook"

DATA_FILE = "data.json"

# === 加载和保存 JSON 数据 ===
def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    return {"whitelist": [], "banlist": [], "template": "默认模板"}

def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f)

data = load_data()

# === 初始化 Bot 和 Flask ===
bot = Bot(token=BOT_TOKEN)
app = Flask(__name__)
dispatcher = Dispatcher(bot=bot, update_queue=None, workers=0)

# === 命令处理器 ===
def start(update: Update, context):
    user_id = update.effective_user.id
    if user_id in data["banlist"]:
        update.message.reply_text("你已被封禁，无法使用本服务。")
    elif user_id in data["whitelist"]:
        update.message.reply_text("你已获得发布权限，使用 /publish 发布。")
    else:
        update.message.reply_text("请等待管理员审核你的发布权限。")
        bot.send_message(chat_id=ADMIN_ID, text=f"用户 {user_id} 请求发布权限。使用 /approve {user_id} 或 /ban {user_id}")

def approve(update: Update, context):
    if update.effective_user.id != ADMIN_ID:
        return
    try:
        user_id = int(context.args[0])
        if user_id not in data["whitelist"]:
            data["whitelist"].append(user_id)
            save_data(data)
            bot.send_message(chat_id=user_id, text="你已获得发布权限。使用 /publish 发布内容。")
            update.message.reply_text("已批准。")
    except:
        update.message.reply_text("用法：/approve 用户ID")

def ban(update: Update, context):
    if update.effective_user.id != ADMIN_ID:
        return
    try:
        user_id = int(context.args[0])
        if user_id not in data["banlist"]:
            data["banlist"].append(user_id)
            if user_id in data["whitelist"]:
                data["whitelist"].remove(user_id)
            save_data(data)
            bot.send_message(chat_id=user_id, text="你已被封禁，无法继续使用。")
            update.message.reply_text("已封禁。")
    except:
        update.message.reply_text("用法：/ban 用户ID")

def publish(update: Update, context):
    user_id = update.effective_user.id
    if user_id not in data["whitelist"]:
        update.message.reply_text("你没有发布权限，请先使用 /start 申请。")
        return

    # 保存用户输入的内容，用作预览
    context.user_data["draft"] = update.message.text or "无内容"
    
    keyboard = [
        [
            InlineKeyboardButton("✅ 确认发布", callback_data="confirm_publish"),
            InlineKeyboardButton("❌ 取消", callback_data="cancel_publish")
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    update.message.reply_text(f"以下是你的发布内容预览：\n\n{context.user_data['draft']}", reply_markup=reply_markup)

def button_callback(update: Update, context):
    query = update.callback_query
    user_id = query.from_user.id
    context.bot.answer_callback_query(query.id)

    if user_id not in context.user_data or "draft" not in context.user_data:
        context.bot.send_message(chat_id=user_id, text="内容已失效，请重新使用 /publish")
        return

    if query.data == "confirm_publish":
        content = context.user_data["draft"]
        bot.send_message(chat_id=CHANNEL_ID, text=content)
        context.bot.send_message(chat_id=user_id, text="✅ 发布成功")
        del context.user_data["draft"]
    elif query.data == "cancel_publish":
        context.bot.send_message(chat_id=user_id, text="❌ 发布已取消")
        del context.user_data["draft"]

# === 注册处理器 ===
dispatcher.add_handler(CommandHandler("start", start))
dispatcher.add_handler(CommandHandler("approve", approve))
dispatcher.add_handler(CommandHandler("ban", ban))
dispatcher.add_handler(CommandHandler("publish", publish))
dispatcher.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), publish))
dispatcher.add_handler(MessageHandler(filters.COMMAND, lambda u, c: u.message.reply_text("未知命令")))
dispatcher.add_handler(MessageHandler(filters.ALL, lambda u, c: None))
dispatcher.add_handler(telegram.ext.CallbackQueryHandler(button_callback))

# === 设置 Webhook 路由 ===
@app.route(f"/webhook", methods=["POST"])
def webhook():
    update = Update.de_json(request.get_json(force=True), bot)
    dispatcher.process_update(update)
    return "ok"

@app.route("/")
def home():
    return "Bot 正常运行中。"

# === 启动 Flask 应用 ===
if __name__ == "__main__":
    bot.set_webhook(url=WEBHOOK_URL)
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))