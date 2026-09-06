"""Runtime execution of validated Lumi AST fixtures."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from .diagnostics import Diagnostic, DiagnosticCategory


@dataclass(slots=True)
class InterpreterResult:
    """Console output and diagnostics produced by one execution."""

    output: list[str] = field(default_factory=list)
    diagnostics: list[Diagnostic] = field(default_factory=list)

    @property
    def succeeded(self) -> bool:
        return not self.diagnostics


class RuntimeEnvironment:
    """Runtime values stored in a lexical scope."""

    def __init__(self, parent: RuntimeEnvironment | None = None) -> None:
        self.parent = parent
        self._values: dict[str, Any] = {}

    def define(self, name: str, value: Any) -> None:
        self._values[name] = value

    def get(self, name: str) -> Any:
        if name in self._values:
            return self._values[name]
        if self.parent is not None:
            return self.parent.get(name)
        raise KeyError(name)

    def assign(self, name: str, value: Any) -> None:
        if name in self._values:
            self._values[name] = value
            return
        if self.parent is not None:
            self.parent.assign(name, value)
            return
        raise KeyError(name)


class InterpreterRuntimeError(Exception):
    """Internal control flow for a runtime failure with source context."""

    def __init__(self, diagnostic: Diagnostic) -> None:
        super().__init__(diagnostic.description)
        self.diagnostic = diagnostic


class Interpreter:
    """Execute validated dictionary-based AST fixtures independently of parser."""

    def __init__(
        self,
        *,
        max_loop_iterations: int = 1_000,
        input_provider: Callable[[str], str] = input,
    ) -> None:
        if max_loop_iterations <= 0:
            raise ValueError("max_loop_iterations must be positive")
        self.max_loop_iterations = max_loop_iterations
        self.input_provider = input_provider
        self.result = InterpreterResult()
        self.environment = RuntimeEnvironment()

    def execute(self, program: dict[str, Any]) -> InterpreterResult:
        """Execute a ProgramNode fixture and return output plus diagnostics."""

        self.result = InterpreterResult()
        self.environment = RuntimeEnvironment()
        try:
            self._execute_node(program)
        except InterpreterRuntimeError as error:
            self.result.diagnostics.append(error.diagnostic)
        return self.result

    def _execute_node(self, node: dict[str, Any]) -> Any:
        node_type = node["node"]
        if node_type == "ProgramNode":
            return self._execute_statements(node.get("statements", []))
        if node_type == "MainNode":
            return self._execute_block(node.get("body", []))
        if node_type == "VariableDeclarationNode":
            self.environment.define(node["name"], self._evaluate(node["value"]))
            return None
        if node_type == "AssignmentNode":
            value = self._evaluate(node["value"])
            try:
                self.environment.assign(node["name"], value)
            except KeyError:
                self._fail(
                    node,
                    "RUN_UNDEFINED_VARIABLE",
                    f"La variable '{node['name']}' no está definida.",
                    "Declare la variable antes de asignarle un valor.",
                )
            return None
        if node_type == "ShowNode":
            value = self._evaluate(node["expression"])
            self.result.output.append(self._format_value(value))
            return None
        if node_type == "IfNode":
            if self._evaluate(node["condition"]):
                branch = node.get("then_body", [])
            else:
                branch = node.get("else_body", [])
            return self._execute_block(branch)
        if node_type == "SwitchNode":
            return self._execute_switch(node)
        if node_type == "WhileNode":
            return self._execute_while(node)
        if node_type == "RepeatNode":
            return self._execute_repeat(node)
        if node_type == "ForNode":
            return self._execute_for(node)
        self._fail(
            node,
            "RUN_UNSUPPORTED_NODE",
            f"El nodo '{node_type}' no se puede ejecutar todavía.",
            "Utilice una construcción incluida en el intérprete básico.",
        )

    def _execute_statements(self, statements: list[dict[str, Any]]) -> None:
        for statement in statements:
            self._execute_node(statement)

    def _execute_block(self, statements: list[dict[str, Any]]) -> None:
        previous = self.environment
        self.environment = RuntimeEnvironment(parent=previous)
        try:
            self._execute_statements(statements)
        finally:
            self.environment = previous

    def _execute_switch(self, node: dict[str, Any]) -> None:
        switch_value = self._evaluate(node["expression"])

        for case in node.get("cases", []):
            if switch_value == self._evaluate(case["value"]):
                self._execute_block(case.get("body", []))
                return

        self._execute_block(node.get("default_body", []))

    def _execute_while(self, node: dict[str, Any]) -> None:
        iterations = 0
        while self._evaluate(node["condition"]):
            self._guard_loop(node, iterations)
            self._execute_block(node.get("body", []))
            iterations += 1

    def _execute_repeat(self, node: dict[str, Any]) -> None:
        count = self._evaluate(node["count"])
        for iteration in range(count):
            self._guard_loop(node, iteration)
            self._execute_block(node.get("body", []))

    def _execute_for(self, node: dict[str, Any]) -> None:
        previous = self.environment
        self.environment = RuntimeEnvironment(parent=previous)
        try:
            self._execute_node(node["initializer"])
            iterations = 0
            while self._evaluate(node["condition"]):
                self._guard_loop(node, iterations)
                self._execute_block(node.get("body", []))
                self._execute_node(node["update"])
                iterations += 1
        finally:
            self.environment = previous

    def _guard_loop(self, node: dict[str, Any], iterations: int) -> None:
        if iterations >= self.max_loop_iterations:
            self._fail(
                node,
                "RUN_LOOP_LIMIT_EXCEEDED",
                "El ciclo superó el límite permitido de iteraciones.",
                "Revise la condición o la actualización del ciclo.",
            )

    def _evaluate(self, node: dict[str, Any]) -> Any:
        node_type = node["node"]
        if node_type == "LiteralNode":
            return node.get("value")
        if node_type == "IdentifierNode":
            try:
                return self.environment.get(node["name"])
            except KeyError:
                self._fail(
                    node,
                    "RUN_UNDEFINED_VARIABLE",
                    f"La variable '{node['name']}' no está definida.",
                    "Declare la variable antes de utilizarla.",
                )
        if node_type == "BinaryExpressionNode":
            return self._evaluate_binary(node)
        if node_type == "UnaryExpressionNode":
            operand = self._evaluate(node["operand"])
            if node["operator"] == "no":
                return not operand
            if node["operator"] == "-":
                return -operand
        if node_type == "ReadNode":
            return self.input_provider(str(self._evaluate(node["message"])))
        self._fail(
            node,
            "RUN_UNSUPPORTED_EXPRESSION",
            f"La expresión '{node_type}' no se puede evaluar todavía.",
            "Utilice una expresión incluida en el intérprete básico.",
        )

    def _evaluate_binary(self, node: dict[str, Any]) -> Any:
        left = self._evaluate(node["left"])
        right = self._evaluate(node["right"])
        operator = node["operator"]
        operations = {
            "+": lambda: left + right,
            "-": lambda: left - right,
            "*": lambda: left * right,
            "y": lambda: left and right,
            "o": lambda: left or right,
            "==": lambda: left == right,
            "!=": lambda: left != right,
            ">": lambda: left > right,
            "<": lambda: left < right,
            ">=": lambda: left >= right,
            "<=": lambda: left <= right,
        }
        if operator == "/":
            if right == 0:
                self._fail(
                    node,
                    "RUN_DIVISION_BY_ZERO",
                    "No se puede dividir entre cero.",
                    "Cambie el divisor por un valor distinto de cero.",
                )
            return left / right
        if operator in operations:
            return operations[operator]()
        self._fail(
            node,
            "RUN_UNSUPPORTED_OPERATOR",
            f"El operador '{operator}' no se puede ejecutar.",
            "Utilice un operador reconocido por Lumi.",
        )

    @staticmethod
    def _format_value(value: Any) -> str:
        if value is True:
            return "verdadero"
        if value is False:
            return "falso"
        if value is None:
            return "nulo"
        return str(value)

    def _fail(
        self,
        node: dict[str, Any],
        code: str,
        description: str,
        suggestion: str,
    ) -> None:
        diagnostic = Diagnostic(
            category=DiagnosticCategory.RUNTIME,
            code=code,
            file=node.get("file", "<desconocido>"),
            line=node.get("line", 1),
            column=node.get("column", 1),
            description=description,
            suggestion=suggestion,
        )
        raise InterpreterRuntimeError(diagnostic)
