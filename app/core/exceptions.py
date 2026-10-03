"""Centralized exceptions + consistent error envelope."""
from typing import Any, Optional

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppException(Exception):
    def __init__(self, message: str, code: str = "APP_ERROR", status_code: int = 500,
                 details: Optional[Any] = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details


class NotFoundError(AppException):
    def __init__(self, message: str = "Resource not found", code: str = "NOT_FOUND"):
        super().__init__(message, code, 404)


class ConflictError(AppException):
    def __init__(self, message: str = "Conflict", code: str = "CONFLICT"):
        super().__init__(message, code, 409)


class UnauthorizedError(AppException):
    def __init__(self, message: str = "Not authenticated", code: str = "UNAUTHORIZED"):
        super().__init__(message, code, 401)


class ForbiddenError(AppException):
    def __init__(self, message: str = "Forbidden", code: str = "FORBIDDEN"):
        super().__init__(message, code, 403)


class BadRequestError(AppException):
    def __init__(self, message: str = "Bad request", code: str = "BAD_REQUEST",
                 details: Optional[Any] = None):
        super().__init__(message, code, 400, details)


class RateLimitError(AppException):
    def __init__(self, message: str = "Rate limit exceeded"):
        super().__init__(message, "RATE_LIMITED", 429)


def error_body(message: str, code: str, details: Optional[Any] = None) -> dict:
    body: dict = {"success": False, "message": message, "error": {"code": code}}
    if details is not None:
        body["error"]["details"] = details
    return body


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def _app_exc(_: Request, exc: AppException):
        return JSONResponse(error_body(exc.message, exc.code, exc.details),
                            status_code=exc.status_code)

    @app.exception_handler(StarletteHTTPException)
    async def _http_exc(_: Request, exc: StarletteHTTPException):
        code = "NOT_FOUND" if exc.status_code == 404 else "HTTP_ERROR"
        if exc.status_code == 401:
            code = "UNAUTHORIZED"
        elif exc.status_code == 403:
            code = "FORBIDDEN"
        elif exc.status_code == 429:
            code = "RATE_LIMITED"
        return JSONResponse(error_body(str(exc.detail), code), status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def _validation_exc(_: Request, exc: RequestValidationError):
        return JSONResponse(
            error_body("Validation error", "VALIDATION_ERROR", exc.errors()),
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, exc: Exception):  # never leak internals
        import logging
        logging.getLogger(__name__).exception("Unhandled exception: %s", exc)
        return JSONResponse(error_body("Internal server error", "INTERNAL_ERROR"),
                            status_code=500)
