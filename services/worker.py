"""Run with ``python -m services.worker``: one UTF-8 JSON response per input line."""

from contextlib import redirect_stdout
import sys
import traceback
from typing import BinaryIO, TextIO

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


def run_worker(
    source: BinaryIO, destination: BinaryIO, log: TextIO,
    *, dispatcher: RequestDispatcher | None = None,
) -> None:
    handler = dispatcher if dispatcher is not None else RequestDispatcher(log=log)
    while line := source.readline(MAX_REQUEST_BYTES + 1):
        if len(line) > MAX_REQUEST_BYTES:
            # Discard this entire frame with bounded reads before accepting another.
            while not line.endswith(b"\n"):
                line = source.readline(MAX_REQUEST_BYTES + 1)
                if not line:
                    break
            response: Response = error_response("REQUEST_TOO_LARGE", "Solicitud mayor que 1 MiB.")
        else:
            try:
                raw = decode_request(line)
            except ProtocolError as error:
                response = error_response(error.code, str(error))
            else:
                # Also contain accidental prints from dependencies or core code.
                with redirect_stdout(log):
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
