"""Condition engine: every supported operator."""
import pytest

from app.services.conditions.evaluator import evaluate_condition, resolve_field

PAYLOAD = {"order": {"amount": 6000, "status": "paid",
                     "customer": {"email": "a@shop.com", "tags": ["vip", "eu"]}},
           "note": "hello world", "empty": "", "missing": None}


@pytest.mark.parametrize("op,field,value,expected", [
    ("==", "order.status", "paid", True),
    ("==", "order.status", "refunded", False),
    ("!=", "order.status", "refunded", True),
    (">", "order.amount", 5000, True),
    (">", "order.amount", 7000, False),
    (">=", "order.amount", 6000, True),
    ("<", "order.amount", 7000, True),
    ("<=", "order.amount", 6000, True),
    ("contains", "note", "world", True),
    ("contains", "order.customer.tags", "vip", True),
    ("not_contains", "note", "zzz", True),
    ("starts_with", "note", "hello", True),
    ("ends_with", "note", "world", True),
    ("in", "order.status", ["paid", "new"], True),
    ("not_in", "order.status", ["refunded"], True),
    ("is_empty", "empty", None, True),
    ("is_empty", "note", None, False),
    ("is_not_empty", "note", None, True),
    ("==", "order.customer.email", "a@shop.com", True),
    ("==", "order.nope.deeper", "x", False),
])
def test_operators(op, field, value, expected):
    assert evaluate_condition({"field": field, "operator": op, "value": value}, PAYLOAD) is expected


def test_unsupported_operator():
    with pytest.raises(ValueError):
        evaluate_condition({"field": "x", "operator": "EVAL"}, {})


def test_resolve_nested():
    assert resolve_field(PAYLOAD, "order.customer.email") == "a@shop.com"
    assert resolve_field(PAYLOAD, "order.missing.deep") is None
