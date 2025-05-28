import os
from flask import Flask, request
from bot import application

app = Flask(__name__)

@app.route("/", methods=["POST"])
def webhook():
    if request.method == "POST":
        application.update_queue.put_nowait(request.get_json(force=True))
        return "ok"

@app.route("/", methods=["GET"])
def health_check():
    return "Bot is running."

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"✅ Running on port {port} ...")
    app.run(host="0.0.0.0", port=port)