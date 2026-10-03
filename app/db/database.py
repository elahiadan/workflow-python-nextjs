"""SQLAlchemy engine/session + Base."""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def _connect_args(url: str) -> dict:
    if url.startswith("sqlite"):
        return {"check_same_thread": False}
    return {}


def build_engine(url: str | None = None):
    settings = get_settings()
    db_url = url or settings.DATABASE_URL
    kwargs: dict = {"pool_pre_ping": True, "connect_args": _connect_args(db_url)}
    if db_url.startswith("sqlite"):
        kwargs.pop("pool_pre_ping", None)
    return create_engine(db_url, **kwargs)


engine = build_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
