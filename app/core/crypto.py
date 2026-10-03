"""Symmetric encryption for stored integration credentials (Fernet)."""
import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings

logger = logging.getLogger(__name__)
_REDACTED = "***REDACTED***"
SECRET_KEYS = {"password", "secret", "token", "api_key", "apikey", "webhook_url", "smtp_password"}


def _fernet() -> Fernet:
    settings = get_settings()
    raw = settings.CREDENTIALS_ENCRYPTION_KEY or settings.SECRET_KEY
    digest = hashlib.sha256(raw.encode()).digest()  # 32 bytes -> urlsafe b64
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_dict(data: dict) -> str:
    import json
    return _fernet().encrypt(json.dumps(data).encode()).decode()


def decrypt_dict(token: str) -> dict:
    import json
    try:
        return json.loads(_fernet().decrypt(token.encode()).decode())
    except InvalidToken as e:
        raise ValueError("Unable to decrypt integration credentials") from e


def preview_config(data: dict) -> dict:
    """Return a non-secret preview safe for API responses/logs."""
    preview: dict = {}
    for k, v in (data or {}).items():
        if k.lower() in SECRET_KEYS:
            preview[k] = _REDACTED
        elif isinstance(v, str) and len(v) > 64:
            preview[k] = v[:8] + "..." + _REDACTED
        else:
            preview[k] = v
    return preview
