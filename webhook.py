from flask import Flask, request
from bot import application
import os

app = Flask(__name__)

@app.route("/", methods=["POST"])
def webhook():
    if request.method == "POST":
        update = request.get_json(force=True)
        application.update_queue.put_nowait(update)
        return "OK", 200

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)