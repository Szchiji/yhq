import json
import os
from flask import Flask, request
from telegram import Bot, Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import CommandHandler, MessageHandler, CallbackQueryHandler, Filters, CallbackContext
from telegram.ext import Dispatcher

# 配置常量
TOKEN = '7098191858:AAEOL8NazzqpCh9iJjv-YpkTUFukfEbdFyg'
ADMIN_ID = 7848870377
CHANNEL_ID = -1002669687216
DATA_FILE = 'data.json'
WEBHOOK_URL = 'https://yhq.onrender.com'

# 初始化 Flask 与 Telegram Bot
app = Flask(__name__)
bot = Bot(token=TOKEN)

# 初始化 Dispatcher（同步版本）
dispatcher = Dispatcher(bot, update_queue=None, workers=0, use_context=True)

# 加载数据文件
def load_data():
    if not os.path.exists(DATA_FILE):
        return {"whitelist": [], "banned": [], "templates": {"default": "数量：{count}\n价格：{price}\n限制：{limit}"}}
    with open(DATA_FILE, 'r') as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

data = load_data()

# 命令：/start
def start(update: Update, context: CallbackContext):
    user_id = update.effective_user.id
    if user_id in data['banned']:
        return update.message.reply_text("你已被封禁，无法使用本服务。")
    if user_id in data['whitelist']:
        return update.message.reply_text("你已获得发布权限，可使用 /publish 发布内容。")
    keyboard = [[InlineKeyboardButton("申请发布权限", callback_data=f"apply_{user_id}")]]
    update.message.reply_text("欢迎使用发布机器人，点击下方按钮申请发布权限：", reply_markup=InlineKeyboardMarkup(keyboard))

# 回调按钮处理（申请权限）
def button_handler(update: Update, context: CallbackContext):
    query = update.callback_query
    query.answer()
    data_parts = query.data.split("_")
    if data_parts[0] == "apply":
        user_id = int(data_parts[1])
        bot.send_message(chat_id=ADMIN_ID, text=f"🔔 用户申请发布权限：{user_id}\n\n/approve {user_id} — 通过\n/ban {user_id} — 封禁")
        query.edit_message_text("✅ 申请已提交，请等待管理员审核。")

# 管理员命令：批准权限
def approve(update: Update, context: CallbackContext):
    if update.effective_user.id != ADMIN_ID:
        return
    if len(context.args) != 1:
        return update.message.reply_text("用法：/approve 用户ID")
    user_id = int(context.args[0])
    if user_id not in data['whitelist']:
        data['whitelist'].append(user_id)
        save_data(data)
    bot.send_message(chat_id=user_id, text="🎉 你已获得发布权限，现在可以使用 /publish 命令发布内容！")
    update.message.reply_text(f"✅ 已批准 {user_id} 的发布权限。")

# 管理员命令：封禁用户
def ban(update: Update, context: CallbackContext):
    if update.effective_user.id != ADMIN_ID:
        return
    if len(context.args) != 1:
        return update.message.reply_text("用法：/ban 用户ID")
    user_id = int(context.args[0])
    if user_id not in data['banned']:
        data['banned'].append(user_id)
    if user_id in data['whitelist']:
        data['whitelist'].remove(user_id)
    save_data(data)
    bot.send_message(chat_id=user_id, text="🚫 你已被管理员封禁，无法继续使用此机器人。")
    update.message.reply_text(f"🚫 已封禁用户 {user_id}")

# 用户命令：发布内容
def publish(update: Update, context: CallbackContext):
    user_id = update.effective_user.id
    if user_id in data['banned']:
        return update.message.reply_text("你已被封禁，无法使用本服务。")
    if user_id not in data['whitelist']:
        return update.message.reply_text("你尚未获得发布权限，请先通过 /start 申请权限。")
    context.user_data['state'] = 'await_media'
    update.message.reply_text("请发送要发布的【图片或视频】。")

# 处理用户发来的图片或视频
def media_handler(update: Update, context: CallbackContext):
    user_id = update.effective_user.id
    if user_id not in data['whitelist']:
        return
    if context.user_data.get('state') != 'await_media':
        return
    context.user_data['media'] = update.message
    context.user_data['state'] = 'await_details'
    update.message.reply_text("请输入发布详情，格式如下：\n数量：xxx\n价格：xxx\n限制：xxx")

# 处理详情文字
def detail_handler(update: Update, context: CallbackContext):
    user_id = update.effective_user.id
    if user_id not in data['whitelist']:
        return
    if context.user_data.get('state') != 'await_details':
        return
    detail = update.message.text
    context.user_data['detail'] = detail
    context.user_data['state'] = 'await_confirm'
    keyboard = [
        [InlineKeyboardButton("✅ 确认发布", callback_data="confirm_post")],
        [InlineKeyboardButton("❌ 取消发布", callback_data="cancel_post")]
    ]
    update.message.reply_text("请确认以下内容将被发布：\n\n" + detail, reply_markup=InlineKeyboardMarkup(keyboard))

# 回调按钮确认发布
def confirm_button_handler(update: Update, context: CallbackContext):
    query = update.callback_query
    user_id = query.from_user.id
    query.answer()

    if query.data == "cancel_post":
        context.user_data.clear()
        query.edit_message_text("已取消发布。")
        return

    if query.data == "confirm_post":
        media_msg = context.user_data.get('media')
        detail = context.user_data.get('detail', '')
        if not media_msg:
            query.edit_message_text("错误：未找到媒体内容。")
            return
        if media_msg.photo:
            file_id = media_msg.photo[-1].file_id
            bot.send_photo(chat_id=CHANNEL_ID, photo=file_id, caption=detail)
        elif media_msg.video:
            file_id = media_msg.video.file_id
            bot.send_video(chat_id=CHANNEL_ID, video=file_id, caption=detail)
        query.edit_message_text("✅ 发布成功。")
        context.user_data.clear()

# 添加处理器到 dispatcher
dispatcher.add_handler(CommandHandler("start", start))
dispatcher.add_handler(CommandHandler("publish", publish))
dispatcher.add_handler(CommandHandler("approve", approve))
dispatcher.add_handler(CommandHandler("ban", ban))
dispatcher.add_handler(MessageHandler(Filters.photo | Filters.video, media_handler))
dispatcher.add_handler(MessageHandler(Filters.text & ~Filters.command, detail_handler))
dispatcher.add_handler(CallbackQueryHandler(button_handler, pattern="^apply_"))
dispatcher.add_handler(CallbackQueryHandler(confirm_button_handler, pattern="^(confirm_post|cancel_post)$"))

# Webhook 接收处理
@app.route(f"/{TOKEN}", methods=["POST"])
def webhook():
    update = Update.de_json(request.get_json(force=True), bot)
    dispatcher.process_update(update)
    return 'ok'

# 设置 webhook
@app.route("/")
def set_webhook():
    bot.set_webhook(url=f"{WEBHOOK_URL}/{TOKEN}")
    return "Webhook 设置成功"

# 启动 Flask 应用
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)