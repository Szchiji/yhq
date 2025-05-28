import os
import json
from flask import Flask, request
from datetime import datetime, timedelta
from telegram import (
    Bot, Update, InlineKeyboardMarkup, InlineKeyboardButton
)
from telegram.ext import (
    Dispatcher, CommandHandler, MessageHandler, Filters,
    CallbackContext, CallbackQueryHandler
)

# === 配置区 ===
TOKEN = os.environ.get('TOKEN')  # 你的 Bot Token
CHANNEL_ID = int(os.environ.get('CHANNEL_ID', '-1002669687216'))
ADMIN_ID = int(os.environ.get('ADMIN_ID', '7848870377'))
WEBHOOK_URL = os.environ.get('WEBHOOK_URL')  # 你的 webhook 地址，如：https://xxxx.onrender.com

# === 初始化 Flask & Telegram Bot ===
app = Flask(__name__)
bot = Bot(token=TOKEN)
dispatcher = Dispatcher(bot, update_queue=None, use_context=True)

# === 本地数据存储 ===
DATA_FILE = 'data.json'
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, 'w') as f:
        json.dump({
            "whitelist": [],
            "banned": [],
            "template": "【公告】",
            "last_publish": {}
        }, f)

def load_data():
    try:
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    except:
        return {"whitelist": [], "banned": [], "template": "【公告】", "last_publish": {}}

def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f)

# === 用户状态缓存 ===
user_states = {}

# === 指令处理 ===
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

def unban(update: Update, context: CallbackContext):
    if update.effective_user.id != ADMIN_ID:
        return
    try:
        target_id = int(context.args[0])
        data = load_data()
        if target_id in data['banned']:
            data['banned'].remove(target_id)
            save_data(data)
            update.message.reply_text(f'{target_id} 已解除封禁。')
    except:
        update.message.reply_text('用法：/unban 用户ID')

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

def publish(update: Update, context: CallbackContext):
    user_id = update.effective_user.id
    data = load_data()

    if user_id in data.get("banned", []):
        update.message.reply_text("你已被封禁。")
        return

    if user_id not in data.get("whitelist", []):
        update.message.reply_text("你没有发布权限，请先使用 /start 申请。")
        return

    last_time_str = data.get("last_publish", {}).get(str(user_id))
    if last_time_str:
        last_time = datetime.fromisoformat(last_time_str)
        if datetime.now() - last_time < timedelta(days=3):
            update.message.reply_text("你每 3 天只能发布一次，请稍后再试。")
            return

    user_states[user_id] = {"step": 1, "start_time": datetime.now()}
    update.message.reply_text("请发送你要发布的图片或视频：")

# === 发布流程 ===
def handle_media(update: Update, context: CallbackContext):
    user_id = update.effective_user.id
    state = user_states.get(user_id)
    if not state:
        return

    if datetime.now() - state.get("start_time", datetime.now()) > timedelta(minutes=30):
        user_states.pop(user_id, None)
        update.message.reply_text("操作超时，请重新开始 /publish。")
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
        state["step"] = 5

        data = load_data()
        tpl = data.get("template", "【公告】")
        caption = tpl.format_map({
            "amount": state["amount"],
            "price": state["price"],
            "limit": state["limit"]
        }) if "{" in tpl else f"{tpl}\n数量：{state['amount']}\n价格：{state['price']}\n限制：{state['limit']}"

        state["caption"] = caption
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("✅ 确认发布", callback_data=f"confirm_{user_id}"),
             InlineKeyboardButton("❌ 取消", callback_data=f"cancel_{user_id}")]
        ])

        if state["type"] == "photo":
            bot.send_photo(chat_id=user_id, photo=state["media"], caption=caption, reply_markup=keyboard)
        else:
            bot.send_video(chat_id=user_id, video=state["media"], caption=caption, reply_markup=keyboard)

        update.message.reply_text("这是你的发布预览，请点击下方按钮确认或取消。")

def handle_confirm(update: Update, context: CallbackContext):
    query = update.callback_query
    query.answer()
    user_id = int(query.data.split("_")[1])
    state = user_states.get(user_id)
    if not state:
        query.edit_message_caption(caption="发布失败：内容丢失。")
        return

    if state["type"] == "photo":
        bot.send_photo(chat_id=CHANNEL_ID, photo=state["media"], caption=state["caption"])
    else:
        bot.send_video(chat_id=CHANNEL_ID, video=state["media"], caption=state["caption"])

    data = load_data()
    data.setdefault("last_publish", {})[str(user_id)] = datetime.now().isoformat()
    save_data(data)

    user_states.pop(user_id)
    query.edit_message_caption(caption="✅ 发布成功！")

def handle_cancel(update: Update, context: CallbackContext):
    query = update.callback_query
    query.answer()
    user_id = int(query.data.split("_")[1])
    user_states.pop(user_id, None)
    query.edit_message_caption(caption="❌ 已取消发布。")

# === 注册 Handler ===
dispatcher.add_handler(CommandHandler("start", start))
dispatcher.add_handler(CommandHandler("approve", approve))
dispatcher.add_handler(CommandHandler("ban", ban))
dispatcher.add_handler(CommandHandler("unban", unban))
dispatcher.add_handler(CommandHandler("settpl", set_template))
dispatcher.add_handler(CommandHandler("publish", publish))
dispatcher.add_handler(CallbackQueryHandler(handle_confirm, pattern=r"^confirm_\d+$"))
dispatcher.add_handler(CallbackQueryHandler(handle_cancel, pattern=r"^cancel_\d+$"))
dispatcher.add_handler(MessageHandler(Filters.photo | Filters.video | Filters.text, handle_media))

# === Webhook 路由 ===
@app.route("/", methods=["POST"])
def webhook():
    update = Update.de_json(request.get_json(force=True), bot)
    dispatcher.process_update(update)
    return "ok"

@app.route("/", methods=["GET"])
def index():
    return "Bot is running."

@app.route("/set_webhook", methods=["GET"])
def set_webhook():
    if not WEBHOOK_URL:
        return "请设置环境变量 WEBHOOK_URL"
    success = bot.set_webhook(WEBHOOK_URL)
    return f"Webhook 设置成功: {success}"

# === 启动 Flask ===
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)