import os
from flask import Flask, request
from datetime import datetime, timedelta
from telegram import Bot, Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Dispatcher, CommandHandler, MessageHandler, CallbackQueryHandler, Filters, CallbackContext
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text
from sqlalchemy.orm import declarative_base, sessionmaker

# === 配置区 ===
TOKEN = os.environ.get('TOKEN')
ADMIN_ID = int(os.environ.get('ADMIN_ID', '123456789'))
CHANNEL_ID = int(os.environ.get('CHANNEL_ID', '-100xxxxxxxx'))
WEBHOOK_URL = os.environ.get('WEBHOOK_URL')
DATABASE_URL = os.environ.get('DATABASE_URL')

# === 初始化 ===
app = Flask(__name__)
bot = Bot(token=TOKEN)
dispatcher = Dispatcher(bot, update_queue=None, use_context=True)

# === 数据库 ===
Base = declarative_base()
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

class UserStatus(Base):
    __tablename__ = 'user_status'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, unique=True)
    status = Column(String(20))  # whitelist / banned / None
    last_publish = Column(DateTime)

class Settings(Base):
    __tablename__ = 'settings'
    id = Column(Integer, primary_key=True)
    key = Column(String(50), unique=True)
    value = Column(Text)

Base.metadata.create_all(engine)

# === 设置函数 ===
def get_setting(key, default=None):
    s = session.query(Settings).filter_by(key=key).first()
    return s.value if s else default

def set_setting(key, value):
    s = session.query(Settings).filter_by(key=key).first()
    if s:
        s.value = value
    else:
        s = Settings(key=key, value=value)
        session.add(s)
    session.commit()

# === 状态缓存 ===
user_states = {}

# === 命令处理 ===
def help_command(update: Update, context: CallbackContext):
    update.message.reply_text("欢迎使用机器人，命令包括：\n/start 申请权限\n/publish 发布内容\n/settpl 设置模板（管理员）")

def start(update: Update, context: CallbackContext):
    user_id = update.effective_user.id
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("✅ 通过", callback_data=f"approve_{user_id}"),
         InlineKeyboardButton("❌ 拒绝", callback_data=f"reject_{user_id}")]
    ])
    bot.send_message(chat_id=ADMIN_ID, text=f"用户 {user_id} 请求发布权限。", reply_markup=keyboard)
    update.message.reply_text("你的申请已提交，请等待管理员审核。")

def approve_cmd(update: Update, context: CallbackContext):
    if update.effective_user.id != ADMIN_ID:
        return
    try:
        target_id = int(context.args[0])
        upsert_user(target_id, "whitelist")
        bot.send_message(chat_id=target_id, text="你已获得发布权限。使用 /publish 发布内容。")
        update.message.reply_text(f"{target_id} 已添加白名单。")
    except:
        update.message.reply_text("用法：/approve 用户ID")

def ban(update: Update, context: CallbackContext):
    if update.effective_user.id != ADMIN_ID:
        return
    try:
        target_id = int(context.args[0])
        upsert_user(target_id, "banned")
        bot.send_message(chat_id=target_id, text="你已被封禁。")
        update.message.reply_text(f"{target_id} 已封禁。")
    except:
        update.message.reply_text("用法：/ban 用户ID")

def unban(update: Update, context: CallbackContext):
    if update.effective_user.id != ADMIN_ID:
        return
    try:
        target_id = int(context.args[0])
        upsert_user(target_id, None)
        update.message.reply_text(f"{target_id} 已解封。")
    except:
        update.message.reply_text("用法：/unban 用户ID")

def upsert_user(user_id, status):
    user = session.query(UserStatus).filter_by(user_id=user_id).first()
    if not user:
        user = UserStatus(user_id=user_id, status=status)
        session.add(user)
    else:
        user.status = status
    session.commit()

def set_template(update: Update, context: CallbackContext):
    if update.effective_user.id != ADMIN_ID:
        return
    tpl = update.message.text.replace("/settpl", "").strip()
    if tpl:
        set_setting("template", tpl)
        update.message.reply_text("模板已更新。")
    else:
        update.message.reply_text("用法：/settpl 模板内容")

def publish(update: Update, context: CallbackContext):
    user_id = update.effective_user.id
    user = session.query(UserStatus).filter_by(user_id=user_id).first()
    if not user or user.status != "whitelist":
        update.message.reply_text("你没有发布权限，请使用 /start 申请。")
        return
    if user.last_publish and datetime.now() - user.last_publish < timedelta(days=3):
        update.message.reply_text("每 3 天只能发布一次，请稍后再试。")
        return
    user_states[user_id] = {"step": 1, "start_time": datetime.now()}
    update.message.reply_text("请发送要发布的图片或视频：")

# === 发布流程 ===
def handle_media(update: Update, context: CallbackContext):
    user_id = update.effective_user.id
    state = user_states.get(user_id)
    if not state:
        return
    if datetime.now() - state["start_time"] > timedelta(minutes=30):
        user_states.pop(user_id)
        update.message.reply_text("操作超时，请重新 /publish")
        return

    step = state["step"]
    msg = update.message
    if step == 1:
        if msg.photo:
            state["media"] = msg.photo[-1].file_id
            state["type"] = "photo"
        elif msg.video:
            state["media"] = msg.video.file_id
            state["type"] = "video"
        else:
            msg.reply_text("请发送一张图片或视频")
            return
        state["step"] = 2
        msg.reply_text("请输入优惠券数量：")

    elif step == 2:
        state["amount"] = msg.text
        state["step"] = 3
        msg.reply_text("请输入优惠价格：")

    elif step == 3:
        state["price"] = msg.text
        state["step"] = 4
        msg.reply_text("请输入限制类型（如：限P / 限PP / 通用）：")

    elif step == 4:
        state["limit"] = msg.text
        state["step"] = 5
        tpl = get_setting("template", "【公告】")
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
        msg.reply_text("预览如下，请确认发布或取消。")

def handle_confirm(update: Update, context: CallbackContext):
    query = update.callback_query
    user_id = int(query.data.split("_")[1])
    state = user_states.pop(user_id, None)
    if not state:
        query.answer("状态失效")
        return
    if state["type"] == "photo":
        bot.send_photo(chat_id=CHANNEL_ID, photo=state["media"], caption=state["caption"])
    else:
        bot.send_video(chat_id=CHANNEL_ID, video=state["media"], caption=state["caption"])
    user = session.query(UserStatus).filter_by(user_id=user_id).first()
    if user:
        user.last_publish = datetime.now()
        session.commit()
    query.edit_message_caption("✅ 发布成功！")

def handle_cancel(update: Update, context: CallbackContext):
    query = update.callback_query
    user_id = int(query.data.split("_")[1])
    user_states.pop(user_id, None)
    query.edit_message_caption("❌ 发布已取消")

# === 审核按钮处理 ===
def handle_review(update: Update, context: CallbackContext):
    query = update.callback_query
    data = query.data
    user_id = int(data.split("_")[1])
    if data.startswith("approve_"):
        upsert_user(user_id, "whitelist")
        bot.send_message(chat_id=user_id, text="你已通过审核，获得发布权限。")
        query.edit_message_text(f"✅ 用户 {user_id} 已通过。")
    elif data.startswith("reject_"):
        upsert_user(user_id, "banned")
        bot.send_message(chat_id=user_id, text="你的发布申请被拒绝。")
        query.edit_message_text(f"❌ 用户 {user_id} 已拒绝。")

# === 注册 Handler ===
dispatcher.add_handler(CommandHandler("start", start))
dispatcher.add_handler(CommandHandler("help", help_command))
dispatcher.add_handler(CommandHandler("approve", approve_cmd))
dispatcher.add_handler(CommandHandler("ban", ban))
dispatcher.add_handler(CommandHandler("unban", unban))
dispatcher.add_handler(CommandHandler("publish", publish))
dispatcher.add_handler(CommandHandler("settpl", set_template))
dispatcher.add_handler(CallbackQueryHandler(handle_review, pattern="^(approve|reject)_"))
dispatcher.add_handler(CallbackQueryHandler(handle_confirm, pattern=r"^confirm_\d+"))
dispatcher.add_handler(CallbackQueryHandler(handle_cancel, pattern=r"^cancel_\d+"))
dispatcher.add_handler(MessageHandler(Filters.photo | Filters.video | Filters.text, handle_media))

# === Flask 路由 ===
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
    success = bot.set_webhook(WEBHOOK_URL)
    return f"Webhook 设置成功: {success}"

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)