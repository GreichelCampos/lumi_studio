"""JSON-ready front-end snapshots, independent of scene and wire generation.

This is analysis data, not the .lumic v1 container (which does not embed AST).
"""

import json
from typing import Any

from lumi_language.ast_adapter import normalize_ast
from lumi_language.diagnostics import serialize_diagnostic
from .results import CompilationResult


class CompilationSerializationError(ValueError):
    """Analysis data cannot be represented as standard JSON; not a diagnostic."""


def _encode_json(value: Any) -> str:
    try:
        return json.dumps(
            value, allow_nan=False, ensure_ascii=True, sort_keys=True,
            separators=(",", ":"),
        )
    except (TypeError, ValueError, OverflowError, RecursionError) as error:
        raise CompilationSerializationError(
            "El resultado frontal no puede representarse como JSON estándar."
        ) from error


def serialize_compilation(result: CompilationResult) -> dict[str, Any]:
    """Copy and validate analysis data without changing AST values."""
    try:
        serialized = _compilation_snapshot(result)
    except RecursionError as error:
        raise CompilationSerializationError("El AST contiene ciclos o anidamiento excesivo.") from error
    _encode_json(serialized)
    return serialized


def serialize_compilation_json(result: CompilationResult) -> str:
    """Encode a validated snapshot with stable keys and compact ASCII JSON."""
    return _encode_json(serialize_compilation(result))


def _compilation_snapshot(result: CompilationResult) -> dict[str, Any]:
    """Copy analysis data without executing, generating scenes or inferring errors."""
    serialized = {
        "file": result.file,
        "status": result.status.value,
        "stage": result.stage.value,
        "program": normalize_ast(result.program),
        "imported_programs": {
            file: normalize_ast(result.imported_programs[file])
            for file in sorted(result.imported_programs)
        },
        "diagnostics": [serialize_diagnostic(item) for item in result.diagnostics],
        "limitations": [item.value for item in result.limitations],
    }
    if result.lexical_error is not None:
        serialized["lexical_error"] = result.lexical_error
    if result.lexical_error_location is not None:
        location = result.lexical_error_location
        serialized["lexical_error_location"] = {
            "file": location.file, "line": location.line, "column": location.column,
        }
    return serialized
