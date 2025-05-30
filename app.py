import os
from flask import Flask, request
from datetime import datetime, timedelta
from telegram import Bot, Update, InlineKeyboardMarkup, InlineKeyboardButton
from telegram.ext import Dispatcher, CommandHandler, MessageHandler, Filters, CallbackContext, CallbackQueryHandler
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text
from sqlalchemy.orm import declarative_base, sessionmaker

# === 配置区 ===
TOKEN = os.environ.get('TOKEN')
CHANNEL_ID = int(os.environ.get('CHANNEL_ID', '-1002669687216'))
ADMIN_ID = int(os.environ.get('ADMIN_ID', '7848870377'))
WEBHOOK_URL = os.environ.get('WEBHOOK_URL')
DATABASE_URL = os.environ.get('DATABASE_URL')

# === 初始化 Flask & Bot ===
app = Flask(__name__)
bot = Bot(token=TOKEN)
dispatcher = Dispatcher(bot, update_queue=None, use_context=True)

# === 数据库设置 ===
Base = declarative_base()
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

class UserStatus(Base):
    __tablename__ = 'user_status'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, unique=True, nullable=False)
    username = Column(String(100))
    status = Column(String(20))  # 'whitelist' or 'banned'
    last_publish = Column(DateTime)

class Settings(Base):
    __tablename__ = 'settings'
    id = Column(Integer, primary_key=True)
    key = Column(String(50), unique=True, nullable=False)
    value = Column(Text)

Base.metadata.create_all(engine)

# === 工具函数 ===
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

def get_user_by_id_or_username(identifier):
    try:
        user_id = int(identifier)
        return session.query(UserStatus).filter_by(user_id=user_id).first()
    except ValueError:
        return session.query(UserStatus).filter_by(username=identifier.lstrip("@")).first()

# === 状态缓存 ===
user_states = {}

# === 指令 ===
def start(update: Update, context: CallbackContext):
    user = update.effective_user
    mention = f"@{user.username}" if user.username else "无用户名"
    bot.send_message(
        chat_id=ADMIN_ID,
        text=f"📢 发布权限申请：\n👤 昵称：{user.full_name}\n🔗 用户名：{mention}\n🆔 用户ID：{user.id}\n\n使用 /approve <用户ID或@用户名> 通过。"
    )
    update.message.reply_text("你的申请已提交，请等待管理员审核。")

def approve(update: Update, context: CallbackContext):
    if update.effective_user.id != ADMIN_ID:
        return
    try:
        identifier = context.args[0]
        user_data = get_user_by_id_or_username(identifier)
        if not user_data:
            # 新建记录
            user_id = int(identifier.lstrip("@")) if identifier.isdigit() else None
            user_data = UserStatus(user_id=user_id, username=identifier.lstrip("@"), status='whitelist')
            session.add(user_data)
        else:
            user_data.status = 'whitelist'
        session.commit()

        if user_data.user_id:
            bot.send_message(chat_id=user_data.user_id, text="✅ 你已获得发布权限，使用 /publish 发布内容。")
        update.message.reply_text(f"{identifier} 已添加到白名单。")
    except Exception as e:
        print("approve error:", e)
        update.message.reply_text("用法：/approve <用户ID 或 @用户名>")

def ban(update: Update, context: CallbackContext):
    if update.effective_user.id != ADMIN_ID:
        return
    try:
        identifier = context.args[0]
        user_data = get_user_by_id_or_username(identifier)
        if not user_data:
            user_data = UserStatus(user_id=int(identifier), status='banned')
            session.add(user_data)
        else:
            user_data.status = 'banned'
        session.commit()
        if user_data.user_id:
            bot.send_message(chat_id=user_data.user_id, text="🚫 你已被封禁。")
        update.message.reply_text(f"{identifier} 已封禁。")
    except:
        update.message.reply_text("用法：/ban <用户ID 或 @用户名>")

def unban(update: Update, context: CallbackContext):
    if update.effective_user.id != ADMIN_ID:
        return
    try:
        identifier = context.args[0]
        user_data = get_user_by_id_or_username(identifier)
        if user_data:
            user_data.status = None
            session.commit()
            update.message.reply_text(f"{identifier} 已解除封禁。")
    except:
        update.message.reply_text("用法：/unban <用户ID 或 @用户名>")

def set_template(update: Update, context: CallbackContext):
    if update.effective_user.id != ADMIN_ID:
        return
    tpl = update.message.text.replace("/settpl", "").strip()
    if tpl:
        set_setting("template", tpl)
        update.message.reply_text("模板已更新。")
    else:
        update.message.reply_text("用法：/settpl 模板内容")

def help_command(update: Update, context: CallbackContext):
    update.message.reply_text("使用说明：\n/start - 申请发布权限\n/publish - 发布内容\n管理员命令：/approve /ban /unban /settpl")

def publish(update: Update, context: CallbackContext):
    user_id = update.effective_user.id
    user = session.query(UserStatus).filter_by(user_id=user_id).first()
    if not user or user.status != 'whitelist':
        update.message.reply_text("你没有发布权限，请先使用 /start 申请。")
        return
    if user.status == 'banned':
        update.message.reply_text("你已被封禁。")
        return
    if user.last_publish and datetime.now() - user.last_publish < timedelta(days=3):
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
        msg.reply_text("这是你的发布预览，请点击下方按钮确认或取消。")

def handle_confirm(update: Update, context: CallbackContext):
    query = update.callback_query
    user_id = int(query.data.split("_")[1])
    state = user_states.pop(user_id, None)
    if not state:
        query.edit_message_caption(caption="发布失败：内容丢失。")
        return
    if state["type"] == "photo":
        bot.send_photo(chat_id=CHANNEL_ID, photo=state["media"], caption=state["caption"])
    else:
        bot.send_video(chat_id=CHANNEL_ID, video=state["media"], caption=state["caption"])
    user = session.query(UserStatus).filter_by(user_id=user_id).first()
    if user:
        user.last_publish = datetime.now()
        session.commit()
    query.edit_message_caption(caption="✅ 发布成功！")

def handle_cancel(update: Update, context: CallbackContext):
    query = update.callback_query
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
dispatcher.add_handler(CommandHandler("help", help_command))
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