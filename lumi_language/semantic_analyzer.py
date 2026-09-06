"""Type compatibility rules used by Lumi semantic analysis."""

from dataclasses import dataclass

from .diagnostics import Diagnostic, DiagnosticCategory
from .symbol_table import DataType


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
