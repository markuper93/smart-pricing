from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from datetime import datetime, timezone
from ..database import Base

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    username = Column(String(100), nullable=False)  # Denormalized for fast queries
    action = Column(String(50), nullable=False, index=True)  # login, logout, page_view, compare, export, upload, etc.
    details = Column(Text, nullable=True)  # JSON: {page, params, ...}
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
