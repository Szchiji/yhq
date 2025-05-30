from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(Integer, unique=True, index=True, nullable=False)
    username = Column(String, index=True, nullable=True)
    is_member = Column(Boolean, default=False)   # 是否已审核成为会员
    status = Column(String, default="")          # 用户当前状态，用于发布流程管理
    last_publish = Column(DateTime, nullable=True)  # 上次发布时间（可选）

    drafts = relationship("Draft", back_populates="user")

class Draft(Base):
    __tablename__ = "drafts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    media_file_id = Column(String, nullable=False)   # Telegram 媒体 file_id
    media_type = Column(String, nullable=False)      # "photo" 或 "video"
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    user = relationship("User", back_populates="drafts")
    coupons = relationship("Coupon", back_populates="draft", cascade="all, delete-orphan")

class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, index=True)
    draft_id = Column(Integer, ForeignKey("drafts.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    price = Column(String, nullable=False)
    limit_type = Column(String, nullable=False)  # 限制类型（如 限 P/限 PP/通用）

    draft = relationship("Draft", back_populates="coupons")