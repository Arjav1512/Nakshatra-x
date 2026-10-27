from datetime import datetime
from sqlalchemy import String, Float, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base

class MineSite(Base):
    __tablename__ = "mine_sites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mine_code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    state: Mapped[str] = mapped_column(String(80))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    zone: Mapped[str] = mapped_column(String(80), default="Central India")
    target_tonnes: Mapped[float] = mapped_column(Float, default=12000.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class ObservationLog(Base):
    __tablename__ = "observation_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mine_id: Mapped[int] = mapped_column(Integer, index=True)
    source: Mapped[str] = mapped_column(String(60), default="NASA POWER")
    ndvi: Mapped[float] = mapped_column(Float, default=0.68)
    soil_moisture: Mapped[float] = mapped_column(Float, default=40.0)
    rainfall_14d_mm: Mapped[float] = mapped_column(Float, default=0.0)
    avg_temp_c: Mapped[float] = mapped_column(Float, default=32.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
