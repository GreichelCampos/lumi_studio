"""Type rules and semantic traversal for Lumi programs."""

from dataclasses import dataclass, field
from typing import Any

from .ast_adapter import normalize_ast
from .diagnostics import Diagnostic, DiagnosticCategory
from .symbol_table import DataType, Symbol, SymbolKind, SymbolTable


ARITHMETIC_OPERATORS = frozenset({"+", "-", "*", "/"})
LOGICAL_OPERATORS = frozenset({"y", "o"})
ORDERING_OPERATORS = frozenset({">", "<", ">=", "<="})
EQUALITY_OPERATORS = frozenset({"==", "!="})
NUMERIC_TYPES = frozenset({DataType.INTEGER, DataType.DECIMAL})


@dataclass(frozen=True, slots=True)
class TypeCheckResult:
    """The inferred type or the diagnostic produced by a type check."""

    result_type: DataType | None = None
    diagnostic: Diagnostic | None = None

    @property
    def is_valid(self) -> bool:
        return self.diagnostic is None


class TypeChecker:
    """Validate assignments and operators without depending on parser nodes."""

    @staticmethod
    def is_assignable(target_type: DataType, value_type: DataType) -> bool:
        """Return whether a value can be assigned without narrowing its type."""

        return target_type is value_type or (
            target_type is DataType.DECIMAL and value_type is DataType.INTEGER
        )

    def check_assignment(
        self,
        target_type: DataType,
        value_type: DataType,
        *,
        file: str,
        line: int,
        column: int,
    ) -> Diagnostic | None:
        """Return a diagnostic when an assignment uses incompatible types."""

        if self.is_assignable(target_type, value_type):
            return None

        return Diagnostic(
            category=DiagnosticCategory.SEMANTIC,
            code="SEM_TYPE_MISMATCH",
            file=file,
            line=line,
            column=column,
            description=(
                f"No se puede asignar un valor de tipo '{value_type.value}' "
                f"a una variable de tipo '{target_type.value}'."
            ),
            suggestion="Utilice un valor compatible con el tipo declarado.",
        )

    def check_binary_operation(
        self,
        left_type: DataType,
        operator: str,
        right_type: DataType,
        *,
        file: str,
        line: int,
        column: int,
    ) -> TypeCheckResult:
        """Infer the result type of a binary operation or report an error."""

        result_type = self._binary_result_type(left_type, operator, right_type)
        if result_type is not None:
            return TypeCheckResult(result_type=result_type)

        return TypeCheckResult(
            diagnostic=Diagnostic(
                category=DiagnosticCategory.SEMANTIC,
                code="SEM_INVALID_BINARY_OPERATION",
                file=file,
                line=line,
                column=column,
                description=(
                    f"El operador '{operator}' no es válido entre "
                    f"'{left_type.value}' y '{right_type.value}'."
                ),
                suggestion="Utilice operandos compatibles con el operador.",
            )
        )

    def check_unary_operation(
        self,
        operator: str,
        operand_type: DataType,
        *,
        file: str,
        line: int,
        column: int,
    ) -> TypeCheckResult:
        """Infer the result type of a unary operation or report an error."""

        if operator == "no" and operand_type is DataType.BOOLEAN:
            return TypeCheckResult(result_type=DataType.BOOLEAN)

        if operator == "-" and operand_type in NUMERIC_TYPES:
            return TypeCheckResult(result_type=operand_type)

        return TypeCheckResult(
            diagnostic=Diagnostic(
                category=DiagnosticCategory.SEMANTIC,
                code="SEM_INVALID_UNARY_OPERATION",
                file=file,
                line=line,
                column=column,
                description=(
                    f"El operador '{operator}' no es válido para "
                    f"el tipo '{operand_type.value}'."
                ),
                suggestion="Utilice un operando compatible con el operador.",
            )
        )

    @staticmethod
    def _binary_result_type(
        left_type: DataType,
        operator: str,
        right_type: DataType,
    ) -> DataType | None:
        if operator in ARITHMETIC_OPERATORS:
            if operator == "+" and left_type is right_type is DataType.STRING:
                return DataType.STRING

            if left_type in NUMERIC_TYPES and right_type in NUMERIC_TYPES:
                if operator == "/" or DataType.DECIMAL in (left_type, right_type):
                    return DataType.DECIMAL
                return DataType.INTEGER

        if operator in LOGICAL_OPERATORS:
            if left_type is right_type is DataType.BOOLEAN:
                return DataType.BOOLEAN

        if operator in ORDERING_OPERATORS:
            if left_type in NUMERIC_TYPES and right_type in NUMERIC_TYPES:
                return DataType.BOOLEAN

        if operator in EQUALITY_OPERATORS:
            if left_type is right_type:
                return DataType.BOOLEAN
            if left_type in NUMERIC_TYPES and right_type in NUMERIC_TYPES:
                return DataType.BOOLEAN

        return None


@dataclass(slots=True)
class SemanticAnalysisResult:
    """Diagnostics produced while validating a parsed Lumi program."""

    diagnostics: list[Diagnostic] = field(default_factory=list)

    @property
    def succeeded(self) -> bool:
        return not self.diagnostics


class SemanticAnalyzer:
    """Validate declarations, expressions and control flow in a Lumi AST."""

    def __init__(self) -> None:
        self.type_checker = TypeChecker()
        self.result = SemanticAnalysisResult()
        self.current_scope = SymbolTable()

    def analyze(self, program: Any) -> SemanticAnalysisResult:
        """Analyze a parsed ProgramNode or a compatible AST fixture."""

        self.result = SemanticAnalysisResult()
        self.current_scope = SymbolTable()
        self._analyze_node(normalize_ast(program))
        return self.result

    def _analyze_node(self, node: dict[str, Any]) -> None:
        node_type = node["node"]

        if node_type == "ProgramNode":
            self._analyze_statements(node.get("statements", []))
        elif node_type == "MainNode":
            self._analyze_block(node.get("body", []), "main")
        elif node_type == "VariableDeclarationNode":
            self._analyze_variable_declaration(node)
        elif node_type == "AssignmentNode":
            self._analyze_assignment(node)
        elif node_type == "ShowNode":
            self._infer_expression(node["expression"])
        elif node_type == "IfNode":
            self._require_boolean(node["condition"])
            self._analyze_block(node.get("then_body", []), "if")
            self._analyze_block(node.get("else_body", []), "else")
        elif node_type == "SwitchNode":
            self._analyze_switch(node)
        elif node_type == "WhileNode":
            self._require_boolean(node["condition"])
            self._analyze_block(node.get("body", []), "while")
        elif node_type == "RepeatNode":
            self._require_integer(node["count"], "SEM_REPEAT_COUNT_NOT_INTEGER")
            self._analyze_block(node.get("body", []), "repeat")
        elif node_type == "ForNode":
            self._analyze_for(node)
        elif node_type == "FunctionDeclarationNode":
            self._analyze_function(node)
        elif node_type == "ReturnNode" and node.get("value") is not None:
            self._infer_expression(node["value"])

    def _analyze_statements(self, statements: list[dict[str, Any]]) -> None:
        for statement in statements:
            self._analyze_node(statement)

    def _analyze_block(
        self,
        statements: list[dict[str, Any]],
        scope_name: str,
    ) -> None:
        previous = self.current_scope
        self.current_scope = previous.create_child_scope(scope_name)
        try:
            self._analyze_statements(statements)
        finally:
            self.current_scope = previous

    def _analyze_variable_declaration(self, node: dict[str, Any]) -> None:
        declared_type = self._data_type(node["type"], node)
        value_type = self._infer_expression(node["value"])
        if declared_type is None:
            return

        symbol = Symbol(
            name=node["name"],
            kind=SymbolKind.VARIABLE,
            data_type=declared_type,
            file=node["file"],
            line=node["line"],
            column=node["column"],
        )
        if not self.current_scope.define(symbol):
            self._add_diagnostic(
                node,
                "SEM_DUPLICATE_SYMBOL",
                f"El símbolo '{node['name']}' ya está declarado en este alcance.",
                "Utilice un nombre diferente o elimine la declaración duplicada.",
            )
            return

        if value_type is not None:
            diagnostic = self.type_checker.check_assignment(
                declared_type,
                value_type,
                **self._location(node),
            )
            self._append(diagnostic)

    def _analyze_assignment(self, node: dict[str, Any]) -> None:
        symbol = self.current_scope.resolve(node["name"])
        value_type = self._infer_expression(node["value"])
        if symbol is None:
            self._undefined(node, node["name"])
            return
        if value_type is not None:
            diagnostic = self.type_checker.check_assignment(
                symbol.data_type,
                value_type,
                **self._location(node),
            )
            self._append(diagnostic)

    def _infer_expression(self, node: dict[str, Any]) -> DataType | None:
        node_type = node["node"]
        if node_type == "LiteralNode":
            if node["literal_kind"] == "nulo":
                return None
            return self._data_type(node["literal_kind"], node)
        if node_type == "IdentifierNode":
            symbol = self.current_scope.resolve(node["name"])
            if symbol is None:
                self._undefined(node, node["name"])
                return None
            return symbol.data_type
        if node_type == "BinaryExpressionNode":
            left_type = self._infer_expression(node["left"])
            right_type = self._infer_expression(node["right"])
            if left_type is None or right_type is None:
                return None
            check = self.type_checker.check_binary_operation(
                left_type,
                node["operator"],
                right_type,
                **self._location(node),
            )
            self._append(check.diagnostic)
            return check.result_type
        if node_type == "UnaryExpressionNode":
            operand_type = self._infer_expression(node["operand"])
            if operand_type is None:
                return None
            check = self.type_checker.check_unary_operation(
                node["operator"],
                operand_type,
                **self._location(node),
            )
            self._append(check.diagnostic)
            return check.result_type
        if node_type == "ReadNode":
            self._infer_expression(node["message"])
            return DataType.STRING
        if node_type == "ListNode":
            for element in node.get("elements", []):
                self._infer_expression(element)
            return DataType.LIST
        if node_type == "VectorNode":
            for component in (node["x"], node["y"], node["z"]):
                component_type = self._infer_expression(component)
                if component_type not in NUMERIC_TYPES and component_type is not None:
                    self._add_diagnostic(
                        component,
                        "SEM_VECTOR_COMPONENT_NOT_NUMERIC",
                        "Los componentes de un vector deben ser numéricos.",
                        "Utilice valores de tipo entero o decimal.",
                    )
            return DataType.VECTOR
        return None

    def _require_boolean(self, expression: dict[str, Any]) -> None:
        expression_type = self._infer_expression(expression)
        if expression_type is not None and expression_type is not DataType.BOOLEAN:
            self._add_diagnostic(
                expression,
                "SEM_CONDITION_NOT_BOOLEAN",
                "La condición debe producir un valor booleano.",
                "Utilice una expresión lógica o relacional.",
            )

    def _require_integer(self, expression: dict[str, Any], code: str) -> None:
        expression_type = self._infer_expression(expression)
        if expression_type is not None and expression_type is not DataType.INTEGER:
            self._add_diagnostic(
                expression,
                code,
                "La cantidad de repeticiones debe ser de tipo entero.",
                "Utilice una expresión de tipo entero.",
            )

    def _analyze_switch(self, node: dict[str, Any]) -> None:
        expression_type = self._infer_expression(node["expression"])
        for case in node.get("cases", []):
            case_type = self._infer_expression(case["value"])
            if expression_type is not None and case_type is not None:
                check = self.type_checker.check_binary_operation(
                    expression_type,
                    "==",
                    case_type,
                    **self._location(case),
                )
                self._append(check.diagnostic)
            self._analyze_block(case.get("body", []), "case")
        self._analyze_block(node.get("default_body", []), "default")

    def _analyze_for(self, node: dict[str, Any]) -> None:
        previous = self.current_scope
        self.current_scope = previous.create_child_scope("for")
        try:
            self._analyze_node(node["initializer"])
            self._require_boolean(node["condition"])
            self._analyze_block(node.get("body", []), "for-body")
            self._analyze_node(node["update"])
        finally:
            self.current_scope = previous

    def _analyze_function(self, node: dict[str, Any]) -> None:
        return_type = self._data_type(node["return_type"], node)
        if return_type is None:
            return
        parameters = tuple(
            (parameter["name"], DataType(parameter["data_type"]))
            for parameter in node.get("parameters", [])
        )
        symbol = Symbol(
            name=node["name"],
            kind=SymbolKind.FUNCTION,
            data_type=return_type,
            file=node["file"],
            line=node["line"],
            column=node["column"],
            parameters=parameters,
            return_type=return_type,
        )
        if not self.current_scope.define(symbol):
            self._add_diagnostic(
                node,
                "SEM_DUPLICATE_SYMBOL",
                f"El símbolo '{node['name']}' ya está declarado en este alcance.",
                "Utilice un nombre diferente.",
            )
            return

        previous = self.current_scope
        self.current_scope = previous.create_child_scope(node["name"])
        try:
            for parameter in node.get("parameters", []):
                parameter_type = self._data_type(
                    parameter["data_type"],
                    parameter,
                )
                if parameter_type is None:
                    continue
                self.current_scope.define(
                    Symbol(
                        name=parameter["name"],
                        kind=SymbolKind.PARAMETER,
                        data_type=parameter_type,
                        file=parameter["file"],
                        line=parameter["line"],
                        column=parameter["column"],
                    )
                )
            self._analyze_statements(node.get("body", []))
        finally:
            self.current_scope = previous

    def _data_type(
        self,
        type_name: str,
        node: dict[str, Any],
    ) -> DataType | None:
        try:
            return DataType(type_name)
        except ValueError:
            self._add_diagnostic(
                node,
                "SEM_UNKNOWN_TYPE",
                f"El tipo '{type_name}' no está definido en Lumi.",
                "Utilice un tipo reconocido por el lenguaje.",
            )
            return None

    def _undefined(self, node: dict[str, Any], name: str) -> None:
        self._add_diagnostic(
            node,
            "SEM_UNDECLARED_VARIABLE",
            f"La variable '{name}' no ha sido declarada.",
            "Declare la variable antes de utilizarla.",
        )

    def _add_diagnostic(
        self,
        node: dict[str, Any],
        code: str,
        description: str,
        suggestion: str,
    ) -> None:
        self.result.diagnostics.append(
            Diagnostic(
                category=DiagnosticCategory.SEMANTIC,
                code=code,
                description=description,
                suggestion=suggestion,
                **self._location(node),
            )
        )

    def _append(self, diagnostic: Diagnostic | None) -> None:
        if diagnostic is not None:
            self.result.diagnostics.append(diagnostic)

    @staticmethod
    def _location(node: dict[str, Any]) -> dict[str, str | int]:
        return {
            "file": node.get("file", "<desconocido>"),
            "line": node.get("line", 1),
            "column": node.get("column", 1),
        }
