"""Shared diagnostic structures for Lumi tooling."""

from dataclasses import dataclass
from enum import Enum


class DiagnosticCategory(str, Enum):
    """Stages that can report a Lumi diagnostic."""

    LEXICAL = "LEXICAL"
    SYNTACTIC = "SYNTACTIC"
    SEMANTIC = "SEMANTIC"
    IMPORT = "IMPORT"
    RUNTIME = "RUNTIME"
    SPATIAL = "SPATIAL"


@dataclass(frozen=True, slots=True)
class Diagnostic:
    """A problem associated with a location in Lumi source code."""

    category: DiagnosticCategory
    code: str
    file: str
    line: int
    column: int
    description: str
    suggestion: str | None = None


def serialize_diagnostic(diagnostic: Diagnostic) -> dict[str, str | int]:
    """Preserve core fields; omit only an absent suggestion."""
    result: dict[str, str | int] = {
        "category": diagnostic.category.value,
        "code": diagnostic.code,
        "file": diagnostic.file,
        "line": diagnostic.line,
        "column": diagnostic.column,
        "description": diagnostic.description,
    }
    if diagnostic.suggestion is not None:
        result["suggestion"] = diagnostic.suggestion
    return result
