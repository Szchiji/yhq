import json
import os
from flask import Flask, request
from telegram import Update, Bot
from telegram.ext import (
    Updater,
    CommandHandler,
    MessageHandler,
    Filters,
    CallbackContext,
)

TOKEN = os.environ.get('TOKEN')
CHANNEL_ID = int(os.environ.get('CHANNEL_ID', '-1002669687216'))
ADMIN_ID = int(os.environ.get('ADMIN_ID', '7848870377'))
WEBHOOK_URL = os.environ.get('WEBHOOK_URL')

DATA_FILE = 'data.json'

app = Flask(__name__)
bot = Bot(token=TOKEN)

if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, 'w') as f:
        json.dump({"whitelist": [], "banned": [], "template": "默认模板"}, f)

def load_data():
    with open(DATA_FILE, 'r') as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f)

updater = Updater(token=TOKEN, use_context=True)
dispatcher = updater.dispatcher

user_states = {}

def start(update: Update, context: CallbackContext):
    user_id = update.effective_user.id
    bot.send_message(chat_id=ADMIN_ID, text=f'用户 {user_id} 请求发布权限。\n使用 /approve {user_id} 通过。')
    update.message.reply_text('你的申请已提交，请等待管理员审核。')

def approve(update: Update, context: CallbackContext):
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

def ban(update: Update, context: CallbackContext):
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

def publish(update: Update, context: CallbackContext):
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

def handle_media(update: Update, context: CallbackContext):
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
        if not update.message.text:
            update.message.reply_text("请输入有效的数量")
            return
        state["amount"] = update.message.text
        state["step"] = 3
        update.message.reply_text("请输入价格：")

    elif state["step"] == 3:
        if not update.message.text:
            update.message.reply_text("请输入有效的价格")
            return
        state["price"] = update.message.text
        state["step"] = 4
        update.message.reply_text("请输入限制类型（如：仅限女性）：")

    elif state["step"] == 4:
        if not update.message.text:
            update.message.reply_text("请输入限制类型")
            return
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

def set_template(update: Update, context: CallbackContext):
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

dispatcher.add_handler(CommandHandler("start", start))
dispatcher.add_handler(CommandHandler("approve", approve))
dispatcher.add_handler(CommandHandler("ban", ban))
dispatcher.add_handler(CommandHandler("publish", publish))
dispatcher.add_handler(CommandHandler("settpl", set_template))
dispatcher.add_handler(MessageHandler(Filters.photo | Filters.video | Filters.text, handle_media))

@app.route("/", methods=["POST"])
def webhook():
    update = Update.de_json(request.get_json(force=True), bot)
    dispatcher.process_update(update)
    return "ok"

@app.route("/set_webhook", methods=["GET"])
def set_webhook():
    if WEBHOOK_URL is None:
        return "请设置环境变量 WEBHOOK_URL"
    success = bot.set_webhook(WEBHOOK_URL)
    return f"Webhook 设置成功: {success}"

@app.route("/", methods=["GET", "HEAD"])
def index():
    return "Telegram bot webhook is running."

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
