"""Safe condition / rule engine (no eval)."""
from typing import Any

SUPPORTED_OPERATORS = {
    "==", "!=", ">", ">=", "<", "<=",
    "contains", "not_contains", "starts_with", "ends_with",
    "in", "not_in", "is_empty", "is_not_empty",
}


def resolve_field(payload: Any, path: str) -> Any:
    """Resolve dotted path like 'order.customer.email' from dicts/lists."""
    if not path:
        return None
    current: Any = payload
    for part in path.split("."):
        if isinstance(current, dict):
            current = current.get(part)
        elif isinstance(current, (list, tuple)):
            try:
                current = current[int(part)]
            except (ValueError, IndexError):
                return None
        else:
            return None
        if current is None:
            return None
    return current


def _is_empty(v: Any) -> bool:
    return v is None or v == "" or v == [] or v == {}


def evaluate_condition(condition: dict, payload: dict) -> bool:
    """Evaluate {'field','operator','value?'} against payload. Raises ValueError on bad input."""
    field = condition.get("field", "")
    operator = condition.get("operator", "")
    value = condition.get("value")
    if operator not in SUPPORTED_OPERATORS:
        raise ValueError(f"Unsupported operator: {operator}")
    actual = resolve_field(payload, field)

    if operator == "==":
        return actual == value
    if operator == "!=":
        return actual != value
    if operator in (">", ">=", "<", "<="):
        try:
            if actual is None:
                return False
            if operator == ">":
                return actual > value  # type: ignore[operator]
            if operator == ">=":
                return actual >= value  # type: ignore[operator]
            if operator == "<":
                return actual < value  # type: ignore[operator]
            return actual <= value  # type: ignore[operator]
        except TypeError:
            # numeric-string coercion attempt
            try:
                a, b = float(actual), float(value)  # type: ignore[arg-type]
                return {" > ": a > b, ">": a > b, ">=": a >= b, "<": a < b, "<=": a <= b}[operator]
            except (ValueError, TypeError):
                return False
    if operator == "contains":
        if isinstance(actual, (list, tuple, set)):
            return value in actual
        return value in str(actual) if actual is not None else False
    if operator == "not_contains":
        if isinstance(actual, (list, tuple, set)):
            return value not in actual
        return value not in str(actual) if actual is not None else True
    if operator == "starts_with":
        return str(actual).startswith(str(value)) if actual is not None else False
    if operator == "ends_with":
        return str(actual).endswith(str(value)) if actual is not None else False
    if operator == "in":
        return actual in (value if isinstance(value, (list, tuple, set)) else [value])
    if operator == "not_in":
        return actual not in (value if isinstance(value, (list, tuple, set)) else [value])
    if operator == "is_empty":
        return _is_empty(actual)
    if operator == "is_not_empty":
        return not _is_empty(actual)
    return False
