"""Auth routes: register / login / refresh / me / logout."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, rate_limit_auth
from app.core.exceptions import BadRequestError, UnauthorizedError
from app.core.security import (
    create_access_token, create_refresh_token, decode_token, hash_password, verify_password,
)
from app.db import models
from app.db.database import get_db
from app.schemas import LoginRequest, RefreshRequest, RegisterRequest, TokenPair, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=dict, status_code=201,
             dependencies=[Depends(rate_limit_auth)])
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(models.User).filter_by(email=body.email.lower()).first():
        raise BadRequestError("Email already registered", "EMAIL_TAKEN")
    user = models.User(email=body.email.lower(), hashed_password=hash_password(body.password),
                       full_name=body.full_name)
    db.add(user)
    db.commit()
    db.refresh(user)
    access, _, _ = create_access_token(user.id)
    refresh, _, _ = create_refresh_token(user.id)
    return {"user": UserOut.model_validate(user).model_dump(mode="json"),
            "tokens": TokenPair(access_token=access, refresh_token=refresh).model_dump()}


@router.post("/login", response_model=dict, dependencies=[Depends(rate_limit_auth)])
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter_by(email=body.email.lower()).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise UnauthorizedError("Invalid email or password", )
    if not user.is_active:
        raise UnauthorizedError("User is inactive")
    access, _, _ = create_access_token(user.id)
    refresh, refresh_jti, refresh_exp = create_refresh_token(user.id)
    return {"user": UserOut.model_validate(user).model_dump(mode="json"),
            "tokens": TokenPair(access_token=access, refresh_token=refresh).model_dump(),
            "_refresh_jti": refresh_jti}


@router.post("/refresh", response_model=dict)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    try:
        payload = decode_token(body.refresh_token)
    except Exception as e:
        raise UnauthorizedError("Invalid or expired refresh token") from e
    if payload.get("type") != "refresh":
        raise UnauthorizedError("Invalid token type")
    if db.query(models.RevokedToken).filter_by(jti=payload.get("jti")).first():
        raise UnauthorizedError("Refresh token has been revoked")
    user = db.query(models.User).filter_by(id=payload.get("sub")).first()
    if not user or not user.is_active:
        raise UnauthorizedError("User not found or inactive")
    access, _, _ = create_access_token(user.id)
    return {"access_token": access, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def me(user: models.User = Depends(get_current_user)):
    return user


@router.post("/logout")
def logout(body: RefreshRequest, request: Request, db: Session = Depends(get_db),
           user: models.User = Depends(get_current_user)):
    # Revoke the refresh token; also revoke the current access token (logout-all for this session).
    try:
        payload = decode_token(body.refresh_token)
        jti, exp = payload.get("jti"), payload.get("exp")
        if jti:
            db.add(models.RevokedToken(
                jti=jti, user_id=user.id,
                expires_at=datetime.fromtimestamp(exp, tz=timezone.utc).replace(tzinfo=None)))
    except Exception:
        pass
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        try:
            ap = decode_token(auth.split(" ", 1)[1])
            db.add(models.RevokedToken(
                jti=ap.get("jti"), user_id=user.id,
                expires_at=datetime.fromtimestamp(ap.get("exp"), tz=timezone.utc).replace(tzinfo=None)))
        except Exception:
            pass
    db.commit()
    return {"success": True, "message": "Logged out"}
