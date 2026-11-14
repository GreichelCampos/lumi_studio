"""Side-effect-free evaluation of the constant numeric Lumi subset."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any


@dataclass(frozen=True, slots=True)
class Known:
    """A numeric expression whose value is statically known."""

    value: int | float


@dataclass(frozen=True, slots=True)
class Unknown:
    """An expression deliberately left for runtime evaluation."""


class InvalidReason(str, Enum):
    """Controlled reasons why a constant operation could not be evaluated."""

    DIVISION_BY_ZERO = "division_by_zero"
    ARITHMETIC_ERROR = "arithmetic_error"


@dataclass(frozen=True, slots=True)
class Invalid:
    """A constant operation that cannot produce a value safely."""

    reason: InvalidReason


ConstantResult = Known | Unknown | Invalid
UNKNOWN = Unknown()


def evaluate_numeric_constant(expression: dict[str, Any]) -> ConstantResult:
    """Evaluate only numeric literals and arithmetic, never Lumi state."""

    node_type = expression.get("node")
    if node_type == "LiteralNode":
        value = expression.get("value")
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return UNKNOWN
        return Known(value)

    if node_type == "UnaryExpressionNode":
        if expression.get("operator") != "-":
            return UNKNOWN
        operand = evaluate_numeric_constant(expression.get("operand", {}))
        if not isinstance(operand, Known):
            return operand
        try:
            return Known(-operand.value)
        except (ArithmeticError, OverflowError, TypeError, ValueError):
            return Invalid(InvalidReason.ARITHMETIC_ERROR)

    if node_type != "BinaryExpressionNode":
        return UNKNOWN

    operator = expression.get("operator")
    if operator not in {"+", "-", "*", "/"}:
        return UNKNOWN
    left = evaluate_numeric_constant(expression.get("left", {}))
    right = evaluate_numeric_constant(expression.get("right", {}))
    if isinstance(left, Invalid):
        return left
    if isinstance(right, Invalid):
        return right
    if not isinstance(left, Known) or not isinstance(right, Known):
        return UNKNOWN

    try:
        if operator == "+":
            value = left.value + right.value
        elif operator == "-":
            value = left.value - right.value
        elif operator == "*":
            value = left.value * right.value
        else:
            if right.value == 0:
                return Invalid(InvalidReason.DIVISION_BY_ZERO)
            value = left.value / right.value
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return Invalid(InvalidReason.ARITHMETIC_ERROR)
        return Known(value)
    except (ArithmeticError, OverflowError, TypeError, ValueError):
        return Invalid(InvalidReason.ARITHMETIC_ERROR)
