import os
import logging
import asyncio
from flask import Flask, request
from telegram import Update, Bot
from telegram.ext import (
    Application,
    ApplicationBuilder,
    ContextTypes,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    filters,
)
import asyncpg
from dotenv import load_dotenv

load_dotenv()

# 配置日志
logging.basicConfig(level=logging.INFO)

# 环境变量
BOT_TOKEN = os.getenv("BOT_TOKEN")
CHANNEL_ID = int(os.getenv("CHANNEL_ID"))
ADMIN_ID = int(os.getenv("ADMIN_ID"))
DATABASE_URL = os.getenv("DATABASE_URL")

# Flask 实例
app = Flask(__name__)

# Telegram Bot 实例
application: Application = ApplicationBuilder().token(BOT_TOKEN).build()

# Webhook 路由
@app.route("/", methods=["GET"])
def index():
    return "Bot is alive!"

@app.route("/webhook", methods=["POST"])
async def webhook():
    if request.method == "POST":
        await application.update_queue.put(Update.de_json(request.get_json(force=True), application.bot))
        return "ok"

# 初始化数据库（略简化）
async def init_db():
    app.db_pool = await asyncpg.create_pool(DATABASE_URL)
    async with app.db_pool.acquire() as conn:
        await conn.execute("""
        CREATE TABLE IF NOT EXISTS whitelist (
            user_id BIGINT PRIMARY KEY,
            expires_at TIMESTAMP
        );
        """)

# 示例 /start 命令
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("你好，这是一个测试机器人！")

# 注册 handler
application.add_handler(CommandHandler("start", start))

# 启动 Flask + Webhook
if __name__ == "__main__":
    async def main():
        await init_db()
        await application.initialize()
        await application.bot.set_webhook(f"{os.getenv('WEBHOOK_URL')}/webhook")
        port = int(os.environ.get("PORT", 5000))
        app.run(host="0.0.0.0", port=port)

    asyncio.run(main())