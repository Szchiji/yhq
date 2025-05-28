import json
import os
from datetime import datetime, timedelta
from telegram import Bot, Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Dispatcher, CommandHandler, MessageHandler, Filters, CallbackQueryHandler

TOKEN = os.getenv("BOT_TOKEN", "你的Token")
ADMIN_ID = 7848870377
CHANNEL_ID = -1002669687216
DATA_FILE = "data.json"

PUBLISH, SELECT_TEMPLATE, PREVIEW = range(3)

# 初始化数据文件
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, "w") as f:
        json.dump({"whitelist": {}, "banned": [], "templates": []}, f)

def load_data():
    with open(DATA_FILE, "r") as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

data = load_data()

def is_vip(user_id):
    entry = data["whitelist"].get(str(user_id))
    if entry:
        expiry = datetime.strptime(entry, "%Y-%m-%d %H:%M:%S")
        return datetime.now() < expiry
    return False

bot = Bot(token=TOKEN)
dispatcher = Dispatcher(bot, None, workers=0)  # 禁用多线程方便同步

user_cache = {}

def start(update, context):
    update.message.reply_text("欢迎使用发布机器人，发送 /publish 开始发布。")

def settemplate(update, context):
    if update.effective_user.id != ADMIN_ID:
        update.message.reply_text("无权限")
        return
    text = update.message.text.replace("/settemplate", "").strip()
    if not text:
        update.message.reply_text("格式：/settemplate 按钮1|按钮2|按钮3")
        return
    buttons = text.split("|")
    data["templates"] = buttons
    save_data(data)
    update.message.reply_text("发布按钮模板已更新：\n" + "\n".join(buttons))

def addvip(update, context):
    if update.effective_user.id != ADMIN_ID:
        update.message.reply_text("无权限")
        return
    args = context.args
    if len(args) != 2:
        update.message.reply_text("格式：/addvip 用户ID 天数")
        return
    user_id = args[0]
    try:
        days = int(args[1])
    except:
        update.message.reply_text("天数必须为整数")
        return
    expire_time = datetime.now() + timedelta(days=days)
    data["whitelist"][str(user_id)] = expire_time.strftime("%Y-%m-%d %H:%M:%S")
    save_data(data)
    update.message.reply_text(f"已添加 {user_id} 为 VIP，时效 {days} 天。")

def ban(update, context):
    if update.effective_user.id != ADMIN_ID:
        update.message.reply_text("无权限")
        return
    if not context.args:
        update.message.reply_text("格式：/ban 用户ID")
        return
    try:
        user_id = int(context.args[0])
    except:
        update.message.reply_text("用户ID必须为数字")
        return
    if user_id not in data["banned"]:
        data["banned"].append(user_id)
    save_data(data)
    update.message.reply_text(f"用户 {user_id} 已封禁。")

def publish(update, context):
    user = update.effective_user
    if user.id in data["banned"]:
        update.message.reply_text("你已被封禁，无法发布。")
        return
    if not is_vip(user.id):
        update.message.reply_text("你不是会员，无法发布，请联系管理员。")
        return
    update.message.reply_text("请发送你要发布的内容（支持文字、图片、视频）。")
    user_cache[user.id] = {"step": PUBLISH}

def receive_content(update, context):
    user_id = update.effective_user.id
    if user_id not in user_cache or user_cache[user_id].get("step") != PUBLISH:
        return
    user_cache[user_id]["message"] = update.message
    buttons = [[InlineKeyboardButton(t, callback_data=f"template|{t}")] for t in data.get("templates", [])]
    if not buttons:
        update.message.reply_text("未设置模板，请联系管理员。")
        user_cache.pop(user_id, None)
        return
    update.message.reply_text("请选择一个分类按钮：", reply_markup=InlineKeyboardMarkup(buttons))
    user_cache[user_id]["step"] = SELECT_TEMPLATE

def choose_template(update, context):
    query = update.callback_query
    query.answer()
    user_id = query.from_user.id
    if user_id not in user_cache or user_cache[user_id].get("step") != SELECT_TEMPLATE:
        query.message.reply_text("内容已过期，请重新发布。")
        return
    template = query.data.split("|")[1]
    user_cache[user_id]["template"] = template

    msg = user_cache[user_id]["message"]
    caption = msg.caption or msg.text or ""
    preview_text = f"{template}\n\n{caption}"
    preview_buttons = [
        [InlineKeyboardButton("✅确认发布", callback_data="confirm")],
        [InlineKeyboardButton("❌取消发布", callback_data="cancel")]
    ]

    if msg.photo:
        file_id = msg.photo[-1].file_id
        bot.send_photo(chat_id=user_id, photo=file_id, caption=preview_text,
                       reply_markup=InlineKeyboardMarkup(preview_buttons))
    elif msg.video:
        file_id = msg.video.file_id
        bot.send_video(chat_id=user_id, video=file_id, caption=preview_text,
                       reply_markup=InlineKeyboardMarkup(preview_buttons))
    else:
        bot.send_message(chat_id=user_id, text=preview_text,
                         reply_markup=InlineKeyboardMarkup(preview_buttons))
    user_cache[user_id]["step"] = PREVIEW

def preview_decision(update, context):
    query = update.callback_query
    user_id = query.from_user.id
    query.answer()
    if query.data == "cancel":
        user_cache.pop(user_id, None)
        query.message.reply_text("❌ 已取消发布。")
        return
    if user_id not in user_cache or user_cache[user_id].get("step") != PREVIEW:
        query.message.reply_text("发布数据已失效，请重新发布。")
        return
    msg = user_cache[user_id]["message"]
    template = user_cache[user_id]["template"]
    caption = msg.caption or msg.text or ""
    final_text = f"{template}\n\n{caption}"

    if msg.photo:
        file_id = msg.photo[-1].file_id
        bot.send_photo(chat_id=CHANNEL_ID, photo=file_id, caption=final_text)
    elif msg.video:
        file_id = msg.video.file_id
        bot.send_video(chat_id=CHANNEL_ID, video=file_id, caption=final_text)
    else:
        bot.send_message(chat_id=CHANNEL_ID, text=final_text)

    user_cache.pop(user_id, None)
    query.message.reply_text("✅ 已发布到频道！")

dispatcher.add_handler(CommandHandler("start", start))
dispatcher.add_handler(CommandHandler("settemplate", settemplate))
dispatcher.add_handler(CommandHandler("addvip", addvip))
dispatcher.add_handler(CommandHandler("ban", ban))
dispatcher.add_handler(CommandHandler("publish", publish))
dispatcher.add_handler(MessageHandler(Filters.text | Filters.photo | Filters.video, receive_content))
dispatcher.add_handler(CallbackQueryHandler(choose_template, pattern=r"^template\|"))
dispatcher.add_handler(CallbackQueryHandler(preview_decision, pattern="^(confirm|cancel)$"))
