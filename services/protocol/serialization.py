"""Strict UTF-8 JSON codec; duplicate keys and non-standard numeric values are rejected."""

import json

from .errors import ProtocolError
from .models import MAX_JSON_DEPTH, MAX_REQUEST_BYTES, MAX_RESPONSE_BYTES, Response


class ResponseTooLargeError(ValueError):
    pass


def _unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ProtocolError("MALFORMED_JSON", "JSON con claves duplicadas.")
        result[key] = value
    return result


def _invalid_constant(value: str) -> None:
    raise ProtocolError("MALFORMED_JSON", "JSON contiene un número no estándar.")


def _check_depth(raw: object) -> None:
    pending: list[tuple[object, int]] = [(raw, 0)]
    while pending:
        value, depth = pending.pop()
        if depth > MAX_JSON_DEPTH:
            raise ProtocolError("MALFORMED_JSON", "JSON excede la profundidad máxima de 64.")
        if isinstance(value, dict):
            pending.extend((item, depth + 1) for item in value.values())
        elif isinstance(value, list):
            pending.extend((item, depth + 1) for item in value)


def decode_request(data: bytes) -> object:
    if len(data) > MAX_REQUEST_BYTES:
        raise ProtocolError("REQUEST_TOO_LARGE", "Solicitud mayor que 1 MiB.")
    try:
        text = data.decode("utf-8", errors="strict")
    except UnicodeDecodeError as error:
        raise ProtocolError("INVALID_UTF8", "La solicitud no es UTF-8 válido.") from error
    try:
        raw = json.loads(text, object_pairs_hook=_unique_object, parse_constant=_invalid_constant)
    except ProtocolError:
        raise
    except (ValueError, RecursionError) as error:
        # json.loads can also raise ValueError for excessive integer digits.
        raise ProtocolError("MALFORMED_JSON", "No se pudo interpretar el mensaje JSON.") from error
    _check_depth(raw)
    return raw


def encode_response(response: Response) -> bytes:
    data = (json.dumps(response, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n").encode("utf-8")
    if len(data) > MAX_RESPONSE_BYTES:
        raise ResponseTooLargeError("La respuesta excede 4 MiB.")
    return data
