"""Runtime execution of validated Lumi AST fixtures."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from .ast_adapter import normalize_ast
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


@dataclass(slots=True)
class RuntimeFunction:
    """A function declaration and the lexical context where it was defined."""

    declaration: dict[str, Any]
    closure_environment: RuntimeEnvironment
    closure_scope: RuntimeFunctionScope


class RuntimeFunctionScope:
    """Function declarations available in one lexical scope."""

    def __init__(self, parent: RuntimeFunctionScope | None = None) -> None:
        self.parent = parent
        self._functions: dict[str, RuntimeFunction] = {}

    def define(self, name: str, function: RuntimeFunction) -> bool:
        if name in self._functions:
            return False
        self._functions[name] = function
        return True

    def resolve(self, name: str) -> RuntimeFunction | None:
        function = self._functions.get(name)
        if function is not None:
            return function
        if self.parent is not None:
            return self.parent.resolve(name)
        return None


class InterpreterRuntimeError(Exception):
    """Internal control flow for a runtime failure with source context."""

    def __init__(self, diagnostic: Diagnostic) -> None:
        super().__init__(diagnostic.description)
        self.diagnostic = diagnostic


class _FunctionReturn(Exception):
    """Internal signal that carries a function's returned value."""

    def __init__(self, value: Any) -> None:
        super().__init__()
        self.value = value


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
        self.function_scope = RuntimeFunctionScope()
        self._call_depth = 0
        self.imported_programs: dict[str, dict[str, Any]] = {}
        self._has_import_context = False

    def execute(
        self,
        program: Any,
        imported_programs: dict[str, Any] | None = None,
    ) -> InterpreterResult:
        """Execute a parsed ProgramNode or a compatible AST fixture."""

        self.result = InterpreterResult()
        self.environment = RuntimeEnvironment()
        self.function_scope = RuntimeFunctionScope()
        self._call_depth = 0
        self._has_import_context = imported_programs is not None
        self.imported_programs = {
            file_name: normalize_ast(imported_program)
            for file_name, imported_program in (imported_programs or {}).items()
        }
        normalized_program = normalize_ast(program)
        try:
            self._execute_node(normalized_program)
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
        if node_type == "FunctionDeclarationNode":
            return None
        if node_type == "FunctionCallNode":
            self._evaluate_function_call(node)
            return None
        if node_type == "ReturnNode":
            if self._call_depth == 0:
                self._fail(
                    node,
                    "RUN_RETURN_OUTSIDE_FUNCTION",
                    "La instrucción 'retornar' se ejecutó fuera de una función.",
                    "Utilice 'retornar' solamente dentro de una función.",
                )
            value = self._evaluate(node["value"])
            raise _FunctionReturn(value)
        if node_type == "ImportNode":
            self._execute_import(node)
            return None
        self._fail(
            node,
            "RUN_UNSUPPORTED_NODE",
            f"El nodo '{node_type}' no se puede ejecutar todavía.",
            "Utilice una construcción incluida en el intérprete básico.",
        )

    def _execute_statements(self, statements: list[dict[str, Any]]) -> None:
        for statement in statements:
            if statement["node"] == "FunctionDeclarationNode":
                function = RuntimeFunction(
                    declaration=statement,
                    closure_environment=self.environment,
                    closure_scope=self.function_scope,
                )
                if not self.function_scope.define(statement["name"], function):
                    self._fail(
                        statement,
                        "RUN_DUPLICATE_FUNCTION",
                        (
                            f"La función '{statement['name']}' ya está "
                            "declarada en este alcance."
                        ),
                        "Utilice un nombre diferente para cada función.",
                    )

        for statement in statements:
            self._execute_node(statement)

    def _execute_block(self, statements: list[dict[str, Any]]) -> None:
        previous_environment = self.environment
        previous_function_scope = self.function_scope
        self.environment = RuntimeEnvironment(parent=previous_environment)
        self.function_scope = RuntimeFunctionScope(
            parent=previous_function_scope,
        )
        try:
            self._execute_statements(statements)
        finally:
            self.environment = previous_environment
            self.function_scope = previous_function_scope

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
        if node_type == "FunctionCallNode":
            return self._evaluate_function_call(node)
        self._fail(
            node,
            "RUN_UNSUPPORTED_EXPRESSION",
            f"La expresión '{node_type}' no se puede evaluar todavía.",
            "Utilice una expresión incluida en el intérprete básico.",
        )

    def _evaluate_function_call(self, node: dict[str, Any]) -> Any:
        function = self.function_scope.resolve(node["name"])
        if function is None:
            self._fail(
                node,
                "RUN_UNDEFINED_FUNCTION",
                f"La función '{node['name']}' no está definida.",
                "Declare la función antes de ejecutarla.",
            )

        arguments = [
            self._evaluate(argument)
            for argument in node.get("arguments", [])
        ]
        declaration = function.declaration
        parameters = declaration.get("parameters", [])
        if len(arguments) != len(parameters):
            self._fail(
                node,
                "RUN_ARGUMENT_COUNT_MISMATCH",
                (
                    f"La función '{node['name']}' espera "
                    f"{len(parameters)} argumento(s), pero recibió "
                    f"{len(arguments)}."
                ),
                "Proporcione la cantidad de argumentos definida por la función.",
            )

        previous_environment = self.environment
        previous_function_scope = self.function_scope
        self.environment = RuntimeEnvironment(
            parent=function.closure_environment,
        )
        self.function_scope = RuntimeFunctionScope(
            parent=function.closure_scope,
        )
        self._call_depth += 1
        try:
            for parameter, argument in zip(parameters, arguments):
                self.environment.define(parameter["name"], argument)
            try:
                self._execute_statements(declaration.get("body", []))
            except _FunctionReturn as returned:
                return returned.value
            return None
        finally:
            self._call_depth -= 1
            self.environment = previous_environment
            self.function_scope = previous_function_scope

    def _execute_import(self, node: dict[str, Any]) -> None:
        file_name = node["file_name"]
        symbol_name = node["symbol_name"]
        if not self._has_import_context:
            self._fail(
                node,
                "RUN_IMPORT_CONTEXT_UNAVAILABLE",
                "No se proporcionó el contexto de programas importados.",
                "Ejecute el programa con el contexto producido por el parser.",
            )

        imported_program = self.imported_programs.get(file_name)
        if imported_program is None:
            self._fail(
                node,
                "RUN_IMPORT_FILE_NOT_FOUND",
                f"El programa importado '{file_name}' no está disponible.",
                "Incluya el archivo en el contexto de programas importados.",
            )

        try:
            statements = imported_program["statements"]
            declarations = [
                statement
                for statement in statements
                if isinstance(statement, dict)
                and statement.get("name") == symbol_name
            ]
        except (KeyError, TypeError):
            self._fail(
                node,
                "RUN_IMPORT_INVALID_AST",
                f"El programa importado '{file_name}' tiene una estructura inválida.",
                "Vuelva a generar el AST del archivo importado.",
            )
        if not declarations:
            self._fail(
                node,
                "RUN_IMPORT_SYMBOL_NOT_FOUND",
                (
                    f"El símbolo '{symbol_name}' no existe en "
                    f"'{file_name}'."
                ),
                "Verifique el nombre solicitado en la instrucción importar.",
            )

        function = next(
            (
                declaration
                for declaration in declarations
                if declaration.get("node") == "FunctionDeclarationNode"
            ),
            None,
        )
        if function is None:
            self._fail(
                node,
                "RUN_IMPORT_SYMBOL_NOT_FUNCTION",
                f"El símbolo '{symbol_name}' no es una función ejecutable.",
                "Importe una función declarada en el archivo solicitado.",
            )

        try:
            parameters = function["parameters"]
            body = function["body"]
            if not isinstance(parameters, list) or not isinstance(body, list):
                raise TypeError
            if any(
                not isinstance(parameter, dict) or "name" not in parameter
                for parameter in parameters
            ):
                raise TypeError
        except (KeyError, TypeError):
            self._fail(
                node,
                "RUN_IMPORT_INVALID_AST",
                f"La función importada '{symbol_name}' tiene una estructura inválida.",
                "Vuelva a generar el AST del archivo importado.",
            )

        if self.function_scope.resolve(symbol_name) is not None:
            self._fail(
                node,
                "RUN_IMPORT_NAME_CONFLICT",
                (
                    f"La función importada '{symbol_name}' entra en conflicto "
                    "con una función ya registrada."
                ),
                "Cambie uno de los nombres o elimine la importación.",
            )

        runtime_function = RuntimeFunction(
            declaration=function,
            closure_environment=self.environment,
            closure_scope=self.function_scope,
        )
        self.function_scope.define(symbol_name, runtime_function)

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
