from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean, UniqueConstraint

# Upload presence is separate from row count: an empty valid workbook is available.
from datetime import datetime, timezone
from ..database import Base

class PriceList(Base):
    __tablename__ = "price_lists"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    month = Column(String(20), nullable=False)
    year = Column(Integer, nullable=False)
    label = Column(String(100), nullable=False)
    uploaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    supplements_uploaded = Column(Boolean, nullable=False, default=False, server_default="false")

class Supplement(Base):
    __tablename__ = "supplements"
    __table_args__ = (UniqueConstraint("price_list_id", "car_code", "key", "year_from", "year_to"),)
    id = Column(Integer, primary_key=True)
    price_list_id = Column(Integer, ForeignKey("price_lists.id"), nullable=False, index=True)
    car_code = Column(String(50), nullable=False, index=True)
    key = Column(String(64), nullable=False)
    description = Column(Text, nullable=False)
    percent = Column(Float, nullable=True)
    year_from = Column(Integer, nullable=False)
    year_to = Column(Integer, nullable=False)
    kind = Column(String(20), nullable=False)
    selectable = Column(Boolean, nullable=False)


class PriceEntry(Base):
    __tablename__ = "price_entries"
    id = Column(Integer, primary_key=True, index=True)
    price_list_id = Column(Integer, ForeignKey("price_lists.id"), nullable=False)
    car_code = Column(String(50), nullable=False, index=True)
    manufacturer = Column(String(100), nullable=True)
    model_name = Column(String(200), nullable=True)
    year = Column(Integer, nullable=True)
    price = Column(Float, nullable=True)
    road_tax = Column(Float, nullable=True)
    raw_data = Column(Text, nullable=True)
