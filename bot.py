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
    filters,
    CallbackQueryHandler,
    ContextTypes,
)

# 日志配置
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO
)
logger = logging.getLogger(__name__)

# --- 配置区域 ---
BOT_TOKEN = os.getenv("BOT_TOKEN")  # Telegram Bot Token
ADMIN_ID = int(os.getenv("ADMIN_ID"))  # 管理员 Telegram 用户ID（数字）
CHANNEL_ID = int(os.getenv("CHANNEL_ID"))  # 发布消息的频道ID，例：-1001234567890
WEBHOOK_URL = os.getenv("WEBHOOK_URL")  # 你部署后的公网地址 + /TOKEN 结尾
DATA_FILE = "data.json"
PORT = int(os.getenv("PORT", 8443))  # Render默认端口

# Flask App
flask_app = Flask(__name__)

# --- 读写 JSON 数据函数 ---
def load_data():
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        # 默认结构
        return {
            "whitelist": {},  # 用户ID: 到期时间 iso格式
            "banlist": [],    # 封禁用户ID列表
            "config": {
                "template": "数量：{quantity}\n价格：{price}\n限制类型：{limit_type}"
            }
        }


def save_data():
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data_json, f, ensure_ascii=False, indent=2)


data_json = load_data()

# --- 用户发布状态缓存（内存） ---
user_states = {}

# --- 辅助函数 ---
def check_permission(user_id):
    """检查用户是否有权限发布"""
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


# --- 命令处理函数 ---
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if check_permission(user_id):
        await update.message.reply_text("你已拥有发布权限，发送 /publish 开始发布内容。")
        return
    # 发送申请按钮
    keyboard = InlineKeyboardMarkup([[
        InlineKeyboardButton("申请发布权限", callback_data=f"apply_{user_id}")
    ]])
    await update.message.reply_text(
        "你当前没有发布权限，点击下方按钮向管理员申请。", reply_markup=keyboard
    )


async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data
    user_id = query.from_user.id

    if data.startswith("apply_"):
        # 用户申请发布权限
        if check_permission(user_id):
            await query.edit_message_text("你已拥有发布权限，无需重复申请。")
            return
        # 发送申请给管理员
        await context.bot.send_message(
            chat_id=ADMIN_ID,
            text=f"用户 {user_id} 申请发布权限。请回复 /approve {user_id} 或 /reject {user_id}"
        )
        await query.edit_message_text("申请已发送，请等待管理员审核。")

    elif data.startswith("limit_"):
        # 限制类型选择回调
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
            f"请确认发布信息：\n"
            f"数量：{state['quantity']}\n"
            f"价格：{state['price']}\n"
            f"限制类型：{state['limit_type']}\n"
            "确认发布请回复“是”，取消请回复“否”。"
        )
        await query.edit_message_text(text)


async def approve(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("无权限。")
        return
    if len(context.args) != 1:
        await update.message.reply_text("用法：/approve 用户ID")
        return
    try:
        user_id = int(context.args[0])
    except:
        await update.message.reply_text("用户ID格式错误。")
        return
    # 授权30天
    expire = datetime.utcnow() + timedelta(days=30)
    data_json["whitelist"][str(user_id)] = expire.isoformat()
    save_data()
    await update.message.reply_text(f"已批准用户 {user_id} 发布权限，有效期30天。")
    try:
        await context.bot.send_message(user_id, "管理员已批准你发布权限，你可以发送 /publish 开始发布内容。")
    except Exception as e:
        logger.warning(f"无法发送消息给用户 {user_id}，原因：{e}")


async def reject(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("无权限。")
        return
    if len(context.args) != 1:
        await update.message.reply_text("用法：/reject 用户ID")
        return
    try:
        user_id = int(context.args[0])
    except:
        await update.message.reply_text("用户ID格式错误。")
        return
    await update.message.reply_text(f"已拒绝用户 {user_id} 发布权限申请。")
    try:
        await context.bot.send_message(user_id, "管理员拒绝了你的发布权限申请。")
    except Exception as e:
        logger.warning(f"无法发送消息给用户 {user_id}，原因：{e}")


async def ban(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("无权限。")
        return
    if len(context.args) != 1:
        await update.message.reply_text("用法：/ban 用户ID")
        return
    try:
        user_id = int(context.args[0])
    except:
        await update.message.reply_text("用户ID格式错误。")
        return
    if user_id not in data_json["banlist"]:
        data_json["banlist"].append(user_id)
        # 同时移除发布权限
        data_json["whitelist"].pop(str(user_id), None)
        save_data()
    await update.message.reply_text(f"用户 {user_id} 已被封禁。")


async def unban(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("无权限。")
        return
    if len(context.args) != 1:
        await update.message.reply_text("用法：/unban 用户ID")
        return
    try:
        user_id = int(context.args[0])
    except:
        await update.message.reply_text("用户ID格式错误。")
        return
    if user_id in data_json["banlist"]:
        data_json["banlist"].remove(user_id)
        save_data()
        await update.message.reply_text(f"用户 {user_id} 已解封。")
    else:
        await update.message.reply_text(f"用户 {user_id} 未被封禁。")


async def publish(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if not check_permission(user_id):
        await update.message.reply_text("你没有发布权限，先使用 /start 申请。")
        return
    user_states[user_id] = {"step": "awaiting_media"}
    await update.message.reply_text(
        "请发送你要发布的照片或视频（单个）"
    )


async def media_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if user_id not in user_states or user_states[user_id].get("step") != "awaiting_media":
        return  # 不处理非发布流程中的多媒体消息
    message = update.message
    if message.photo:
        # 取最大分辨率的照片
        file_id = message.photo[-1].file_id
        media_type = "photo"
    elif message.video:
        file_id = message.video.file_id
        media_type = "video"
    else:
        await message.reply_text("请发送照片或视频。")
        return

    user_states[user_id].update({
        "file_id": file_id,
        "media_type": media_type,
        "step": "awaiting_quantity"
    })
    await message.reply_text("已接收媒体。请输入数量（整数）:")


async def text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if user_id not in user_states:
        return  # 非发布流程中的文本不处理
    state = user_states[user_id]
    text = update.message.text.strip()

    step = state.get("step")
    if step == "awaiting_quantity":
        if not text.isdigit():
            await update.message.reply_text("请输入有效的整数数量。")
            return
        state["quantity"] = text
        state["step"] = "awaiting_price"
        await update.message.reply_text("请输入价格（数字）：")

    elif step == "awaiting_price":
        try:
            float(text)  # 只要能转成浮点数就行
            state["price"] = text
            state["step"] = "awaiting_limit_type"

            # 发送限制类型选择按钮
            keyboard = InlineKeyboardMarkup([
                [
                    InlineKeyboardButton("P", callback_data="limit_P"),
                    InlineKeyboardButton("PP", callback_data="limit_PP"),
                    InlineKeyboardButton("通用", callback_data="limit_general"),
                ]
            ])
            await update.message.reply_text("请选择限制类型：", reply_markup=keyboard)
        except:
            await update.message.reply_text("请输入有效的价格数字。")

    elif step == "awaiting_confirmation":
        if text == "是":
            # 确认发布，发送到频道
            tpl = data_json["config"]["template"]
            info_text = tpl.format(
                quantity=state["quantity"],
                price=state["price"],
                limit_type=state["limit_type"]
            )
            caption = info_text

            try:
                if state["media_type"] == "photo":
                    await context.bot.send_photo(
                        chat_id=CHANNEL_ID,
                        photo=state["file_id"],
                        caption=caption
                    )
                else:
                    await context.bot.send_video(
                        chat_id=CHANNEL_ID,
                        video=state["file_id"],
                        caption=caption
                    )
                await update.message.reply_text("发布成功！")
            except Exception as e:
                await update.message.reply_text(f"发布失败，错误：{e}")

            user_states.pop(user_id, None)
        elif text == "否":
            await update.message.reply_text("已取消发布。")
            user_states.pop(user_id, None)
        else:
            await update.message.reply_text('请回复“是”确认发布，或“否”取消。')

    else:
        # 其他情况忽略
        pass


async def settemplate(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("无权限。")
        return
    if not context.args:
        await update.message.reply_text("用法：/settemplate 模板文本，模板中可用变量：{quantity} {price} {limit_type}")
        return
    tpl_text = " ".join(context.args)
    data_json["config"]["template"] = tpl_text
    save_data()
    await update.message.reply_text("模板已更新。")


async def extend(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("无权限。")
        return
    if len(context.args) != 2:
        await update.message.reply_text("用法：/extend 用户ID 天数")
        return
    try:
        user_id = int(context.args[0])
        days = int(context.args[1])
    except:
        await update.message.reply_text("参数格式错误。")
        return
    expire_str = data_json["whitelist"].get(str(user_id))
    if expire_str:
        expire_dt = datetime.fromisoformat(expire_str)
        if expire_dt < datetime.utcnow():
            expire_dt = datetime.utcnow()
    else:
        expire_dt = datetime.utcnow()
    new_expire = expire_dt + timedelta(days=days)
    data_json["whitelist"][str(user_id)] = new_expire.isoformat()
    save_data()
    await update.message.reply_text(f"用户 {user_id} 发布权限延长 {days} 天，有效期至 {new_expire}。")


# --- Flask Webhook 路由 ---
@flask_app.route(f"/{BOT_TOKEN}", methods=["POST"])
def webhook():
    """Flask 同步接口接收 Telegram Webhook"""
    json_data = request.get_json(force=True)
    update = Update.de_json(json_data, application.bot)

    # 使用 asyncio.create_task 发送更新到队列
    asyncio.get_event_loop().create_task(application.update_queue.put(update))

    return "ok"


# --- 主异步启动函数 ---
async def main():
    global application
    application = ApplicationBuilder().token(BOT_TOKEN).build()

    # 添加处理器
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CallbackQueryHandler(button_handler))
    application.add_handler(CommandHandler("approve", approve))
    application.add_handler(CommandHandler("reject", reject))
    application.add_handler(CommandHandler("ban", ban))
    application.add_handler(CommandHandler("unban", unban))
    application.add_handler(CommandHandler("publish", publish))
    application.add_handler(CommandHandler("settemplate", settemplate))
    application.add_handler(CommandHandler("extend", extend))
    application.add_handler(MessageHandler(filters.PHOTO | filters.VIDEO, media_handler))
    application.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), text_handler))

    # 设置Webhook
    await application.bot.set_webhook(WEBHOOK_URL)
    logger.info(f"Webhook 设置完成: {WEBHOOK_URL}")

    # 启动 Flask
    # Flask 运行阻塞，需在单独线程运行
    import threading
    def run_flask():
        flask_app.run(host="0.0.0.0", port=PORT)

    flask_thread = threading.Thread(target=run_flask)
    flask_thread.start()

    # 运行 Bot，处理更新队列
    await application.initialize()
    await application.start()
    await application.updater.start_polling()  # 用轮询启动Updater也可以，但这里用update_queue模式
    await application.updater.idle()

if __name__ == "__main__":
    # 环境变量或你本地直接设置
    if not BOT_TOKEN or not ADMIN_ID or not CHANNEL_ID or not WEBHOOK_URL:
        print("请设置环境变量 BOT_TOKEN, ADMIN_ID, CHANNEL_ID, WEBHOOK_URL")
        exit(1)
    asyncio.run(main())