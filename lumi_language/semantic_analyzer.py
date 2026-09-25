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
        self.current_function: Symbol | None = None
        self._function_symbols: dict[int, Symbol] = {}
        self._processed_function_nodes: set[int] = set()
        self.imported_programs: dict[str, dict[str, Any]] = {}
        self._has_import_context = False

    def analyze(
        self,
        program: Any,
        imported_programs: dict[str, Any] | None = None,
    ) -> SemanticAnalysisResult:
        """Analyze a parsed ProgramNode or a compatible AST fixture."""

        self.result = SemanticAnalysisResult()
        self.current_scope = SymbolTable()
        self.current_function = None
        self._function_symbols = {}
        self._processed_function_nodes = set()
        self._has_import_context = imported_programs is not None
        self.imported_programs = {
            file_name: normalize_ast(imported_program)
            for file_name, imported_program in (imported_programs or {}).items()
        }
        normalized_program = normalize_ast(program)
        if normalized_program["node"] == "ProgramNode":
            self._predeclare_functions(normalized_program.get("statements", []))
        self._analyze_node(normalized_program)
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
        elif node_type == "FunctionCallNode":
            self._infer_function_call(node)
        elif node_type == "ReturnNode":
            self._analyze_return(node)
        elif node_type == "ImportNode":
            self._analyze_import(node)

    def _analyze_statements(self, statements: list[dict[str, Any]]) -> None:
        self._predeclare_functions(statements)
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
        if node_type == "FunctionCallNode":
            return self._infer_function_call(node)
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

    def _predeclare_functions(self, statements: list[dict[str, Any]]) -> None:
        for statement in statements:
            if (
                statement["node"] == "FunctionDeclarationNode"
                and id(statement) not in self._processed_function_nodes
            ):
                self._register_function(statement)

    def _register_function(self, node: dict[str, Any]) -> Symbol | None:
        self._processed_function_nodes.add(id(node))
        return_type = self._data_type(node["return_type"], node)
        parameters: list[tuple[str, DataType]] = []
        signature_is_valid = return_type is not None
        for parameter in node.get("parameters", []):
            parameter_type = self._data_type(parameter["data_type"], parameter)
            if parameter_type is None:
                signature_is_valid = False
                continue
            parameters.append((parameter["name"], parameter_type))

        if not signature_is_valid or return_type is None:
            return None

        symbol = Symbol(
            name=node["name"],
            kind=SymbolKind.FUNCTION,
            data_type=return_type,
            file=node["file"],
            line=node["line"],
            column=node["column"],
            parameters=tuple(parameters),
            return_type=return_type,
        )
        if not self.current_scope.define(symbol):
            self._add_diagnostic(
                node,
                "SEM_DUPLICATE_SYMBOL",
                f"El símbolo '{node['name']}' ya está declarado en este alcance.",
                "Utilice un nombre diferente.",
            )
            return None

        self._function_symbols[id(node)] = symbol
        return symbol

    def _analyze_function(self, node: dict[str, Any]) -> None:
        symbol = self._function_symbols.get(id(node))
        if symbol is None and id(node) not in self._processed_function_nodes:
            symbol = self._register_function(node)
        if symbol is None:
            return

        self._analyze_function_body(node, symbol)

    def _analyze_function_body(
        self,
        node: dict[str, Any],
        symbol: Symbol,
    ) -> None:

        previous = self.current_scope
        previous_function = self.current_function
        self.current_scope = previous.create_child_scope(node["name"])
        self.current_function = symbol
        try:
            for parameter in node.get("parameters", []):
                parameter_type = self._data_type(
                    parameter["data_type"],
                    parameter,
                )
                if parameter_type is None:
                    continue
                parameter_symbol = Symbol(
                    name=parameter["name"],
                    kind=SymbolKind.PARAMETER,
                    data_type=parameter_type,
                    file=parameter["file"],
                    line=parameter["line"],
                    column=parameter["column"],
                )
                if not self.current_scope.define(parameter_symbol):
                    self._add_diagnostic(
                        parameter,
                        "SEM_DUPLICATE_SYMBOL",
                        f"El parámetro '{parameter['name']}' está duplicado.",
                        "Utilice un nombre diferente para cada parámetro.",
                    )
            self._analyze_statements(node.get("body", []))
            if (
                symbol.return_type is not DataType.VOID
                and not self._block_guarantees_return(node.get("body", []))
            ):
                self._add_diagnostic(
                    node,
                    "SEM_MISSING_RETURN",
                    (
                        f"La función '{node['name']}' puede finalizar sin "
                        f"retornar un valor de tipo '{symbol.return_type.value}'."
                    ),
                    "Asegure que todos los caminos de la función retornen un valor.",
                )
        finally:
            self.current_scope = previous
            self.current_function = previous_function

    def _block_guarantees_return(self, statements: list[dict[str, Any]]) -> bool:
        for statement in statements:
            node_type = statement.get("node")
            if node_type == "ReturnNode":
                return True
            if node_type == "IfNode":
                then_returns = self._block_guarantees_return(
                    statement.get("then_body", [])
                )
                else_body = statement.get("else_body", [])
                if else_body and then_returns and self._block_guarantees_return(
                    else_body
                ):
                    return True
            if node_type == "SwitchNode":
                cases = statement.get("cases", [])
                default_body = statement.get("default_body", [])
                if (
                    cases
                    and default_body
                    and all(
                        self._block_guarantees_return(case.get("body", []))
                        for case in cases
                    )
                    and self._block_guarantees_return(default_body)
                ):
                    return True
        return False

    def _infer_function_call(self, node: dict[str, Any]) -> DataType | None:
        arguments = node.get("arguments", [])
        argument_types = [self._infer_expression(argument) for argument in arguments]
        symbol = self.current_scope.resolve(node["name"])

        if symbol is None:
            self._add_diagnostic(
                node,
                "SEM_UNDECLARED_FUNCTION",
                f"La función '{node['name']}' no ha sido declarada.",
                "Declare la función antes de utilizarla.",
            )
            return None

        if symbol.kind is not SymbolKind.FUNCTION:
            self._add_diagnostic(
                node,
                "SEM_SYMBOL_NOT_CALLABLE",
                f"El símbolo '{node['name']}' no es una función.",
                "Utilice el nombre de una función declarada.",
            )
            return None

        if len(arguments) != len(symbol.parameters):
            self._add_diagnostic(
                node,
                "SEM_ARGUMENT_COUNT_MISMATCH",
                (
                    f"La función '{node['name']}' espera "
                    f"{len(symbol.parameters)} argumento(s), pero recibió "
                    f"{len(arguments)}."
                ),
                "Proporcione la cantidad de argumentos definida por la función.",
            )

        for argument, argument_type, (_, parameter_type) in zip(
            arguments,
            argument_types,
            symbol.parameters,
        ):
            if argument_type is None:
                continue
            if not self.type_checker.is_assignable(parameter_type, argument_type):
                self._add_diagnostic(
                    argument,
                    "SEM_ARGUMENT_TYPE_MISMATCH",
                    (
                        f"El argumento de tipo '{argument_type.value}' no es "
                        f"compatible con el parámetro de tipo "
                        f"'{parameter_type.value}'."
                    ),
                    "Utilice un argumento compatible con el tipo del parámetro.",
                )

        return symbol.return_type

    def _analyze_return(self, node: dict[str, Any]) -> None:
        value = node.get("value")
        value_type = self._infer_expression(value) if value is not None else None

        if self.current_function is None:
            self._add_diagnostic(
                node,
                "SEM_RETURN_OUTSIDE_FUNCTION",
                "La instrucción 'retornar' solo puede utilizarse en una función.",
                "Mueva la instrucción dentro del cuerpo de una función.",
            )
            return

        expected_type = self.current_function.return_type
        if expected_type is DataType.VOID:
            if value is not None:
                self._add_diagnostic(
                    node,
                    "SEM_RETURN_TYPE_MISMATCH",
                    "Una función 'vacio' no debe retornar un valor.",
                    "Elimine el valor retornado o cambie el tipo de la función.",
                )
            return

        if value is None:
            self._add_diagnostic(
                node,
                "SEM_RETURN_TYPE_MISMATCH",
                (
                    f"La función debe retornar un valor de tipo "
                    f"'{expected_type.value}'."
                ),
                "Retorne un valor compatible con el tipo declarado.",
            )
            return

        if value_type is not None and not self.type_checker.is_assignable(
            expected_type,
            value_type,
        ):
            self._add_diagnostic(
                node,
                "SEM_RETURN_TYPE_MISMATCH",
                (
                    f"La función retorna un valor de tipo '{value_type.value}', "
                    f"pero declaró el tipo '{expected_type.value}'."
                ),
                "Retorne un valor compatible con el tipo declarado.",
            )

    def _analyze_import(self, node: dict[str, Any]) -> None:
        file_name = node["file_name"]
        symbol_name = node["symbol_name"]
        if not self._has_import_context:
            self._add_import_diagnostic(
                node,
                "IMPORT_CONTEXT_UNAVAILABLE",
                "No se proporcionó el contexto de programas importados.",
                "Analice el programa con el contexto producido por el parser.",
            )
            return

        imported_program = self.imported_programs.get(file_name)
        if imported_program is None:
            self._add_import_diagnostic(
                node,
                "IMPORT_FILE_NOT_FOUND",
                f"No está disponible el programa importado '{file_name}'.",
                "Proporcione el archivo importado al analizador semántico.",
            )
            return

        try:
            statements = imported_program["statements"]
            declarations = [
                statement
                for statement in statements
                if isinstance(statement, dict)
                and statement.get("name") == symbol_name
            ]
        except (KeyError, TypeError):
            self._add_import_diagnostic(
                node,
                "IMPORT_INVALID_SIGNATURE",
                f"El programa importado '{file_name}' tiene una estructura inválida.",
                "Vuelva a generar el AST del archivo importado.",
            )
            return
        if not declarations:
            self._add_import_diagnostic(
                node,
                "IMPORT_SYMBOL_NOT_FOUND",
                (
                    f"El símbolo '{symbol_name}' no existe en "
                    f"'{file_name}'."
                ),
                "Verifique el nombre solicitado en la instrucción importar.",
            )
            return

        function = next(
            (
                declaration
                for declaration in declarations
                if declaration.get("node") == "FunctionDeclarationNode"
            ),
            None,
        )
        if function is None:
            self._add_import_diagnostic(
                node,
                "IMPORT_UNSUPPORTED_SYMBOL",
                f"El símbolo '{symbol_name}' no es una función importable.",
                "Importe una función declarada en el archivo solicitado.",
            )
            return

        existing = self.current_scope.resolve(symbol_name)
        if existing is not None:
            if existing.is_imported and existing.source_file == file_name:
                code = "IMPORT_DUPLICATE_SYMBOL"
                description = (
                    f"El símbolo '{symbol_name}' de '{file_name}' "
                    "ya fue importado en este alcance."
                )
                suggestion = "Elimine la instrucción importar duplicada."
            else:
                code = "IMPORT_SYMBOL_CONFLICT"
                description = (
                    f"El símbolo importado '{symbol_name}' entra en conflicto "
                    "con un símbolo visible."
                )
                suggestion = "Cambie uno de los nombres o elimine la importación."
            self._add_import_diagnostic(
                node,
                code,
                description,
                suggestion,
            )
            return

        signature = self._imported_function_signature(node, function)
        if signature is None:
            return
        return_type, parameters = signature
        symbol = Symbol(
            name=symbol_name,
            kind=SymbolKind.FUNCTION,
            data_type=return_type,
            file=function["file"],
            line=function["line"],
            column=function["column"],
            source_file=file_name,
            is_imported=True,
            parameters=parameters,
            return_type=return_type,
        )
        self.current_scope.define(symbol)
        self._analyze_function_body(function, symbol)

    def _imported_function_signature(
        self,
        import_node: dict[str, Any],
        function: dict[str, Any],
    ) -> tuple[DataType, tuple[tuple[str, DataType], ...]] | None:
        try:
            return_type = DataType(function["return_type"])
            raw_parameters = function.get("parameters", [])
            if not isinstance(raw_parameters, list):
                raise TypeError
            parameters_list: list[tuple[str, DataType]] = []
            parameter_names: set[str] = set()
            for parameter in raw_parameters:
                name = parameter["name"]
                if name in parameter_names:
                    raise ValueError
                parameter_names.add(name)
                parameters_list.append(
                    (name, DataType(parameter["data_type"]))
                )
            parameters = tuple(parameters_list)
            for field_name in ("name", "file", "line", "column", "body"):
                function[field_name]
            if not isinstance(function["body"], list):
                raise TypeError
        except (KeyError, TypeError, ValueError):
            self._add_import_diagnostic(
                import_node,
                "IMPORT_INVALID_SIGNATURE",
                (
                    f"La función importada '{import_node['symbol_name']}' "
                    "tiene una firma inválida."
                ),
                "Corrija los tipos de retorno y parámetros en el archivo importado.",
            )
            return None

        return return_type, parameters

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

    def _add_import_diagnostic(
        self,
        node: dict[str, Any],
        code: str,
        description: str,
        suggestion: str,
    ) -> None:
        self.result.diagnostics.append(
            Diagnostic(
                category=DiagnosticCategory.IMPORT,
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
