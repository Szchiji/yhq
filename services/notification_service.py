"""
通知服务
封装 utils.notifications 的通知功能
"""
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


class NotificationService:
    """通知业务服务"""

    def __init__(self):
        from utils.notifications import TelegramNotifier, EmailNotifier
        self._telegram = TelegramNotifier()
        self._email = EmailNotifier()

    def set_bot(self, bot):
        """设置 Telegram bot 实例"""
        self._telegram.set_bot(bot)

    def set_admin_ids(self, admin_ids: List[int]):
        """设置管理员 ID 列表"""
        self._telegram.set_admin_ids(admin_ids)

    async def send_telegram(
        self, user_id: int, message: str, parse_mode: str = "HTML"
    ) -> bool:
        return await self._telegram.send_to_user(user_id, message, parse_mode)

    async def notify_admins(self, message: str) -> int:
        return await self._telegram.notify_admins(message)

    async def send_email(
        self,
        to: str,
        subject: str,
        body: str,
        html: bool = True,
    ) -> bool:
        return await self._email.send_email(to, subject, body, html)

    async def notify_system_event(self, event_type: str, details: str = ""):
        await self._telegram.notify_system_event(event_type, details)


# 全局实例
notification_service = NotificationService()
