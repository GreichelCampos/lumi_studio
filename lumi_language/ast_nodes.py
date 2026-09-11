"""AST node definitions for the Lumi language."""

from dataclasses import dataclass
from typing import Any


@dataclass
class LiteralNode:
    value: Any
    literal_kind: str
    file: str
    line: int
    column: int


@dataclass
class IdentifierNode:
    name: str
    file: str
    line: int
    column: int


@dataclass
class BinaryExpressionNode:
    left: Any
    operator: str
    right: Any
    file: str
    line: int
    column: int


@dataclass
class UnaryExpressionNode:
    operator: str
    operand: Any
    file: str
    line: int
    column: int


@dataclass
class VariableDeclarationNode:
    type: str
    name: str
    value: Any
    file: str
    line: int
    column: int


@dataclass
class AssignmentNode:
    name: str
    value: Any
    file: str
    line: int
    column: int


@dataclass
class ReadNode:
    message: Any
    file: str
    line: int
    column: int


@dataclass
class ShowNode:
    expression: Any
    file: str
    line: int
    column: int


@dataclass
class ProgramNode:
    statements: list[Any]
    file: str
    line: int
    column: int


@dataclass
class MainNode:
    body: list[Any]
    file: str
    line: int
    column: int


@dataclass
class ListNode:
    elements: list[Any]
    file: str
    line: int
    column: int


@dataclass
class VectorNode:
    x: Any
    y: Any
    z: Any
    file: str
    line: int
    column: int


@dataclass
class IfNode:
    condition: Any
    then_body: list[Any]
    else_body: list[Any]
    file: str
    line: int
    column: int


@dataclass
class SwitchNode:
    expression: Any
    cases: list[Any]
    default_body: list[Any]
    file: str
    line: int
    column: int


@dataclass
class CaseNode:
    value: Any
    body: list[Any]
    file: str
    line: int
    column: int


@dataclass
class ForNode:
    initializer: Any
    condition: Any
    update: Any
    body: list[Any]
    file: str
    line: int
    column: int


@dataclass
class WhileNode:
    condition: Any
    body: list[Any]
    file: str
    line: int
    column: int


@dataclass
class RepeatNode:
    count: Any
    body: list[Any]
    file: str
    line: int
    column: int


@dataclass
class FunctionDeclarationNode:
    name: str
    parameters: list[Any]
    return_type: str
    body: list[Any]
    file: str
    line: int
    column: int


@dataclass
class ParameterNode:
    name: str
    data_type: str
    file: str
    line: int
    column: int


@dataclass
class ReturnNode:
    value: Any
    file: str
    line: int
    column: int
