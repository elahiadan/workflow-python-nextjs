"""Integration credentials CRUD (secrets encrypted, never returned)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.crypto import decrypt_dict, encrypt_dict, preview_config
from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.db import models
from app.db.database import get_db
from app.schemas import IntegrationCreate, IntegrationOut, IntegrationUpdate

router = APIRouter(prefix="/integrations", tags=["integrations"])
TYPES = {"slack", "email", "http"}


@router.post("", response_model=IntegrationOut, status_code=201)
def create_integration(body: IntegrationCreate, db: Session = Depends(get_db),
                       user: models.User = Depends(get_current_user)):
    if body.type not in TYPES:
        raise BadRequestError("Invalid integration type", "INVALID_INTEGRATION")
    row = models.Integration(user_id=user.id, type=body.type, name=body.name,
                             config_encrypted=encrypt_dict(body.config),
                             config_preview=preview_config(body.config))
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("", response_model=list[IntegrationOut])
def list_integrations(db: Session = Depends(get_db),
                      user: models.User = Depends(get_current_user)):
    return db.query(models.Integration).filter_by(user_id=user.id).all()


@router.get("/{integration_id}", response_model=IntegrationOut)
def get_integration(integration_id: str, db: Session = Depends(get_db),
                    user: models.User = Depends(get_current_user)):
    row = db.query(models.Integration).filter_by(id=integration_id).first()
    if not row:
        raise NotFoundError("Integration not found", "INTEGRATION_NOT_FOUND")
    if row.user_id != user.id:
        raise ForbiddenError("Not your integration")
    return row


@router.put("/{integration_id}", response_model=IntegrationOut)
def update_integration(integration_id: str, body: IntegrationUpdate,
                       db: Session = Depends(get_db),
                       user: models.User = Depends(get_current_user)):
    row = db.query(models.Integration).filter_by(id=integration_id).first()
    if not row:
        raise NotFoundError("Integration not found", "INTEGRATION_NOT_FOUND")
    if row.user_id != user.id:
        raise ForbiddenError("Not your integration")
    if body.name is not None:
        row.name = body.name
    if body.config is not None:
        merged = {**decrypt_dict(row.config_encrypted), **body.config}
        row.config_encrypted = encrypt_dict(merged)
        row.config_preview = preview_config(merged)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{integration_id}")
def delete_integration(integration_id: str, db: Session = Depends(get_db),
                       user: models.User = Depends(get_current_user)):
    row = db.query(models.Integration).filter_by(id=integration_id).first()
    if not row:
        raise NotFoundError("Integration not found", "INTEGRATION_NOT_FOUND")
    if row.user_id != user.id:
        raise ForbiddenError("Not your integration")
    db.delete(row)
    db.commit()
    return {"success": True, "message": "Integration deleted"}
