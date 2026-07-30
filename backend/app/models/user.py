from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from ..database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    force_password_change = Column(Boolean, default=False)
    otp_code = Column(String(255), nullable=True)  # bcrypt hash = 60 chars
    otp_expires = Column(DateTime, nullable=True)
    reset_token = Column(String(255), nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    groups = relationship("TrackingGroup", back_populates="owner", cascade="all, delete-orphan")

class TrackingGroup(Base):
    __tablename__ = "tracking_groups"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_default = Column(Boolean, default=False)  # True = this is the "ברירת מחדל" group
    is_visible = Column(Boolean, default=True)    # Admin controls: user can see/edit this group
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    owner = relationship("User", back_populates="groups")
    items = relationship("TrackingItem", back_populates="group", cascade="all, delete-orphan")

class TrackingItem(Base):
    __tablename__ = "tracking_items"
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("tracking_groups.id"), nullable=False)
    car_code = Column(String(50), nullable=False)
    years = Column(Text, nullable=False)
    group = relationship("TrackingGroup", back_populates="items")
