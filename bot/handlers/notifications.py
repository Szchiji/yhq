"""
Bot 通知处理器
"""
import logging
from aiogram import Router
from aiogram.types import Message

logger = logging.getLogger(__name__)
router = Router()


async def send_startup_notification(bot, admin_ids: list, bot_info) -> None:
    """发送机器人启动通知"""
    import datetime
    for admin_id in admin_ids:
        try:
            await bot.send_message(
                admin_id,
                f"✅ 机器人已启动！\n\n"
                f"机器人：@{bot_info.username}\n"
                f"ID：{bot_info.id}\n"
                f"时间：{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
            )
        except Exception as e:
            logger.warning(f"⚠️ 无法通知管理员 {admin_id}：{e}")
