"""FastAPI application factory."""
from fastapi import FastAPI

from app.api.routes import auth, executions, integrations, misc, webhooks, workflows
from app.core.exceptions import register_exception_handlers
from app.core.logging import setup_logging


def create_app() -> FastAPI:
    setup_logging()
    app = FastAPI(title="Workflow Automation Platform",
                  description="Zapier-like workflow automation: triggers, conditions, actions, "
                              "async execution, retries, idempotency.",
                  version="1.0.0")
    register_exception_handlers(app)

    @app.get("/health", tags=["health"])
    def health():
        return {"success": True, "status": "ok"}

    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(workflows.router, prefix="/api/v1")
    app.include_router(webhooks.router, prefix="/api/v1")
    app.include_router(webhooks.public_router, prefix="/api/v1")
    app.include_router(executions.router, prefix="/api/v1")
    app.include_router(integrations.router, prefix="/api/v1")
    app.include_router(misc.router, prefix="/api/v1")
    return app


app = create_app()
