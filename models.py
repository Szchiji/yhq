from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship, declarative_base
import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(Integer, unique=True, index=True, nullable=False)
    username = Column(String, index=True, nullable=True)
    is_member = Column(Boolean, default=False)
    status = Column(String, default="")
    last_publish = Column(DateTime, nullable=True)

    drafts = relationship("Draft", back_populates="user")

class Draft(Base):
    __tablename__ = "drafts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    media_file_id = Column(String, nullable=False)
    media_type = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    user = relationship("User", back_populates="drafts")
    coupons = relationship("Coupon", back_populates="draft", cascade="all, delete-orphan")

class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, index=True)
    draft_id = Column(Integer, ForeignKey("drafts.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    price = Column(String, nullable=False)
    limit_type = Column(String, nullable=False)

    draft = relationship("Draft", back_populates="coupons")