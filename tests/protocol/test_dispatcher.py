"""Real service integration and protocol validation, without a UI."""

from copy import deepcopy
from io import StringIO

import pytest

from services.compiler_service import CompilerService
from services.protocol.dispatcher import RequestDispatcher
from services.protocol.models import MAX_FILES, MAX_SESSION_REQUESTS, MAX_SOURCE_BYTES


def request(source='mostrar("¡Hola, Lumi! 🏠")>>', operation="execute", request_id="test-1"):
    return {
        "protocolVersion": "1.0.0", "requestId": request_id, "operation": operation,
        "entryFile": "principal.lumi", "files": {"principal.lumi": source},
    }


def test_execute_preserves_unicode_and_output_order():
    result = RequestDispatcher().dispatch(request('mostrar("¡Hola, Lumi! 🏠")>> mostrar(2)>>'))
    assert result["status"] == "completed"
    assert result["requestId"] == "test-1"
    assert result["result"]["output"] == ["¡Hola, Lumi! 🏠", "2"]
    assert result["result"]["executionAttempted"] is True
    assert all(value is False for value in result["result"]["capabilities"].values())
    assert "scenePlan" not in result["result"]


def test_analysis_does_not_execute_input_or_output():
    result = RequestDispatcher().dispatch(request('texto nombre = leer("Nombre:")>>', "analyze"))
    assert result["status"] == "completed"
    assert result["result"]["executionAttempted"] is False
    assert result["result"]["output"] == []


@pytest.mark.parametrize("operation, expected", [("analyze", "failed"), ("execute", "blocked")])
@pytest.mark.parametrize("source", ["@", "\0"], ids=["invalid-symbol", "nul-in-source"])
def test_lexical_error_is_unstructured_without_invented_location(operation, expected, source):
    result = RequestDispatcher().dispatch(request(source, operation))
    assert result["status"] == expected
    assert result["result"]["stage"] == "lexical"
    assert "carácter inválido" in result["result"]["lexicalError"]
    assert result["result"]["diagnostics"] == []


@pytest.mark.parametrize(
    "source, category, stage, status",
    [
        ("entero valor =", "SYNTACTIC", "syntactic", "blocked"),
        ('entero valor = "texto">>', "SEMANTIC", "semantic", "blocked"),
        ("mostrar(4 / 0)>>", "RUNTIME", "semantic", "failed"),
    ],
)
def test_core_diagnostics_are_preserved_exactly(source, category, stage, status):
    result = RequestDispatcher().dispatch(request(source))
    assert result["status"] == status
    payload = result["result"]
    assert payload["stage"] == stage
    diagnostic = payload["diagnostics"][0]
    assert diagnostic["category"] == category
    assert diagnostic["file"] == "principal.lumi"
    assert diagnostic["line"] == 1
    assert diagnostic["column"] >= 1
    assert "severity" not in diagnostic
    assert "targetObjectId" not in diagnostic
    if category == "RUNTIME":
        assert diagnostic["code"] == "RUN_DIVISION_BY_ZERO"
        assert diagnostic["column"] == 9


def test_imports_and_explicit_entry_use_real_services():
    message = request('importar "util.lumi" usar sumar>> mostrar(sumar(4, 5))>>')
    message["files"]["util.lumi"] = "funcion entero sumar(entero a, entero b) { retornar a + b>> }"
    message["files"]["activo.lumi"] = "@"
    original = deepcopy(message)
    result = RequestDispatcher().dispatch(message)
    assert result["status"] == "completed"
    assert result["result"]["output"] == ["9"]
    assert message == original


@pytest.mark.parametrize(
    "operation, expected",
    [("analyze", "incomplete"), ("execute", "incomplete")],
)
def test_spatial_capability_is_not_simulated(operation, expected):
    result = RequestDispatcher().dispatch(request("habitacion sala(5, 4, 2.7) {}", operation))
    assert result["status"] == expected
    assert result["result"]["analysisStatus"] == "incomplete"
    assert result["result"]["limitations"] == ["spatial_semantics_unavailable"]
    if operation == "execute":
        assert result["result"]["diagnostics"] == []


def test_input_error_is_infrastructure_and_does_not_read_protocol_stdin():
    log = StringIO()
    result = RequestDispatcher(log=log).dispatch(request('texto nombre = leer("Nombre:")>>'))
    assert result["status"] == "error"
    assert result["error"]["kind"] == "infrastructure"
    assert result["error"]["code"] == "INPUT_UNAVAILABLE"
    assert "InputUnavailableError" in log.getvalue()
    assert "result" not in result


def test_unexpected_service_error_is_logged_and_worker_can_recover():
    class FailingOnce(CompilerService):
        def __init__(self):
            self.failed = False

        def compile_project(self, sources, *, entry_file):
            if not self.failed:
                self.failed = True
                raise OSError("detalle técnico original")
            return super().compile_project(sources, entry_file=entry_file)

    log = StringIO()
    dispatcher = RequestDispatcher(FailingOnce(), log=log)
    first = dispatcher.dispatch(request())
    second = dispatcher.dispatch(request(request_id="test-2"))
    assert first["error"]["kind"] == "infrastructure"
    assert first["error"]["code"] == "INTERNAL_ERROR"
    assert "detalle técnico original" in log.getvalue()
    assert "detalle técnico original" not in first["error"]["message"]
    assert second["status"] == "completed"


@pytest.mark.parametrize(
    "field, value, code",
    [
        ("protocolVersion", "2.0.0", "UNSUPPORTED_VERSION"),
        ("operation", "cancel", "UNKNOWN_OPERATION"),
        ("operation", {}, "UNKNOWN_OPERATION"),
        ("requestId", "", "INVALID_REQUEST"),
        ("requestId", "é" * 65, "INVALID_REQUEST"),
        ("entryFile", "ausente.lumi", "INVALID_REQUEST"),
        ("files", [], "INVALID_REQUEST"),
        ("files", {"principal.lumi": None}, "INVALID_REQUEST"),
        ("files", {"principal.lumi": "a" * (MAX_SOURCE_BYTES + 1)}, "INVALID_REQUEST"),
        ("files", {f"{i}.lumi": "" for i in range(MAX_FILES + 1)}, "INVALID_REQUEST"),
        ("files", {"principal.lumi": "\ud800"}, "INVALID_REQUEST"),
    ],
)
def test_invalid_protocol_fields_are_rejected(field, value, code):
    message = request()
    message[field] = value
    result = RequestDispatcher().dispatch(message)
    assert result["status"] == "error"
    assert result["error"]["kind"] == "protocol"
    assert result["error"]["code"] == code


@pytest.mark.parametrize("message", [None, [], {}, {"command": "whoami"}])
def test_invalid_shapes_and_system_commands_are_not_executed(message):
    result = RequestDispatcher().dispatch(message)
    assert result["error"]["code"] == "INVALID_REQUEST"


def test_duplicate_ids_do_not_reexecute_and_session_state_is_bounded():
    dispatcher = RequestDispatcher()
    assert dispatcher.dispatch(request())["status"] == "completed"
    duplicate = dispatcher.dispatch(request())
    assert duplicate["error"]["code"] == "DUPLICATE_REQUEST_ID"
    dispatcher._request_ids = {str(i) for i in range(MAX_SESSION_REQUESTS)}
    assert dispatcher.dispatch(request(request_id="new"))["error"]["code"] == "SESSION_LIMIT_REACHED"
