from uuid import uuid4
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, BigInteger, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import mapped_column, Mapped
from models.base import Base

_DEFAULT_START_CONTENT = {
    "text": "欢迎使用报告管理机器人！",
    "mediaType": "none",
    "mediaUrl": "",
    "buttons": [],
}
_DEFAULT_KEYBOARDS = [
    {"text": "📝 写报告", "action": "write_report"},
    {"text": "🔍 查阅报告", "action": "query_report"},
    {"text": "📞 联系管理员", "action": "contact_admin"},
    {"text": "❓ 操作帮助", "action": "help"},
]
_DEFAULT_REVIEW_FEEDBACK = {
    "approved": "✅ 你的报告已通过审核，已推送到频道。",
    "rejected": "❌ 你的报告未通过审核，请修改后重新提交。",
    "pending": "⏳ 你的报告已提交，等待管理员审核。",
}
_DEFAULT_REPORT_TEMPLATE = {"fields": []}


class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    admin_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False)
    channel_id: Mapped[str] = mapped_column(String(256), default="", server_default="")
    push_channel_id: Mapped[str] = mapped_column(String(256), default="", server_default="")
    start_content: Mapped[dict] = mapped_column(JSONB, default=lambda: dict(_DEFAULT_START_CONTENT))
    keyboards: Mapped[list] = mapped_column(JSONB, default=lambda: list(_DEFAULT_KEYBOARDS))
    report_template: Mapped[dict] = mapped_column(JSONB, default=lambda: dict(_DEFAULT_REPORT_TEMPLATE))
    review_feedback: Mapped[dict] = mapped_column(JSONB, default=lambda: dict(_DEFAULT_REVIEW_FEEDBACK))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "_id": str(self.id),
            "adminId": self.admin_id,
            "channelId": self.channel_id or "",
            "pushChannelId": self.push_channel_id or "",
            "startContent": (self.start_content or _DEFAULT_START_CONTENT).copy(),
            "keyboards": list(self.keyboards or _DEFAULT_KEYBOARDS),
            "reportTemplate": (self.report_template or _DEFAULT_REPORT_TEMPLATE).copy(),
            "reviewFeedback": (self.review_feedback or _DEFAULT_REVIEW_FEEDBACK).copy(),
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
