"""Execution history APIs."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.api.dependencies import get_current_user, owned_workflow
from app.core.exceptions import ForbiddenError, NotFoundError
from app.db import models
from app.db.database import get_db
from app.schemas import ExecutionListOut, ExecutionOut

router = APIRouter(tags=["executions"])


def _user_execution(execution_id: str, user: models.User, db: Session) -> models.WorkflowExecution:
    exc = (db.query(models.WorkflowExecution)
           .options(joinedload(models.WorkflowExecution.step_executions),
                     joinedload(models.WorkflowExecution.logs))
           .filter_by(id=execution_id).first())
    if not exc:
        raise NotFoundError("Execution not found", "EXECUTION_NOT_FOUND")
    if exc.user_id != user.id:
        raise ForbiddenError("Not your execution")
    exc.step_executions.sort(key=lambda s: s.step_order)
    return exc


@router.get("/executions", response_model=list[ExecutionListOut])
def list_executions(workflow_id: str | None = Query(default=None),
                    status: str | None = Query(default=None),
                    limit: int = Query(default=50, ge=1, le=200),
                    offset: int = Query(default=0, ge=0),
                    db: Session = Depends(get_db),
                    user: models.User = Depends(get_current_user)):
    q = db.query(models.WorkflowExecution).filter_by(user_id=user.id).order_by(
        models.WorkflowExecution.created_at.desc())
    if workflow_id:
        q = q.filter_by(workflow_id=workflow_id)
    if status:
        q = q.filter_by(status=status)
    return q.offset(offset).limit(limit).all()


@router.get("/executions/{execution_id}", response_model=ExecutionOut)
def get_execution(execution_id: str, db: Session = Depends(get_db),
                  user: models.User = Depends(get_current_user)):
    return _user_execution(execution_id, user, db)


@router.get("/workflows/{workflow_id}/executions", response_model=list[ExecutionListOut])
def list_workflow_executions(workflow_id: str, db: Session = Depends(get_db),
                             user: models.User = Depends(get_current_user),
                             limit: int = Query(default=50, ge=1, le=200),
                             offset: int = Query(default=0, ge=0)):
    owned_workflow(workflow_id, user, db)
    return (db.query(models.WorkflowExecution).filter_by(workflow_id=workflow_id)
            .order_by(models.WorkflowExecution.created_at.desc())
            .offset(offset).limit(limit).all())
