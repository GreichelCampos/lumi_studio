"""Run with ``python -m services.worker``, using UTF-8 JSON frames."""

from contextlib import redirect_stdout
import sys
import traceback
from typing import BinaryIO, Callable, TextIO
from uuid import uuid4

from .execution_service import InputCancelledError, InputUnavailableError

from .protocol.dispatcher import RequestDispatcher
from .protocol.errors import ProtocolError, error_response
from .protocol.models import MAX_REQUEST_BYTES, Response
from .protocol.serialization import ResponseTooLargeError, decode_request, encode_response


def _response_bytes(response: Response, log: TextIO) -> bytes:
    try:
        return encode_response(response)
    except (TypeError, ValueError, UnicodeError, RecursionError) as error:
        traceback.print_exc(file=log)
        code = "RESPONSE_TOO_LARGE" if isinstance(error, ResponseTooLargeError) else "SERIALIZATION_ERROR"
        fallback = error_response(
            code, "No se pudo serializar el resultado; consulte stderr.",
            kind="infrastructure", request_id=response["requestId"],
            operation=response["operation"],
        )
        return encode_response(fallback)


def _read_frame(source: BinaryIO) -> bytes:
    line = source.readline(MAX_REQUEST_BYTES + 1)
    if len(line) <= MAX_REQUEST_BYTES:
        return line
    tail = line
    while tail and not tail.endswith(b"\n"):
        tail = source.readline(MAX_REQUEST_BYTES + 1)
    return line


def _input_provider(source: BinaryIO, destination: BinaryIO, request_id: str) -> Callable[[str], str]:
    def read(prompt: str) -> str:
        input_id = uuid4().hex
        destination.write(encode_response({
            "type": "inputRequest", "requestId": request_id, "inputId": input_id,
            "prompt": prompt[:16_384],
        }))
        destination.flush()
        line = _read_frame(source)
        if not line:
            raise InputCancelledError()
        try:
            reply = decode_request(line)
        except ProtocolError as error:
            raise InputUnavailableError("La respuesta de entrada no es válida.") from error
        if (
            not isinstance(reply, dict)
            or reply.keys() != {"type", "requestId", "inputId", "value"}
            or reply["type"] != "inputReply"
            or reply["requestId"] != request_id
            or reply["inputId"] != input_id
        ):
            raise InputUnavailableError("La respuesta no corresponde a la solicitud de entrada.")
        value = reply["value"]
        if value is None:
            raise InputCancelledError()
        if not isinstance(value, str) or len(value) > 16_384:
            raise InputUnavailableError("La respuesta debe ser texto de hasta 16.384 caracteres.")
        return value
    return read


def run_worker(
    source: BinaryIO, destination: BinaryIO, log: TextIO,
    *, dispatcher: RequestDispatcher | None = None,
) -> None:
    handler = dispatcher if dispatcher is not None else RequestDispatcher(log=log)
    while line := _read_frame(source):
        if len(line) > MAX_REQUEST_BYTES:
            response: Response = error_response("REQUEST_TOO_LARGE", "Solicitud mayor que 1 MiB.")
        else:
            try:
                raw = decode_request(line)
            except ProtocolError as error:
                response = error_response(error.code, str(error))
            else:
                # Also contain accidental prints from dependencies or core code.
                with redirect_stdout(log):
                    if (
                        isinstance(raw, dict) and raw.get("interactiveInput") is True
                        and raw.get("operation") == "execute" and isinstance(raw.get("requestId"), str)
                    ):
                        request = {key: value for key, value in raw.items() if key != "interactiveInput"}
                        response = handler.dispatch(
                            request, input_provider=_input_provider(source, destination, raw["requestId"]),
                        )
                    else:
                        response = handler.dispatch(raw)
        destination.write(_response_bytes(response, log))
        destination.flush()


def main() -> int:
    try:
        run_worker(sys.stdin.buffer, sys.stdout.buffer, sys.stderr)
    except (OSError, ValueError):
        traceback.print_exc(file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
