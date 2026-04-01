from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, BigInteger, DateTime
from sqlalchemy.orm import mapped_column, Mapped
from models.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False)
    username: Mapped[str] = mapped_column(String(256), default="", server_default="")
    first_name: Mapped[str] = mapped_column(String(256), default="", server_default="")
    last_name: Mapped[str] = mapped_column(String(256), default="", server_default="")
    is_subscribed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
