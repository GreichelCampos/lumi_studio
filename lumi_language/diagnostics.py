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
