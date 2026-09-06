"""Symbol definitions and lexical scope support for Lumi semantic checks."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class DataType(str, Enum):
    """Data types that can be assigned to Lumi symbols."""

    INTEGER = "entero"
    DECIMAL = "decimal"
    STRING = "texto"
    BOOLEAN = "booleano"
    LIST = "lista"
    VECTOR = "vector"
    VOID = "vacio"


class SymbolKind(str, Enum):
    """Kinds of declarations stored in a symbol table."""

    VARIABLE = "variable"
    FUNCTION = "function"
    PARAMETER = "parameter"


@dataclass(frozen=True, slots=True)
class Symbol:
    """A named declaration and its source location."""

    name: str
    kind: SymbolKind
    data_type: DataType
    file: str
    line: int
    column: int
    source_file: str | None = None
    is_imported: bool = False
    parameters: tuple[tuple[str, DataType], ...] = ()
    return_type: DataType | None = None


class SymbolTable:
    """A single lexical scope with an optional parent scope."""

    def __init__(
        self,
        parent: SymbolTable | None = None,
        scope_name: str = "global",
    ) -> None:
        self.parent = parent
        self.scope_name = scope_name
        self._symbols: dict[str, Symbol] = {}

    def define(self, symbol: Symbol) -> bool:
        """Define a symbol in this scope, returning false for duplicates."""

        if self.exists_current_scope(symbol.name):
            return False

        self._symbols[symbol.name] = symbol
        return True

    def resolve(self, name: str) -> Symbol | None:
        """Resolve a symbol from this scope or its closest parent scope."""

        symbol = self._symbols.get(name)
        if symbol is not None:
            return symbol

        if self.parent is not None:
            return self.parent.resolve(name)

        return None

    def exists_current_scope(self, name: str) -> bool:
        """Return whether a name is already defined in this exact scope."""

        return name in self._symbols

    def create_child_scope(self, scope_name: str = "block") -> SymbolTable:
        """Create an empty lexical scope whose parent is this table."""

        return SymbolTable(parent=self, scope_name=scope_name)
