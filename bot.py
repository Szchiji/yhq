import os
import json
import logging
import asyncio
from datetime import datetime, timedelta

from flask import Flask, request
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ContextTypes,
    filters,
)

# 日志配置
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO
)
logger = logging.getLogger(__name__)

# --- 配置区域 ---
BOT_TOKEN = os.getenv("BOT_TOKEN")
ADMIN_ID = int(os.getenv("ADMIN_ID"))
CHANNEL_ID = int(os.getenv("CHANNEL_ID"))
WEBHOOK_URL = os.getenv("WEBHOOK_URL")  # https://xxx.onrender.com/BOT_TOKEN
DATA_FILE = "data.json"
PORT = int(os.getenv("PORT", 8443))  # Render 默认端口

flask_app = Flask(__name__)

# --- 数据读写 ---
def load_data():
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {
            "whitelist": {},
            "banlist": [],
            "config": {
                "template": "数量：{quantity}\n价格：{price}\n限制类型：{limit_type}"
            }
        }

def save_data():
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data_json, f, ensure_ascii=False, indent=2)

data_json = load_data()
user_states = {}  # 每个用户的状态流程缓存

# --- 权限检查 ---
def check_permission(user_id):
    if user_id in data_json["banlist"]:
        return False
    expire_str = data_json["whitelist"].get(str(user_id))
    if not expire_str:
        return False
    try:
        expire_dt = datetime.fromisoformat(expire_str)
        return expire_dt > datetime.utcnow()
    except:
        return False

# --- 指令处理 ---
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if check_permission(user_id):
        await update.message.reply_text("你已拥有发布权限，发送 /publish 开始发布内容。")
    else:
        keyboard = InlineKeyboardMarkup([[InlineKeyboardButton("申请发布权限", callback_data=f"apply_{user_id}")]])
        await update.message.reply_text("你当前没有发布权限，点击下方按钮向管理员申请。", reply_markup=keyboard)

async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data
    user_id = query.from_user.id

    if data.startswith("apply_"):
        if check_permission(user_id):
            await query.edit_message_text("你已拥有发布权限，无需重复申请。")
            return
        await context.bot.send_message(
            chat_id=ADMIN_ID,
            text=f"用户 {user_id} 申请发布权限。请回复 /approve {user_id} 或 /reject {user_id}"
        )
        await query.edit_message_text("申请已发送，请等待管理员审核。")

    elif data.startswith("limit_"):
        state = user_states.get(user_id)
        if not state or state.get("step") != "awaiting_limit_type":
            await query.edit_message_text("状态异常，请重新使用 /publish。")
            return
        limit_map = {
            "limit_P": "P",
            "limit_PP": "PP",
            "limit_general": "通用"
        }
        limit_type = limit_map.get(data)
        if not limit_type:
            await query.edit_message_text("无效选择。")
            return
        state["limit_type"] = limit_type
        state["step"] = "awaiting_confirmation"
        text = (
            f"请确认发布信息：\n数量：{state['quantity']}\n价格：{state['price']}\n"
            f"限制类型：{state['limit_type']}\n确认发布请回复“是”，取消请回复“否”。"
        )
        await query.edit_message_text(text)

async def approve(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    if len(context.args) != 1:
        await update.message.reply_text("用法：/approve 用户ID")
        return
    try:
        user_id = int(context.args[0])
        expire = datetime.utcnow() + timedelta(days=30)
        data_json["whitelist"][str(user_id)] = expire.isoformat()
        save_data()
        await update.message.reply_text(f"已批准用户 {user_id} 发布权限。")
        await context.bot.send_message(user_id, "管理员已批准你发布权限，可发送 /publish 发布内容。")
    except:
        await update.message.reply_text("操作失败。")

async def reject(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    if len(context.args) != 1:
        await update.message.reply_text("用法：/reject 用户ID")
        return
    try:
        user_id = int(context.args[0])
        await update.message.reply_text(f"已拒绝用户 {user_id} 的申请。")
        await context.bot.send_message(user_id, "管理员拒绝了你的发布权限申请。")
    except:
        pass

async def ban(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    try:
        user_id = int(context.args[0])
        if user_id not in data_json["banlist"]:
            data_json["banlist"].append(user_id)
            data_json["whitelist"].pop(str(user_id), None)
            save_data()
        await update.message.reply_text(f"用户 {user_id} 已封禁。")
    except:
        pass

async def unban(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    try:
        user_id = int(context.args[0])
        if user_id in data_json["banlist"]:
            data_json["banlist"].remove(user_id)
            save_data()
            await update.message.reply_text(f"用户 {user_id} 已解封。")
    except:
        pass

async def extend(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    try:
        user_id = int(context.args[0])
        days = int(context.args[1])
        expire_str = data_json["whitelist"].get(str(user_id))
        expire_dt = datetime.fromisoformat(expire_str) if expire_str else datetime.utcnow()
        new_expire = expire_dt + timedelta(days=days)
        data_json["whitelist"][str(user_id)] = new_expire.isoformat()
        save_data()
        await update.message.reply_text(f"已延长用户 {user_id} 发布权限至 {new_expire}。")
    except:
        pass

async def settemplate(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    tpl = " ".join(context.args)
    if tpl:
        data_json["config"]["template"] = tpl
        save_data()
        await update.message.reply_text("模板已更新。")

async def publish(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if not check_permission(user_id):
        await update.message.reply_text("你没有发布权限，请先申请。")
        return
    user_states[user_id] = {"step": "awaiting_media"}
    await update.message.reply_text("请发送你要发布的照片或视频。")

async def media_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    state = user_states.get(user_id)
    if not state or state.get("step") != "awaiting_media":
        return
    message = update.message
    if message.photo:
        file_id = message.photo[-1].file_id
        media_type = "photo"
    elif message.video:
        file_id = message.video.file_id
        media_type = "video"
    else:
        await message.reply_text("请发送照片或视频。")
        return
    state.update({
        "file_id": file_id,
        "media_type": media_type,
        "step": "awaiting_quantity"
    })
    await message.reply_text("请输入数量（整数）：")

async def text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    state = user_states.get(user_id)
    if not state:
        return
    text = update.message.text.strip()
    if state["step"] == "awaiting_quantity":
        if not text.isdigit():
            await update.message.reply_text("请输入整数数量。")
            return
        state["quantity"] = text
        state["step"] = "awaiting_price"
        await update.message.reply_text("请输入价格（数字）：")
    elif state["step"] == "awaiting_price":
        try:
            float(text)
            state["price"] = text
            state["step"] = "awaiting_limit_type"
            keyboard = InlineKeyboardMarkup([
                [InlineKeyboardButton("P", callback_data="limit_P"),
                 InlineKeyboardButton("PP", callback_data="limit_PP"),
                 InlineKeyboardButton("通用", callback_data="limit_general")]
            ])
            await update.message.reply_text("请选择限制类型：", reply_markup=keyboard)
        except:
            await update.message.reply_text("请输入有效的数字价格。")
    elif state["step"] == "awaiting_confirmation":
        if text == "是":
            tpl = data_json["config"]["template"]
            caption = tpl.format(
                quantity=state["quantity"],
                price=state["price"],
                limit_type=state["limit_type"]
            )
            try:
                if state["media_type"] == "photo":
                    await context.bot.send_photo(CHANNEL_ID, photo=state["file_id"], caption=caption)
                else:
                    await context.bot.send_video(CHANNEL_ID, video=state["file_id"], caption=caption)
                await update.message.reply_text("发布成功！")
            except Exception as e:
                await update.message.reply_text(f"发布失败：{e}")
            user_states.pop(user_id, None)
        elif text == "否":
            await update.message.reply_text("发布取消。")
            user_states.pop(user_id, None)
        else:
            await update.message.reply_text("请回复“是”确认，或“否”取消。")

# --- Webhook 路由 ---
@flask_app.route(f"/{BOT_TOKEN}", methods=["POST"])
def webhook():
    json_data = request.get_json(force=True)
    update = Update.de_json(json_data, application.bot)
    asyncio.get_event_loop().create_task(application.update_queue.put(update))
    return "ok"

# --- 主启动入口 ---
async def main():
    global application
    application = ApplicationBuilder().token(BOT_TOKEN).build()
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CallbackQueryHandler(button_handler))
    application.add_handler(CommandHandler("approve", approve))
    application.add_handler(CommandHandler("reject", reject))
    application.add_handler(CommandHandler("ban", ban))
    application.add_handler(CommandHandler("unban", unban))
    application.add_handler(CommandHandler("extend", extend))
    application.add_handler(CommandHandler("settemplate", settemplate))
    application.add_handler(CommandHandler("publish", publish))
    application.add_handler(MessageHandler(filters.PHOTO | filters.VIDEO, media_handler))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_handler))

    await application.bot.set_webhook(url=f"{WEBHOOK_URL}")
    logger.info("Bot Webhook 已设置")

if __name__ == "__main__":
    asyncio.run(main())