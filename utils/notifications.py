"""
通知系统模块
支持 Telegram 通知和邮件通知
"""

import asyncio
import logging
import os
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional

logger = logging.getLogger(__name__)


class TelegramNotifier:
    """Telegram 通知发送器"""

    def __init__(self, bot=None, admin_ids: Optional[List[int]] = None):
        self._bot = bot
        self._admin_ids: List[int] = admin_ids or []

    def set_bot(self, bot):
        """设置 bot 实例（在 bot 启动后调用）"""
        self._bot = bot

    def set_admin_ids(self, admin_ids: List[int]):
        """设置管理员 ID 列表"""
        self._admin_ids = admin_ids

    async def send_to_user(
        self,
        user_id: int,
        message: str,
        parse_mode: str = "HTML",
    ) -> bool:
        """向指定用户发送消息"""
        if not self._bot:
            logger.warning("Bot 实例未设置，无法发送 Telegram 通知")
            return False
        try:
            await self._bot.send_message(user_id, message, parse_mode=parse_mode)
            return True
        except Exception as e:
            logger.error(f"Telegram 发送失败 [{user_id}]：{e}")
            return False

    async def notify_admins(self, message: str, parse_mode: str = "HTML") -> int:
        """向所有管理员发送通知，返回成功数量"""
        if not self._admin_ids:
            logger.warning("未配置管理员 ID")
            return 0
        success = 0
        for admin_id in self._admin_ids:
            if await self.send_to_user(admin_id, message, parse_mode):
                success += 1
        return success

    async def notify_system_event(self, event_type: str, details: str = ""):
        """发送系统事件通知给管理员"""
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        message = (
            f"🔔 <b>系统通知</b>\n"
            f"事件：{event_type}\n"
            f"时间：{timestamp}"
        )
        if details:
            message += f"\n详情：{details}"
        await self.notify_admins(message)


class EmailNotifier:
    """邮件通知发送器"""

    def __init__(self):
        self._smtp_host = os.getenv("SMTP_HOST", "")
        self._smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self._smtp_user = os.getenv("SMTP_USER", "")
        self._smtp_password = os.getenv("SMTP_PASSWORD", "")
        self._from_email = os.getenv("SMTP_FROM_EMAIL", self._smtp_user)
        self._use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

    @property
    def is_configured(self) -> bool:
        """检查邮件是否已配置"""
        return bool(self._smtp_host and self._smtp_user and self._smtp_password)

    async def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        html_body: Optional[str] = None,
    ) -> bool:
        """发送邮件（在线程池中运行以避免阻塞）"""
        if not self.is_configured:
            logger.warning("邮件未配置，跳过发送")
            return False
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                self._send_sync,
                to_email,
                subject,
                body,
                html_body,
            )
            return True
        except Exception as e:
            logger.error(f"邮件发送失败 [{to_email}]：{e}")
            return False

    def _send_sync(
        self,
        to_email: str,
        subject: str,
        body: str,
        html_body: Optional[str],
    ):
        """同步发送邮件"""
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = self._from_email
        msg["To"] = to_email

        msg.attach(MIMEText(body, "plain", "utf-8"))
        if html_body:
            msg.attach(MIMEText(html_body, "html", "utf-8"))

        if self._use_tls:
            server = smtplib.SMTP(self._smtp_host, self._smtp_port)
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(self._smtp_host, self._smtp_port)

        server.login(self._smtp_user, self._smtp_password)
        server.sendmail(self._from_email, to_email, msg.as_string())
        server.quit()
        logger.info(f"邮件已发送至：{to_email}")

    async def send_alert_email(
        self,
        to_email: str,
        alert_type: str,
        details: str,
    ) -> bool:
        """发送告警邮件"""
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        subject = f"[告警] {alert_type}"
        body = f"告警类型：{alert_type}\n时间：{timestamp}\n详情：{details}"
        html_body = (
            f"<h2>系统告警</h2>"
            f"<p><strong>告警类型：</strong>{alert_type}</p>"
            f"<p><strong>时间：</strong>{timestamp}</p>"
            f"<p><strong>详情：</strong>{details}</p>"
        )
        return await self.send_email(to_email, subject, body, html_body)


class NotificationQueue:
    """通知队列（防止消息风暴）"""

    def __init__(self, max_queue_size: int = 100):
        self._queue: asyncio.Queue = asyncio.Queue(maxsize=max_queue_size)
        self._running = False

    async def enqueue(self, coro) -> bool:
        """将通知协程加入队列"""
        try:
            self._queue.put_nowait(coro)
            return True
        except asyncio.QueueFull:
            logger.warning("通知队列已满，丢弃通知")
            return False

    async def start_worker(self):
        """启动队列消费工作线程"""
        self._running = True
        while self._running:
            try:
                coro = await asyncio.wait_for(self._queue.get(), timeout=1.0)
                try:
                    await coro
                except Exception as e:
                    logger.error(f"通知执行失败：{e}")
                finally:
                    self._queue.task_done()
            except asyncio.TimeoutError:
                continue

    def stop(self):
        """停止队列工作线程"""
        self._running = False


class NotificationService:
    """统一通知服务"""

    def __init__(self):
        self.telegram = TelegramNotifier()
        self.email = EmailNotifier()
        self.queue = NotificationQueue()

    def setup(self, bot, admin_ids: List[int]):
        """初始化通知服务（在 bot 启动后调用）"""
        self.telegram.set_bot(bot)
        self.telegram.set_admin_ids(admin_ids)
        logger.info(f"通知服务已初始化，管理员：{admin_ids}")

    async def notify_admin(self, message: str) -> int:
        """向管理员发送 Telegram 通知"""
        return await self.telegram.notify_admins(message)

    async def notify_user(self, user_id: int, message: str) -> bool:
        """向用户发送 Telegram 通知"""
        return await self.telegram.send_to_user(user_id, message)

    async def send_alert(
        self,
        alert_type: str,
        details: str,
        notify_telegram: bool = True,
        notify_email: bool = False,
        email_to: Optional[str] = None,
    ):
        """发送告警（支持多渠道）"""
        if notify_telegram:
            await self.telegram.notify_system_event(alert_type, details)

        if notify_email and email_to:
            await self.email.send_alert_email(email_to, alert_type, details)


# 全局实例
notification_service = NotificationService()
