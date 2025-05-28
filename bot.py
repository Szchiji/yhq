import json
import os
from datetime import datetime, timedelta

from telegram import (
    Update, InlineKeyboardButton, InlineKeyboardMarkup
)
from telegram.ext import (
    Application, CommandHandler, MessageHandler, filters,
    CallbackQueryHandler, ContextTypes, ConversationHandler
)

TOKEN = "7098191858:AAEOL8NazzqpCh9iJjv-YpkTUFukfEbdFyg"
ADMIN_ID = 7848870377
CHANNEL_ID = -1002669687216
DATA_FILE = "data.json"

PUBLISH, SELECT_TEMPLATE, PREVIEW = range(3)

# ---------------- 数据读取保存 ---------------- #

def load_data():
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, "w") as f:
            json.dump({"whitelist": {}, "banned": [], "templates": []}, f)
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

# ---------------- 管理员命令 ---------------- #

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("欢迎使用发布机器人，发送 /publish 开始发布。")

async def settemplate(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    text = update.message.text.replace("/settemplate", "").strip()
    if not text:
        await update.message.reply_text("格式：/settemplate 按钮1|按钮2|按钮3")
        return
    buttons = text.split("|")
    data["templates"] = buttons
    save_data(data)
    await update.message.reply_text("发布按钮模板已更新：\n" + "\n".join(buttons))

async def addvip(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    args = context.args
    if len(args) != 2:
        await update.message.reply_text("格式：/addvip 用户ID 天数")
        return
    user_id = args[0]
    days = int(args[1])
    expire_time = datetime.now() + timedelta(days=days)
    data["whitelist"][str(user_id)] = expire_time.strftime("%Y-%m-%d %H:%M:%S")
    save_data(data)
    await update.message.reply_text(f"已添加 {user_id} 为 VIP，时效 {days} 天。")

async def ban(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    if not context.args:
        await update.message.reply_text("格式：/ban 用户ID")
        return
    user_id = int(context.args[0])
    data["banned"].append(user_id)
    save_data(data)
    await update.message.reply_text(f"用户 {user_id} 已封禁。")

# ---------------- 用户发布流程 ---------------- #

user_cache = {}

async def publish(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if user.id in data["banned"]:
        await update.message.reply_text("你已被封禁，无法发布。")
        return ConversationHandler.END
    if not is_vip(user.id):
        await update.message.reply_text("你不是会员，无法发布，请联系管理员。")
        return ConversationHandler.END
    await update.message.reply_text("请发送你要发布的内容（支持文字、图片、视频）。")
    return PUBLISH

async def receive_content(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    user_cache[user_id] = {"message": update.message}
    buttons = [[InlineKeyboardButton(t, callback_data=f"template|{t}")] for t in data["templates"]]
    await update.message.reply_text("请选择一个分类按钮：", reply_markup=InlineKeyboardMarkup(buttons))
    return SELECT_TEMPLATE

async def choose_template(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    template = query.data.split("|")[1]
    cache = user_cache.get(user_id)
    if not cache:
        await query.message.reply_text("内容已过期，请重新发布。")
        return ConversationHandler.END
    cache["template"] = template

    # 准备预览内容
    msg = cache["message"]
    caption = msg.caption or msg.text or ""
    preview_text = f"{template}\n\n{caption}"
    preview_buttons = [
        [InlineKeyboardButton("✅确认发布", callback_data="confirm")],
        [InlineKeyboardButton("❌取消发布", callback_data="cancel")]
    ]

    # 发送预览
    if msg.photo:
        file_id = msg.photo[-1].file_id
        await context.bot.send_photo(chat_id=user_id, photo=file_id, caption=preview_text,
                                     reply_markup=InlineKeyboardMarkup(preview_buttons))
    elif msg.video:
        file_id = msg.video.file_id
        await context.bot.send_video(chat_id=user_id, video=file_id, caption=preview_text,
                                     reply_markup=InlineKeyboardMarkup(preview_buttons))
    else:
        await context.bot.send_message(chat_id=user_id, text=preview_text,
                                       reply_markup=InlineKeyboardMarkup(preview_buttons))

    return PREVIEW

async def preview_decision(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user_id = query.from_user.id
    await query.answer()
    if query.data == "cancel":
        user_cache.pop(user_id, None)
        await query.message.reply_text("❌ 已取消发布。")
        return ConversationHandler.END

    cache = user_cache.get(user_id)
    if not cache:
        await query.message.reply_text("发布数据已失效，请重新发布。")
        return ConversationHandler.END

    msg = cache["message"]
    template = cache["template"]
    caption = msg.caption or msg.text or ""
    final_text = f"{template}\n\n{caption}"

    if msg.photo:
        file_id = msg.photo[-1].file_id
        await context.bot.send_photo(chat_id=CHANNEL_ID, photo=file_id, caption=final_text)
    elif msg.video:
        file_id = msg.video.file_id
        await context.bot.send_video(chat_id=CHANNEL_ID, video=file_id, caption=final_text)
    else:
        await context.bot.send_message(chat_id=CHANNEL_ID, text=final_text)

    user_cache.pop(user_id, None)
    await query.message.reply_text("✅ 已发布到频道！")
    return ConversationHandler.END

# ---------------- 主程序入口 ---------------- #

application = Application.builder().token(TOKEN).build()

conv_handler = ConversationHandler(
    entry_points=[CommandHandler("publish", publish)],
    states={
        PUBLISH: [MessageHandler(filters.TEXT | filters.PHOTO | filters.VIDEO, receive_content)],
        SELECT_TEMPLATE: [CallbackQueryHandler(choose_template, pattern=r"^template\|")],
        PREVIEW: [CallbackQueryHandler(preview_decision, pattern="^(confirm|cancel)$")],
    },
    fallbacks=[],
)

application.add_handler(CommandHandler("start", start))
application.add_handler(CommandHandler("settemplate", settemplate))
application.add_handler(CommandHandler("addvip", addvip))
application.add_handler(CommandHandler("ban", ban))
application.add_handler(conv_handler)

# 如果你用 Webhook 方式，还需设置 app.run() 的 webhook 启动逻辑