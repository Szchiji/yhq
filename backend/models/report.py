from uuid import uuid4
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Integer, BigInteger, Text, DateTime, Identity
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.orm import mapped_column, Mapped
from models.base import Base


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    report_number: Mapped[int] = mapped_column(Integer, Identity(), unique=True, nullable=False)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    username: Mapped[str] = mapped_column(String(256), default="", server_default="")
    first_name: Mapped[str] = mapped_column(String(256), default="", server_default="")
    content: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    title: Mapped[str] = mapped_column(String(1024), default="", server_default="")
    description: Mapped[Optional[str]] = mapped_column(Text, default="", server_default="")
    tags: Mapped[List[str]] = mapped_column(ARRAY(String), default=list, server_default="{}")
    status: Mapped[str] = mapped_column(String(16), default="pending", server_default="pending")
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    review_note: Mapped[Optional[str]] = mapped_column(Text, default="", server_default="")
    channel_message_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "_id": self.id,
            "reportNumber": self.report_number,
            "userId": self.user_id,
            "username": self.username or "",
            "firstName": self.first_name or "",
            "content": self.content or {},
            "title": self.title or "",
            "description": self.description or "",
            "tags": self.tags or [],
            "status": self.status,
            "reviewedAt": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "reviewedBy": self.reviewed_by,
            "reviewNote": self.review_note or "",
            "channelMessageId": self.channel_message_id,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
