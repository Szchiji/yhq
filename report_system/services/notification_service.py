"""
企业级通知服务
"""
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


class NotificationServiceEnterprise:
    """企业级通知服务"""

    def __init__(self):
        from services.notification_service import NotificationService
        self._base = NotificationService()

    def set_bot(self, bot):
        self._base.set_bot(bot)

    def set_admin_ids(self, admin_ids: List[int]):
        self._base.set_admin_ids(admin_ids)

    async def notify_report_approved(self, submitter_id: int, report_id: int):
        """通知报告提交者报告已通过"""
        message = (
            f"✅ <b>报告已通过审核</b>\n"
            f"您的报告（ID: {report_id}）已审核通过，感谢您的提交！"
        )
        await self._base.send_telegram(submitter_id, message)

    async def notify_report_rejected(
        self, submitter_id: int, report_id: int, reason: str = ""
    ):
        """通知报告提交者报告被拒绝"""
        message = (
            f"❌ <b>报告未通过审核</b>\n"
            f"您的报告（ID: {report_id}）未通过审核。"
        )
        if reason:
            message += f"\n原因：{reason}"
        await self._base.send_telegram(submitter_id, message)

    async def notify_new_report(self, report_id: int, teacher: str):
        """通知管理员有新报告待审核"""
        message = (
            f"📋 <b>新报告待审核</b>\n"
            f"报告 ID：{report_id}\n"
            f"教师：{teacher}"
        )
        await self._base.notify_admins(message)

    async def send_system_alert(self, event_type: str, details: str = ""):
        await self._base.notify_system_event(event_type, details)

    async def send_email_notification(
        self, to: str, subject: str, body: str
    ) -> bool:
        return await self._base.send_email(to, subject, body)
