"""Validate message shape and budgets, preserving exact in-memory file identities."""

from typing import cast

from .errors import ProtocolError
from .models import (
    MAX_FILES, MAX_REQUEST_ID_BYTES, MAX_SOURCE_BYTES, Operation, PROTOCOL_VERSION,
    Request,
)


def _text(
    value: object, field: str, *, max_bytes: int,
    allow_empty: bool = False, allow_nul: bool = False,
) -> str:
    if not isinstance(value, str) or (not value and not allow_empty):
        raise ProtocolError("INVALID_REQUEST", f"{field} debe ser texto válido.")
    try:
        size = len(value.encode("utf-8"))
    except UnicodeEncodeError as error:
        raise ProtocolError("INVALID_REQUEST", f"{field} contiene Unicode inválido.") from error
    if size > max_bytes or ("\0" in value and not allow_nul):
        raise ProtocolError("INVALID_REQUEST", f"{field} excede el límite o contiene NUL.")
    return value


def correlation(raw: object) -> tuple[str | None, Operation | None]:
    """Echo only usable correlation fields, even if the rest of the request fails."""
    if not isinstance(raw, dict):
        return None, None
    try:
        request_id = _text(raw.get("requestId"), "requestId", max_bytes=MAX_REQUEST_ID_BYTES)
    except ProtocolError:
        request_id = None
    operation = raw.get("operation")
    return request_id, cast(Operation, operation) if operation in ("analyze", "execute") else None


def validate_request(raw: object) -> Request:
    if not isinstance(raw, dict):
        raise ProtocolError("INVALID_REQUEST", "La solicitud debe ser un objeto JSON.")
    required = {"protocolVersion", "requestId", "operation", "entryFile", "files"}
    if set(raw) != required:
        raise ProtocolError("INVALID_REQUEST", "Campos de solicitud ausentes o desconocidos.")
    if raw["protocolVersion"] != PROTOCOL_VERSION:
        raise ProtocolError("UNSUPPORTED_VERSION", "Versión del protocolo no compatible.")
    request_id = _text(raw["requestId"], "requestId", max_bytes=MAX_REQUEST_ID_BYTES)
    operation = raw["operation"]
    if operation not in ("analyze", "execute"):
        raise ProtocolError("UNKNOWN_OPERATION", "Operación no disponible.")
    entry = _text(raw["entryFile"], "entryFile", max_bytes=1024)
    files = raw["files"]
    if not isinstance(files, dict) or not 1 <= len(files) <= MAX_FILES:
        raise ProtocolError("INVALID_REQUEST", "files debe contener entre 1 y 128 fuentes.")
    sources: dict[str, str] = {}
    for file, content in files.items():
        name = _text(file, "files.key", max_bytes=1024)
        sources[name] = _text(
            content, "files.content", max_bytes=MAX_SOURCE_BYTES,
            allow_empty=True, allow_nul=True,
        )
    if entry not in sources:
        raise ProtocolError("INVALID_REQUEST", "El archivo principal no está en files.")
    return Request(request_id, cast(Operation, operation), entry, sources)
