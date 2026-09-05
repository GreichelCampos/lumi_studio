import json
from pathlib import Path

from lumi_language.interpreter import Interpreter


FIXTURES = Path(__file__).parent / "fixtures"


def load_fixture(name: str) -> dict:
    with (FIXTURES / name).open(encoding="utf-8") as fixture_file:
        return json.load(fixture_file)


def literal(value, literal_kind="entero", **location):
    return {
        "node": "LiteralNode",
        "value": value,
        "literal_kind": literal_kind,
        **location,
    }


def test_executes_variables_assignment_and_output():
    result = Interpreter().execute(load_fixture("basic_execution.json"))
    assert result.succeeded
    assert result.output == ["5"]


def test_executes_conditions_and_loops():
    result = Interpreter().execute(load_fixture("control_flow.json"))
    assert result.succeeded
    assert result.output == ["0", "1", "listo", "repetir", "repetir"]


def test_executes_for_loop():
    program = {
        "node": "ProgramNode",
        "statements": [
            {
                "node": "ForNode",
                "initializer": {
                    "node": "VariableDeclarationNode",
                    "name": "i",
                    "value": literal(0),
                },
                "condition": {
                    "node": "BinaryExpressionNode",
                    "left": {"node": "IdentifierNode", "name": "i"},
                    "operator": "<",
                    "right": literal(3),
                },
                "update": {
                    "node": "AssignmentNode",
                    "name": "i",
                    "value": {
                        "node": "BinaryExpressionNode",
                        "left": {"node": "IdentifierNode", "name": "i"},
                        "operator": "+",
                        "right": literal(1),
                    },
                },
                "body": [
                    {
                        "node": "ShowNode",
                        "expression": {"node": "IdentifierNode", "name": "i"},
                    }
                ],
            }
        ],
    }
    result = Interpreter().execute(program)
    assert result.succeeded
    assert result.output == ["0", "1", "2"]


def test_evaluates_logical_and_unary_expressions():
    expression = {
        "node": "UnaryExpressionNode",
        "operator": "no",
        "operand": {
            "node": "BinaryExpressionNode",
            "left": literal(True, "booleano"),
            "operator": "y",
            "right": literal(False, "booleano"),
        },
    }
    program = {
        "node": "ProgramNode",
        "statements": [{"node": "ShowNode", "expression": expression}],
    }
    result = Interpreter().execute(program)
    assert result.succeeded
    assert result.output == ["verdadero"]


def test_read_node_returns_input_value():
    program = {"node": "ProgramNode", "statements": [
        {
            "node": "VariableDeclarationNode",
            "name": "nombre",
            "value": {
                "node": "ReadNode",
                "message": literal("Nombre:", "texto"),
            },
        },
        {
            "node": "ShowNode",
            "expression": {"node": "IdentifierNode", "name": "nombre"},
        },
    ]}
    result = Interpreter(input_provider=lambda _: "Lumi").execute(program)
    assert result.succeeded
    assert result.output == ["Lumi"]


def test_division_by_zero_reports_runtime_diagnostic():
    location = {"file": "principal.lumi", "line": 8, "column": 12}
    expression = {
        "node": "BinaryExpressionNode",
        "left": literal(4),
        "operator": "/",
        "right": literal(0),
        **location,
    }
    program = {
        "node": "ProgramNode",
        "statements": [{"node": "ShowNode", "expression": expression}],
    }
    result = Interpreter().execute(program)
    assert not result.succeeded
    assert result.diagnostics[0].code == "RUN_DIVISION_BY_ZERO"
    diagnostic = result.diagnostics[0]
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "principal.lumi",
        8,
        12,
    )


def test_loop_limit_reports_runtime_diagnostic():
    loop = {
        "node": "WhileNode",
        "condition": literal(True, "booleano"),
        "body": [],
        "file": "principal.lumi",
        "line": 3,
        "column": 1,
    }
    program = {"node": "ProgramNode", "statements": [loop]}
    result = Interpreter(max_loop_iterations=3).execute(program)
    assert not result.succeeded
    assert result.diagnostics[0].code == "RUN_LOOP_LIMIT_EXCEEDED"


def test_block_local_variable_is_not_visible_after_block():
    program = {"node": "ProgramNode", "statements": [
        {
            "node": "IfNode",
            "condition": literal(True, "booleano"),
            "then_body": [
                {
                    "node": "VariableDeclarationNode",
                    "name": "local",
                    "value": literal(1),
                }
            ],
            "else_body": [],
        },
        {
            "node": "ShowNode",
            "expression": {
                "node": "IdentifierNode",
                "name": "local",
                "file": "principal.lumi",
                "line": 5,
                "column": 9,
            },
        },
    ]}
    result = Interpreter().execute(program)
    assert not result.succeeded
    assert result.diagnostics[0].code == "RUN_UNDEFINED_VARIABLE"
