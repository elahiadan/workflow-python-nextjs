"""Misc: users + ad-hoc action runner (HTTP with SSRF guard)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.ssrf import assert_safe_url
from app.db import models
from app.db.database import get_db
from app.integrations.actions import ActionRegistry
from app.schemas import HttpActionRequest, UserOut

router = APIRouter(tags=["misc"])


@router.get("/users/me", response_model=UserOut)
def users_me(user: models.User = Depends(get_current_user)):
    return user


@router.post("/actions/http")
def run_http_action(body: HttpActionRequest, db: Session = Depends(get_db),
                    user: models.User = Depends(get_current_user)):
    assert_safe_url(body.url)
    action = ActionRegistry.get("http_request")
    out = action.execute({"method": body.method, "url": body.url, "headers": body.headers,
                          "params": body.params, "body": body.body, "timeout": body.timeout},
                         {"trigger_payload": {}, "user_id": user.id, "eager_test": True})
    return {"success": True, "data": out}


@router.get("/actions")
def list_actions(user: models.User = Depends(get_current_user)):
    return {"actions": ActionRegistry.names()}
