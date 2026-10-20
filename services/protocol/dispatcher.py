"""Coordinate validated requests; log technical failures at the process boundary."""

import sys
import traceback
from typing import TextIO

from services.compiler_service import CompilerService
from services.execution_service import ExecutionService, InputUnavailableError

from .adapters import adapt_result
from .errors import ProtocolError, error_response
from .models import MAX_SESSION_REQUESTS, Response
from .scene_adapter import SceneAdapterError
from .validation import correlation, validate_request


class RequestDispatcher:
    """Single-threaded session; request IDs must be unique for its lifetime.

    The bounded session accepts at most 10,000 valid, distinct requests. A fresh
    worker starts a new session. There is no cancellation or execution cache.
    """

    def __init__(
        self, compiler: CompilerService | None = None,
        executor: ExecutionService | None = None, *, log: TextIO | None = None,
    ) -> None:
        self._compiler = compiler if compiler is not None else CompilerService()
        self._executor = executor if executor is not None else ExecutionService(self._compiler)
        self._log = log if log is not None else sys.stderr
        self._request_ids: set[str] = set()

    def dispatch(self, raw: object) -> Response:
        request_id, operation = correlation(raw)
        try:
            request = validate_request(raw)
            if request.request_id in self._request_ids:
                raise ProtocolError("DUPLICATE_REQUEST_ID", "requestId ya utilizado en esta sesión.")
            if len(self._request_ids) >= MAX_SESSION_REQUESTS:
                raise ProtocolError("SESSION_LIMIT_REACHED", "Inicie una nueva sesión del worker.")
        except ProtocolError as error:
            return error_response(error.code, str(error), request_id=request_id, operation=operation)

        self._request_ids.add(request.request_id)
        try:
            compilation = self._compiler.compile_project(request.files, entry_file=request.entry_file)
            execution = self._executor.execute(compilation) if request.operation == "execute" else None
            return adapt_result(request, compilation, execution)
        except InputUnavailableError:
            traceback.print_exc(file=self._log)
            return error_response(
                "INPUT_UNAVAILABLE", "La entrada interactiva no está disponible en este protocolo.",
                kind="infrastructure", request_id=request.request_id, operation=request.operation,
            )
        except SceneAdapterError as error:
            return error_response(
                "SERIALIZATION_ERROR",
                str(error),
                kind="infrastructure",
                request_id=request.request_id,
                operation=request.operation,
            )
        except Exception:
            # Deliberate final boundary: preserve the traceback on stderr, never
            # mislabel an unexpected service defect as a student's Diagnostic.
            traceback.print_exc(file=self._log)
            return error_response(
                "INTERNAL_ERROR", "Error interno al procesar la solicitud; consulte stderr.",
                kind="infrastructure", request_id=request.request_id, operation=request.operation,
            )
