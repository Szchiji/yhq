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
    status = Column(String(20))  # 'whitelist' or 'banned'
    last_publish = Column(DateTime)

class Settings(Base):
    __tablename__ = 'settings'
    id = Column(Integer, primary_key=True)
    key = Column(String(50), unique=True, nullable=False)
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

# === 用户状态缓存 ===
user_states = {}

# === 指令 ===
def start(update: Update, context: CallbackContext):
    user_id = update.effective_user.id
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("✅ 通过", callback_data=f"approve_{user_id}"),
         InlineKeyboardButton("❌ 拒绝", callback_data=f"reject_{user_id}")]
    ])
    bot.send_message(chat_id=ADMIN_ID, text=f'用户 {user_id} 请求发布权限。', reply_markup=keyboard)
    update.message.reply_text('你的申请已提交，请等待管理员审核。')

def help_command(update: Update, context: CallbackContext):
    update.message.reply_text(
        "欢迎使用本Bot！\n"
        "以下是可用命令：\n"
        "/start - 申请发布权限\n"
        "/publish - 发布内容（需权限）\n"
        "/help - 查看帮助信息"
    )

def approve(update: Update, context: CallbackContext):
    if update.effective_user.id != ADMIN_ID:
        return
    try:
        target_id = int(context.args[0])
        user = session.query(UserStatus).filter_by(user_id=target_id).first()
        if not user:
            user = UserStatus(user_id=target_id, status='whitelist')
            session.add(user)
        else:
            user.status = 'whitelist'
        session.commit()
        bot.send_message(chat_id=target_id, text='你已获得发布权限，使用 /publish 发布内容。')
        update.message.reply_text(f'{target_id} 已添加到白名单。')
    except:
        update.message.reply_text('用法：/approve 用户ID')

def ban(update: Update, context: CallbackContext):
    if update.effective_user.id != ADMIN_ID:
        return
    try:
        target_id = int(context.args[0])
        user = session.query(UserStatus).filter_by(user_id=target_id).first()
        if not user:
            user = UserStatus(user_id=target_id, status='banned')
            session.add(user)
        else:
            user.status = 'banned'
        session.commit()
        bot.send_message(chat_id=target_id, text='你已被封禁。')
        update.message.reply_text(f'{target_id} 已封禁。')
    except:
        update.message.reply_text('用法：/ban 用户ID')

def unban(update: Update, context: CallbackContext):
    if update.effective_user.id != ADMIN_ID:
        return
    try:
        target_id = int(context.args[0])
        user = session.query(UserStatus).filter_by(user_id=target_id).first()
        if user and user.status == 'banned':
            user.status = None
            session.commit()
            update.message.reply_text(f'{target_id} 已解除封禁。')
    except:
        update.message.reply_text('用法：/unban 用户ID')

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
    query.answer()
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
    query.answer()
    user_id = int(query.data.split("_")[1])
    user_states.pop(user_id, None)
    query.edit_message_caption(caption="❌ 已取消发布。")

def handle_approval(update: Update, context: CallbackContext):
    query = update.callback_query
    query.answer()
    data = query.data
    if not data.startswith(("approve_", "reject_")):
        return
    user_id = int(data.split("_")[1])
    user = session.query(UserStatus).filter_by(user_id=user_id).first()
    if data.startswith("approve_"):
        if not user:
            user = UserStatus(user_id=user_id, status='whitelist')
            session.add(user)
        else:
            user.status = 'whitelist'
        