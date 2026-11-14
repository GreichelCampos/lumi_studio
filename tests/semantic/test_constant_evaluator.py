import math

import pytest

from lumi_language.constant_evaluator import (
    Invalid,
    InvalidReason,
    Known,
    Unknown,
    evaluate_numeric_constant,
)


def literal(value, literal_kind="decimal"):
    return {"node": "LiteralNode", "value": value, "literal_kind": literal_kind}


def binary(left, operator, right):
    return {
        "node": "BinaryExpressionNode",
        "left": left,
        "operator": operator,
        "right": right,
    }


@pytest.mark.parametrize(
    "expression, expected",
    [
        (literal(4, "entero"), 4),
        (binary(literal(2), "+", literal(3)), 5),
        (binary(literal(7), "-", literal(2)), 5),
        (binary(literal(2), "*", literal(3.5)), 7.0),
        (binary(literal(5), "/", literal(2)), 2.5),
        ({"node": "UnaryExpressionNode", "operator": "-", "operand": literal(3)}, -3),
    ],
)
def test_evaluates_numeric_constant_subset(expression, expected):
    assert evaluate_numeric_constant(expression) == Known(expected)


@pytest.mark.parametrize(
    "expression",
    [
        {"node": "IdentifierNode", "name": "variable"},
        {"node": "FunctionCallNode", "name": "calcular", "arguments": []},
        {"node": "ReadNode", "message": literal("dato", "texto")},
        binary(literal(1), ">", literal(0)),
        literal(True, "booleano"),
        literal("5", "texto"),
    ],
)
def test_dynamic_or_non_numeric_expressions_are_unknown(expression):
    assert isinstance(evaluate_numeric_constant(expression), Unknown)


def test_division_by_zero_is_controlled_invalid_result():
    result = evaluate_numeric_constant(binary(literal(1), "/", literal(0)))

    assert result == Invalid(InvalidReason.DIVISION_BY_ZERO)


def test_float_overflow_result_is_known_for_spatial_finiteness_rule():
    result = evaluate_numeric_constant(
        binary(literal(1e308), "*", literal(1e308))
    )

    assert isinstance(result, Known)
    assert math.isinf(result.value)
