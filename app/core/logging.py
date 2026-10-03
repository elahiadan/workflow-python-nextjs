"""Structured-ish logging helpers. Never log secrets."""
import logging
import sys

_configured = False


def setup_logging(level: str = "INFO") -> None:
    global _configured
    if _configured:
        return
    handler = logging.StreamHandler(sys.stdout)

    class _Fmt(logging.Formatter):
        def format(self, record: logging.LogRecord) -> str:
            for k in ("workflow_id", "execution_id", "step_id"):
                if not hasattr(record, k):
                    setattr(record, k, "-")
            return super().format(record)

    handler.setFormatter(_Fmt(
        "%(asctime)s %(levelname)s %(name)s workflow_id=%(workflow_id)s "
        "execution_id=%(execution_id)s step_id=%(step_id)s %(message)s"
    ))
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)
    _configured = True


class _Adapter(logging.LoggerAdapter):
    def process(self, msg, kwargs):
        extra = {"workflow_id": "-", "execution_id": "-", "step_id": "-"}
        extra.update(self.extra)
        if "extra" in kwargs:
            kwargs["extra"] = {**extra, **kwargs["extra"]}
        else:
            kwargs["extra"] = extra
        return msg, kwargs


def get_logger(name: str, **ctx) -> logging.LoggerAdapter:
    return _Adapter(logging.getLogger(name), {k: str(v) for k, v in ctx.items()})
