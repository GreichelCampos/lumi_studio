"""Compatibility helpers for dataclass AST nodes and dictionary fixtures."""

from collections.abc import Mapping
from dataclasses import fields, is_dataclass
from typing import Any


def normalize_ast(value: Any) -> Any:
    """Convert AST dataclasses to fixture-compatible dictionaries recursively."""

    if is_dataclass(value) and not isinstance(value, type):
        normalized = {"node": type(value).__name__}
        for ast_field in fields(value):
            normalized[ast_field.name] = normalize_ast(
                getattr(value, ast_field.name)
            )
        return normalized

    if isinstance(value, Mapping):
        return {key: normalize_ast(item) for key, item in value.items()}

    if isinstance(value, list):
        return [normalize_ast(item) for item in value]

    if isinstance(value, tuple):
        return tuple(normalize_ast(item) for item in value)

    return value
