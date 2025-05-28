from flask import Flask, request
from telegram import Update
from telegram.ext import Application

from bot import application  # 从 bot.py 中导入 application 对象

import os

TOKEN = os.getenv("BOT_TOKEN")
WEBHOOK_URL = os.getenv("WEBHOOK_URL")  # 例如：https://your-app.onrender.com

app = Flask(__name__)

@app.route(f"/{TOKEN}", methods=["POST"])
async def webhook():
    update = Update.de_json(request.get_json(force=True), application.bot)
    await application.process_update(update)
    return "OK"

@app.route("/", methods=["GET"])
def home():
    return "Bot is running!"

if __name__ == "__main__":
    import asyncio
    asyncio.run(application.bot.set_webhook(url=f"{WEBHOOK_URL}/{TOKEN}"))
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 10000)))