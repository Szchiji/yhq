import json
import os
from flask import Flask, request
from telegram import Update, Bot
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    filters,
    ContextTypes,
)

TOKEN = '7098191858:AAEOL8NazzqpCh9iJjv-YpkTUFukfEbdFyg'
CHANNEL_ID = -1002669687216
ADMIN_ID = 7848870377
WEBHOOK_URL = 'https://yhq.onrender.com'

DATA_FILE = 'data.json'

# 初始化 Flask
app = Flask(__name__)
bot = Bot(token=TOKEN)

# 加载/初始化数据文件
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, 'w') as f:
        json.dump({"whitelist": [], "banned": [], "template": "默认模板"}, f)

def load_data():
    with open(DATA_FILE, 'r') as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f)

# Bot 应用（同步模式）
application = Application.builder().token(TOKEN).build()

# /start 指令：申请发布权限
def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    bot.send_message(chat_id=ADMIN_ID, text=f'用户 {user_id} 请求发布权限。\n使用 /approve {user_id} 通过。')
    update.message.reply_text('你的申请已提交，请等待管理员审核。')

# 管理员批准用户
def approve(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    try:
        target_id = int(context.args[0])
        data = load_data()
        if target_id not in data['whitelist']:
            data['whitelist'].append(target_id)
            save_data(data)
            bot.send_message(chat_id=target_id, text='你已获得发布权限，使用 /publish 发布内容。')
            update.message.reply_text(f'{target_id} 已添加到白名单。')
    except:
        update.message.reply_text('用法：/approve 用户ID')

# 封禁用户
def ban(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    try:
        target_id = int(context.args[0])
        data = load_data()
        if target_id not in data['banned']:
            data['banned'].append(target_id)
            save_data(data)
            update.message.reply_text(f'{target_id} 已封禁。')
            bot.send_message(chat_id=target_id, text='你已被封禁，无法发布内容。')
    except:
        update.message.reply_text('用法：/ban 用户ID')

# 发布内容
user_states = {}  # 缓存用户状态

def publish(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    data = load_data()
    if user_id in data.get("banned", []):
        update.message.reply_text("你已被封禁。")
        return
    if user_id not in data.get("whitelist", []):
        update.message.reply_text("你没有发布权限，请先使用 /start 申请。")
        return
    user_states[user_id] = {"step": 1}
    update.message.reply_text("请发送你要发布的图片或视频")

def handle_media(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    state = user_states.get(user_id)
    if not state:
        return

    if state["step"] == 1:
        if update.message.photo:
            state["media"] = update.message.photo[-1].file_id
            state["type"] = "photo"
        elif update.message.video:
            state["media"] = update.message.video.file_id
            state["type"] = "video"
        else:
            update.message.reply_text("请发送图片或视频")
            return
        state["step"] = 2
        update.message.reply_text("请输入数量：")
    elif state["step"] == 2:
        state["amount"] = update.message.text
        state["step"] = 3
        update.message.reply_text("请输入价格：")
    elif state["step"] == 3:
        state["price"] = update.message.text
        state["step"] = 4
        update.message.reply_text("请输入限制类型（如：仅限女性）：")
    elif state["step"] == 4:
        state["limit"] = update.message.text
        data = load_data()
        tpl = data.get("template", "默认模板")
        final_text = f"{tpl}\n数量：{state['amount']}\n价格：{state['price']}\n限制：{state['limit']}"
        if state["type"] == "photo":
            bot.send_photo(chat_id=CHANNEL_ID, photo=state["media"], caption=final_text)
        else:
            bot.send_video(chat_id=CHANNEL_ID, video=state["media"], caption=final_text)
        update.message.reply_text("发布成功。")
        user_states.pop(user_id)

# 设置模板
def set_template(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    tpl = update.message.text.replace("/settpl", "").strip()
    if tpl:
        data = load_data()
        data["template"] = tpl
        save_data(data)
        update.message.reply_text("模板已更新。")
    else:
        update.message.reply_text("用法：/settpl 模板内容")

# 添加指令处理器
application.add_handler(CommandHandler("start", start))
application.add_handler(CommandHandler("approve", approve))
application.add_handler(CommandHandler("ban", ban))
application.add_handler(CommandHandler("publish", publish))
application.add_handler(CommandHandler("settpl", set_template))
application.add_handler(MessageHandler(filters.PHOTO | filters.VIDEO | filters.TEXT, handle_media))

# Flask 路由
@app.route(f"/", methods=["POST"])
def webhook():
    update = Update.de_json(request.get_json(force=True), bot)
    application.update_queue.put_nowait(update)
    return "ok"

# 设置 Webhook
@app.route("/set_webhook", methods=["GET"])
def set_webhook():
    success = bot.set_webhook(f"{WEBHOOK_URL}")
    return f"设置成功: {success}"

# 启动 Flask
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
    @app.route("/", methods=["POST"])
def webhook():
    update = Update.de_json(request.get_json(force=True), bot)
    application.update_queue.put_nowait(update)
    return "ok"

@app.route("/", methods=["GET", "HEAD"])
def index():
    return "Telegram bot webhook is running."