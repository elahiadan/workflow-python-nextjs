"""Password hashing + JWT helpers."""
import uuid
from datetime import datetime, timedelta, timezone

import jwt
import bcrypt

from app.core.config import get_settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_token(subject: str, expires: timedelta, token_type: str) -> tuple[str, str, datetime]:
    settings = get_settings()
    jti = uuid.uuid4().hex
    exp = _now() + expires
    payload = {"sub": subject, "exp": exp, "iat": _now(), "jti": jti, "type": token_type}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256"), jti, exp


def create_access_token(subject: str) -> tuple[str, str, datetime]:
    settings = get_settings()
    return create_token(subject, timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES), "access")


def create_refresh_token(subject: str) -> tuple[str, str, datetime]:
    settings = get_settings()
    return create_token(subject, timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS), "refresh")


def decode_token(token: str) -> dict:
    settings = get_settings()
    return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
