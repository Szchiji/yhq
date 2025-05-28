import os
import json
import logging
from datetime import datetime, timedelta
from flask import Flask, request
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, MessageHandler, CallbackQueryHandler,
    ContextTypes, filters
)

# 初始化日志
logging.basicConfig(level=logging.INFO)

# 环境变量
BOT_TOKEN = os.getenv("BOT_TOKEN")
CHANNEL_ID = int(os.getenv("CHANNEL_ID"))
ADMIN_ID = int(os.getenv("ADMIN_ID"))
WEBHOOK_PATH = f"/{BOT_TOKEN}"
PORT = int(os.getenv("PORT", 8443))

# 数据文件
DATA_FILE = "data.json"
user_states = {}

# Flask 应用
flask_app = Flask(__name__)

# 初始化 Telegram Application（Webhook 模式）
tg_app = Application.builder().token(BOT_TOKEN).build()


# 数据加载与保存
def load_data():
    if not os.path.exists(DATA_FILE):
        data = {
            "whitelist": {},
            "banlist": [],
            "config": {
                "template": "数量：{quantity}\n价格：{price}\n限制：{limit_type}"
            }
        }
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f)
    else:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    return data


def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# 权限判断
async def is_banned(user_id): return user_id in load_data()["banlist"]

async def is_whitelisted(user_id):
    expires = load_data()["whitelist"].get(str(user_id))
    return expires and datetime.fromisoformat(expires) > datetime.utcnow()


# 处理函数
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if await is_banned(user_id):
        return await update.message.reply_text("您已被封禁，无法使用此机器人。")
    if await is_whitelisted(user_id):
        return await update.message.reply_text("您已获得发布权限。发送 /publish 开始发布。")

    keyboard = [[InlineKeyboardButton("申请发布权限", callback_data=f"apply_{user_id}")]]
    await update.message.reply_text("请点击下方按钮申请发布权限：", reply_markup=InlineKeyboardMarkup(keyboard))


async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data

    if data.startswith("apply_"):
        user_id = int(data.split("_")[1])
        if query.from_user.id != user_id:
            return await query.edit_message_text("您无权申请此权限。")

        keyboard = [[
            InlineKeyboardButton("同意", callback_data=f"approve_{user_id}"),
            InlineKeyboardButton("拒绝", callback_data=f"reject_{user_id}")
        ]]
        await context.bot.send_message(
            chat_id=ADMIN_ID,
            text=f"用户 {user_id} 申请发布权限，是否同意？",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
        await query.edit_message_text("已提交申请，请等待管理员审核。")

    elif data.startswith("approve_"):
        user_id = int(data.split("_")[1])
        data_json = load_data()
        data_json["whitelist"][str(user_id)] = (datetime.utcnow() + timedelta(days=30)).isoformat()
        save_data(data_json)
        await context.bot.send_message(chat_id=user_id, text="您的发布权限已被批准，有效期30天。")
        await query.edit_message_text("已批准用户发布权限。")

    elif data.startswith("reject_"):
        user_id = int(data.split("_")[1])
        await context.bot.send_message(chat_id=user_id, text="您的发布权限申请被拒绝。")
        await query.edit_message_text("已拒绝用户发布权限。")


async def ban(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return await update.message.reply_text("您无权操作。")
    if not context.args:
        return await update.message.reply_text("请提供要封禁的用户 ID。")
    try:
        user_id = int(context.args[0])
        data_json = load_data()
        if user_id not in data_json["banlist"]:
            data_json["banlist"].append(user_id)
            save_data(data_json)
        await update.message.reply_text(f"已封禁用户 {user_id}")
    except:
        await update.message.reply_text("用户 ID 格式错误。")


async def publish(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if await is_banned(user_id):
        return await update.message.reply_text("您已被封禁，无法发布。")
    if not await is_whitelisted(user_id):
        return await update.message.reply_text("您未获得发布权限，请先申请。")
    user_states[user_id] = {"step": "awaiting_media"}
    await update.message.reply_text("请发送一张照片或一个视频。")


async def media_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if user_id not in user_states or user_states[user_id].get("step") != "awaiting_media":
        return
    msg = update.message
    if msg.photo:
        file_id = msg.photo[-1].file_id
        media_type = "photo"
    elif msg.video:
        file_id = msg.video.file_id
        media_type = "video"
    else:
        return await msg.reply_text("请发送照片或视频。")

    user_states[user_id].update({
        "media_type": media_type,
        "file_id": file_id,
        "step": "awaiting_quantity_price"
    })
    await msg.reply_text("请输入数量和价格，格式：数量,价格（例如：3,100）")


async def text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if user_id not in user_states:
        return
    state = user_states[user_id]
    msg = update.message

    if state.get("step") == "awaiting_quantity_price":
        try:
            quantity, price = map(str.strip, msg.text.split(","))
            state.update({
                "quantity": quantity,
                "price": price,
                "step": "awaiting_limit_type"
            })
            keyboard = [[
                InlineKeyboardButton("P", callback_data="limit_P"),
                InlineKeyboardButton("PP", callback_data="limit_PP"),
                InlineKeyboardButton("通用", callback_data="limit_general")
            ]]
            await msg.reply_text("请选择限制类型：", reply_markup=InlineKeyboardMarkup(keyboard))
        except:
            await msg.reply_text("格式错误，请输入：数量,价格（如：3,100）")

    elif state.get("step") == "awaiting_confirmation":
        if msg.text.strip() == "是":
            template = load_data()["config"]["template"]
            caption = template.format(
                quantity=state["quantity"],
                price=state["price"],
                limit_type=state["limit_type"]
            )
            if state["media_type"] == "photo":
                await context.bot.send_photo(chat_id=CHANNEL_ID, photo=state["file_id"], caption=caption)
            else:
                await context.bot.send_video(chat_id=CHANNEL_ID, video=state["file_id"], caption=caption)
            await msg.reply_text("发布成功！")
        else:
            await msg.reply_text("发布已取消。")
        user_states.pop(user_id, None)


async def limit_type_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    if user_id not in user_states or user_states[user_id].get("step") != "awaiting_limit_type":
        return await query.edit_message_text("会话已过期，请重新发送 /publish")

    data = query.data
    state = user_states[user_id]
    state["limit_type"] = {"limit_P": "P", "limit_PP": "PP", "limit_general": "通用"}[data]
    state["step"] = "awaiting_confirmation"

    await query.edit_message_text(
        f"确认发布以下内容？\n数量：{state['quantity']}\n价格：{state['price']}\n限制：{state['limit_type']}\n\n发送“是”确认，发送其他取消。"
    )


# 添加所有 handler
tg_app.add_handler(CommandHandler("start", start))
tg_app.add_handler(CommandHandler("ban", ban))
tg_app.add_handler(CommandHandler("publish", publish))
tg_app.add_handler(CallbackQueryHandler(button_handler, pattern="^(apply_|approve_|reject_)"))
tg_app.add_handler(CallbackQueryHandler(limit_type_handler, pattern="^limit_"))
tg_app.add_handler(MessageHandler(filters.PHOTO | filters.VIDEO, media_handler))
tg_app.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), text_handler))


# Flask 路由：Webhook 接收器
@flask_app.route(WEBHOOK_PATH, methods=["POST"])
def webhook():
    update = Update.de_json(request.get_json(force=True), tg_app.bot)
    tg_app.update_queue.put(update)
    return "OK"


# 设置 webhook 并运行服务
if __name__ == "__main__":
    import asyncio

    async def setup_webhook():
        url = f"https://{os.getenv('RENDER_EXTERNAL_HOSTNAME')}{WEBHOOK_PATH}"
        await tg_app.bot.set_webhook(url)
        print(f"Webhook set to {url}")

    asyncio.run(setup_webhook())
    flask_app.run(host="0.0.0.0", port=PORT)