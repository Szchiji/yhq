from telegram import (
    Update, InlineKeyboardButton, InlineKeyboardMarkup,
    InputMediaPhoto, InputMediaVideo
)
from telegram.ext import (
    Application, CommandHandler, MessageHandler, filters,
    CallbackContext, CallbackQueryHandler, ConversationHandler
)
import os
from utils import *
from datetime import datetime

BOT_TOKEN = os.getenv("BOT_TOKEN", "7098191858:AAEOL8NazzqpCh9iJjv-YpkTUFukfEbdFyg")
CHANNEL_ID = -1002669687216
ADMIN_ID = 7848870377

application = Application.builder().token(BOT_TOKEN).build()

STEP_MEDIA, STEP_SELECT, STEP_REMARK = range(3)
user_state = {}

async def start(update: Update, context: CallbackContext):
    await update.message.reply_text("欢迎使用频道发布机器人，请使用 /publish 开始发布。")

async def publish(update: Update, context: CallbackContext):
    user_id = update.effective_user.id
    if not is_vip(user_id):
        await update.message.reply_text("您不是会员或已过期，无法发布。")
        return ConversationHandler.END
    user_state[user_id] = {
        "media": [],
        "data": {}
    }
    await update.message.reply_text("请发送图片或视频（可多张），发送完后输入任意文字继续。")
    return STEP_MEDIA

async def collect_media(update: Update, context: CallbackContext):
    user_id = update.effective_user.id
    if "media" not in user_state.get(user_id, {}):
        return STEP_MEDIA
    media = update.message.photo or ([update.message.video] if update.message.video else [])
    if media:
        file_id = media[-1].file_id
        kind = "photo" if update.message.photo else "video"
        user_state[user_id]["media"].append((kind, file_id))
    return STEP_MEDIA

async def proceed_options(update: Update, context: CallbackContext):
    user_id = update.effective_user.id
    data = load_data()
    options = data.get("options", {})
    if not options:
        await update.message.reply_text("发布选项未设置，请联系管理员。")
        return ConversationHandler.END
    first_key = list(options.keys())[0]
    return await send_option_buttons(update, context, first_key)

async def send_option_buttons(update, context, current_key):
    user_id = update.effective_user.id
    data = load_data()
    options = data["options"]
    if current_key not in options:
        await update.message.reply_text("无效选项。")
        return ConversationHandler.END
    buttons = [
        [InlineKeyboardButton(text=val, callback_data=f"{current_key}:{val}")]
        for val in options[current_key]
    ]
    await update.message.reply_text(f"请选择 {current_key}：", reply_markup=InlineKeyboardMarkup(buttons))
    return STEP_SELECT

async def button_handler(update: Update, context: CallbackContext):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    key, value = query.data.split(":")
    user_state[user_id]["data"][key] = value
    data = load_data()
    options = data["options"]
    keys = list(options.keys())
    current_index = keys.index(key)
    if current_index + 1 < len(keys):
        next_key = keys[current_index + 1]
        return await send_option_buttons(query, context, next_key)
    else:
        await query.message.reply_text("请输入备注：")
        return STEP_REMARK

async def final_remark(update: Update, context: CallbackContext):
    user_id = update.effective_user.id
    username = update.effective_user.username or "匿名"
    remark = update.message.text.strip()
    user_state[user_id]["data"]["备注"] = remark
    text = render_template(user_state[user_id]["data"], username)
    media = user_state[user_id]["media"]
    if len(media) == 1:
        kind, file_id = media[0]
        if kind == "photo":
            await context.bot.send_photo(CHANNEL_ID, file_id, caption=text)
        else:
            await context.bot.send_video(CHANNEL_ID, file_id, caption=text)
    elif media:
        group = []
        for idx, (kind, file_id) in enumerate(media):
            if kind == "photo":
                group.append(InputMediaPhoto(media=file_id, caption=text if idx == 0 else None))
            else:
                group.append(InputMediaVideo(media=file_id, caption=text if idx == 0 else None))
        await context.bot.send_media_group(CHANNEL_ID, media=group)
    else:
        await context.bot.send_message(CHANNEL_ID, text=text)
    await update.message.reply_text("发布成功！")
    user_state.pop(user_id, None)
    return ConversationHandler.END

async def cancel(update: Update, context: CallbackContext):
    user_state.pop(update.effective_user.id, None)
    await update.message.reply_text("发布已取消。")
    return ConversationHandler.END

async def admin_commands(update: Update, context: CallbackContext):
    user_id = update.effective_user.id
    if user_id != ADMIN_ID:
        return
    cmd = update.message.text
    args = cmd.split()
    data = load_data()

    if cmd.startswith("/addvip") and len(args) == 3:
        add_vip(args[1], int(args[2]))
        await update.message.reply_text("已添加会员")
    elif cmd.startswith("/delvip") and len(args) == 2:
        del_vip(args[1])
        await update.message.reply_text("已删除会员")
    elif cmd.startswith("/setoptions") and len(args) >= 2:
        option_string = " ".join(args[1:])
        try:
            parts = option_string.split("|")
            options = {}
            for part in parts:
                key, values = part.split(":")
                options[key] = values.split(",")
            data["options"] = options
            save_data(data)
            await update.message.reply_text("发布选项已更新")
        except:
            await update.message.reply_text("格式错误，请用 数量:1,5|价格:10元,50元")
    elif cmd.startswith("/settemplate") and len(args) >= 2:
        data["template"] = cmd.replace("/settemplate ", "", 1)
        save_data(data)
        await update.message.reply_text("模板已更新")

application.add_handler(CommandHandler("start", start))
application.add_handler(CommandHandler("publish", publish))
application.add_handler(CommandHandler("cancel", cancel))
application.add_handler(CommandHandler("addvip", admin_commands))
application.add_handler(CommandHandler("delvip", admin_commands))
application.add_handler(CommandHandler("setoptions", admin_commands))
application.add_handler(CommandHandler("settemplate", admin_commands))

conv_handler = ConversationHandler(
    entry_points=[CommandHandler("publish", publish)],
    states={
        STEP_MEDIA: [MessageHandler(filters.ALL & ~filters.COMMAND, collect_media),
                     MessageHandler(filters.TEXT & ~filters.COMMAND, proceed_options)],
        STEP_SELECT: [CallbackQueryHandler(button_handler)],
        STEP_REMARK: [MessageHandler(filters.TEXT & ~filters.COMMAND, final_remark)]
    },
    fallbacks=[CommandHandler("cancel", cancel)]
)
application.add_handler(conv_handler)