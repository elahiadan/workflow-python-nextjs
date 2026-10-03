"""Shared API dependencies: DB, auth, rate limits."""
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.exceptions import UnauthorizedError
from app.core.rate_limit import check_rate_limit
from app.core.security import decode_token
from app.db import models
from app.db.database import get_db

_bearer = HTTPBearer(auto_error=False)


def get_request_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit_auth(request: Request) -> None:
    check_rate_limit(f"auth:{get_request_ip(request)}", limit=30)


def rate_limit_webhook(request: Request) -> None:
    check_rate_limit(f"webhook:{get_request_ip(request)}", limit=120)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> models.User:
    if creds is None or not creds.credentials:
        raise UnauthorizedError("Missing access token")
    try:
        payload = decode_token(creds.credentials)
    except Exception as e:
        raise UnauthorizedError("Invalid or expired token") from e
    if payload.get("type") != "access":
        raise UnauthorizedError("Invalid token type")
    # access-token revocation (logout-all support)
    jti = payload.get("jti", "")
    if db.query(models.RevokedToken).filter_by(jti=jti).first():
        raise UnauthorizedError("Token has been revoked")
    user = db.query(models.User).filter_by(id=payload.get("sub")).first()
    if not user or not user.is_active:
        raise UnauthorizedError("User not found or inactive")
    return user


def owned_workflow(workflow_id: str, user: models.User, db: Session) -> models.Workflow:
    from app.core.exceptions import ForbiddenError, NotFoundError
    wf = db.query(models.Workflow).filter_by(id=workflow_id).first()
    if not wf:
        raise NotFoundError("Workflow not found", "WORKFLOW_NOT_FOUND")
    if wf.user_id != user.id:
        raise ForbiddenError("Not your workflow")
    return wf
