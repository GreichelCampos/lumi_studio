"""Protocol failures are distinct from Lumi Diagnostic objects."""

from typing import Literal

from .models import (
    ErrorDetail, ErrorResponse, Operation, PROTOCOL_VERSION, ProtocolErrorCode,
)


class ProtocolError(ValueError):
    def __init__(self, code: ProtocolErrorCode, message: str) -> None:
        super().__init__(message)
        self.code = code


def error_response(
    code: str,
    message: str,
    *,
    kind: Literal["protocol", "infrastructure"] = "protocol",
    request_id: str | None = None,
    operation: Operation | None = None,
) -> ErrorResponse:
    detail: ErrorDetail = {
        "kind": kind,
        "code": code,
        "message": message,
    }
    return {
        "protocolVersion": PROTOCOL_VERSION,
        "requestId": request_id,
        "operation": operation,
        "status": "error",
        "error": detail,
    }
