import os
from flask import Flask, request
from datetime import datetime, timedelta
from telegram import Bot, Update, InlineKeyboardMarkup, InlineKeyboardButton
from telegram.ext import Dispatcher, CommandHandler, MessageHandler, Filters, CallbackContext, CallbackQueryHandler
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text
from sqlalchemy.orm import declarative_base, sessionmaker

# === 配置 ===
TOKEN = os.environ.get('TOKEN')
CHANNEL_ID = int(os.environ.get('CHANNEL_ID', '-100XXXXXXXXX'))
ADMIN_ID = int(os.environ.get('ADMIN_ID', '123456789'))
WEBHOOK_URL = os.environ.get('WEBHOOK_URL')
DATABASE_URL = os.environ.get('DATABASE_URL')

# === Flask & Telegram ===
app = Flask(__name__)
bot = Bot(token=TOKEN)
dispatcher = Dispatcher(bot, update_queue=None, use_context=True)

# === 数据库配置 ===
Base = declarative_base()
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

class UserStatus(Base):
    __tablename__ = 'user_status'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, unique=True, nullable=False)
    status = Column(String(20))  # whitelist / banned
    last_publish = Column(DateTime)

class Settings(Base):
    __tablename__ = 'settings'
    id = Column(Integer, primary_key=True)
    key = Column(String(50), unique=True)
    value = Column(Text)

Base.metadata.create_all(engine)

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

# === 缓存状态 ===
user_states = {}

# === 指令 ===
def start(update: Update, context: CallbackContext):
    user_id = update.effective_user.id
    kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("✅ 通过", callback_data=f"approve_{user_id}"),
         InlineKeyboardButton("❌ 拒绝", callback_data=f"reject_{user_id}")]
    ])
    bot.send_message(chat_id=ADMIN_ID, text=f"用户 {user_id} 请求发布权限。", reply_markup=kb)
    update.message.reply_text("你的申请已提交，请等待管理员审核。")

def help_command(update: Update, context: CallbackContext):
    update.message.reply_text("/start - 申请权限\n/publish - 发布内容\n/help - 帮助\n管理员指令：/approve /ban /unban /settpl")

def approve(update: Update, context: CallbackContext):
    if update.effective_user.id != ADMIN_ID:
        return
    try:
        user_id = int(context.args[0])
        set_user_status(user_id, 'whitelist')
        bot.send_message(chat_id=user_id, text="你已获得发布权限，使用 /publish 发布内容。")
        update.message.reply_text(f"{user_id} 已通过。")
    except:
        update.message.reply_text("用法：/approve 用户ID")

def ban(update: Update, context: CallbackContext):
    if update.effective_user.id != ADMIN_ID:
        return
    try:
        user_id = int(context.args[0])
        set_user_status(user_id, 'banned')
        bot.send_message(chat_id=user_id, text="你已被封禁。")
        update.message.reply_text(f"{user_id} 已封禁。")
    except:
        update.message.reply_text("用法：/ban 用户ID")

def unban(update: Update, context: CallbackContext):
    if update.effective_user.id != ADMIN_ID:
        return
    try:
        user_id = int(context.args[0])
        set_user_status(user_id, None)
        update.message.reply_text(f"{user_id} 已解除封禁。")
    except:
        update.message.reply_text("用法：/unban 用户ID")

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
    status = get_user_status(user_id)
    if status != 'whitelist':
        update.message.reply_text("你没有发布权限，请先使用 /start 申请。")
        return

    user = session.query(UserStatus).filter_by(user_id=user_id).first()
    if user and user.last_publish and datetime.now() - user.last_publish < timedelta(days=3):
        update.message.reply_text("每3天仅可发布一次。")
        return

    user_states[user_id] = {"step": 1, "start_time": datetime.now()}
    update.message.reply_text("请发送你要发布的图片或视频：")

def handle_media(update: Update, context: CallbackContext):
    user_id = update.effective_user.id
    state = user_states.get(user_id)
    if not state:
        return

    if datetime.now() - state.get("start_time", datetime.now()) > timedelta(minutes=30):
        user_states.pop(user_id)
        update.message.reply_text("操作超时，请重新 /publish")
        return

    msg = update.message
    step = state["step"]

    if step == 1:
        if msg.photo:
            state.update({"media": msg.photo[-1].file_id, "type": "photo"})
        elif msg.video:
            state.update({"media": msg.video.file_id, "type": "video"})
        else:
            msg.reply_text("请发送图片或视频")
            return
        state["step"] = 2
        msg.reply_text("请输入数量：")

    elif step == 2:
        state["amount"] = msg.text
        state["step"] = 3
        msg.reply_text("请输入价格：")

    elif step == 3:
        state["price"] = msg.text
        state["step"] = 4
        msg.reply_text("请输入限制类型（如：仅限女性）：")

    elif step == 4:
        state["limit"] = msg.text
        state["step"] = 5
        tpl = get_setting("template", "【公告】")
        caption = tpl.format_map(state) if "{" in tpl else f"{tpl}\n数量：{state['amount']}\n价格：{state['price']}\n限制：{state['limit']}"
        state["caption"] = caption
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("✅ 确认发布", callback_data=f"confirm_{user_id}"),
             InlineKeyboardButton("❌ 取消", callback_data=f"cancel_{user_id}")]
        ])
        if state["type"] == "photo":
            bot.send_photo(chat_id=user_id, photo=state["media"], caption=caption, reply_markup=kb)
        else:
            bot.send_video(chat_id=user_id, video=state["media"], caption=caption, reply_markup=kb)

def handle_buttons(update: Update, context: CallbackContext):
    query = update.callback_query
    data = query.data
    user_id = int(data.split("_")[1])

    if data.startswith("approve_"):
        set_user_status(user_id, 'whitelist')
        bot.send_message(chat_id=user_id, text="你已获得发布权限，使用 /publish 发布内容。")
        query.edit_message_text(text=f"✅ 用户 {user_id} 审核通过。")

    elif data.startswith("reject_"):
        set_user_status(user_id, 'banned')
        bot.send_message(chat_id=user_id, text="你的申请已被拒绝。")
        query.edit_message_text(text=f"❌ 用户 {user_id} 审核被拒。")

    elif data.startswith("confirm_"):
        state = user_states.pop(user_id, None)
        if state:
            if state["type"] == "photo":
                bot.send_photo(chat_id=CHANNEL_ID, photo=state["media"], caption=state["caption"])
            else:
                bot.send_video(chat_id=CHANNEL_ID, video=state["media"], caption=state["caption"])
            u = session.query(UserStatus).filter_by(user_id=user_id).first()
            if u:
                u.last_publish = datetime.now()
                session.commit()
            query.edit_message_caption(caption="✅ 发布成功！")
        else:
            query.edit_message_caption(caption="内容已过期，请重新发布。")

    elif data.startswith("cancel_"):
        user_states.pop(user_id, None)
        query.edit_message_caption(caption="❌ 已取消发布。")

def set_user_status(user_id, status):
    user = session.query(UserStatus).filter_by(user_id=user_id).first()
    if not user:
        user = UserStatus(user_id=user_id, status=status)
        session.add(user)
    else:
        user.status = status
    session.commit()

def get_user_status(user_id):
    user = session.query(UserStatus).filter_by(user_id=user_id).first()
    return user.status if user else None

# === 处理器注册 ===
dispatcher.add_handler(CommandHandler("start", start))
dispatcher.add_handler(CommandHandler("help", help_command))
dispatcher.add_handler(CommandHandler("approve", approve))
dispatcher.add_handler(CommandHandler("ban", ban))
dispatcher.add_handler(CommandHandler("unban", unban))
dispatcher.add_handler(CommandHandler("settpl", set_template))
dispatcher.add_handler(CommandHandler("publish", publish))
dispatcher.add_handler(MessageHandler(Filters.text | Filters.photo | Filters.video, handle_media))
dispatcher.add_handler(CallbackQueryHandler(handle_buttons))

# === Webhook 路由 ===
@app.route("/", methods=["POST"])
def webhook():
    update = Update.de_json(request.get_json(force=True), bot)
    dispatcher.process_update(update)
    return "ok"

@app.route("/set_webhook", methods=["GET"])
def set_webhook():
    success = bot.set_webhook(WEBHOOK_URL)
    return f"Webhook 设置成功: {success}"

@app.route("/", methods=["GET"])
def index():
    return "Bot 正在运行。"

# === 启动 Flask ===
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)