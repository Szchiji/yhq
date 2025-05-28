import json
from datetime import datetime, timedelta
import os

DATA_FILE = "data.json"

def load_data():
    if not os.path.exists(DATA_FILE):
        return {"vip": {}, "ban": [], "template": "", "options": {}}
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def is_vip(user_id):
    data = load_data()
    vip_info = data.get("vip", {}).get(str(user_id))
    if not vip_info:
        return False
    expire_str = vip_info.get("expire")
    try:
        expire_time = datetime.strptime(expire_str, "%Y-%m-%d")
        return expire_time >= datetime.now()
    except:
        return False

def add_vip(user_id, days):
    data = load_data()
    user_id = str(user_id)
    expire = datetime.now() + timedelta(days=days)
    data.setdefault("vip", {})[user_id] = {"expire": expire.strftime("%Y-%m-%d")}
    save_data(data)

def del_vip(user_id):
    data = load_data()
    user_id = str(user_id)
    data.get("vip", {}).pop(user_id, None)
    save_data(data)

def render_template(options: dict, username: str) -> str:
    data = load_data()
    template = data.get("template", "")
    result = template.replace("{发布人}", f"@{username}")
    for key, value in options.items():
        result = result.replace(f"{{{key}}}", value)
    return result