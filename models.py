from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    telegram_id = Column(Integer, unique=True, index=True)
    username = Column(String, index=True)
    is_member = Column(Boolean, default=False)
    status = Column(String, default="")

class Draft(Base):
    __tablename__ = "drafts"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    media_file_id = Column(String)
    media_type = Column(String)
    is_finished = Column(Boolean, default=False)
    coupons = relationship("Coupon", back_populates="draft")

class Coupon(Base):
    __tablename__ = "coupons"
    id = Column(Integer, primary_key=True)
    draft_id = Column(Integer, ForeignKey("drafts.id"))
    quantity = Column(Integer)
    price = Column(String)
    limit_type = Column(String)
    draft = relationship("Draft", back_populates="coupons")