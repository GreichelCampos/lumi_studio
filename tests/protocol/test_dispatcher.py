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
    assert result["result"]["capabilities"] == {
        "scenePlan": False,
        "debugTrace": True,
        "interactiveInput": False,
        "cancellation": False,
    }
    assert [
        step["eventType"] for step in result["result"]["debugSteps"]
    ] == ["start", "end"]
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


def test_complete_spatial_analysis_is_reported_without_execution():
    result = RequestDispatcher().dispatch(
        request("habitacion sala(5, 4, 2.7) {}", "analyze")
    )
    assert result["status"] == "completed"
    assert result["result"]["analysisStatus"] == "completed"
    assert result["result"]["limitations"] == []
    assert result["result"]["capabilities"]["scenePlan"] is False
    assert "scenePlan" not in result["result"]


@pytest.mark.parametrize(
    "source, code",
    [
        ("principal { habitacion sala(-7, 5, 3) {} }", "SPA_INVALID_DIMENSION"),
        ("principal { habitacion sala(faltante, 5, 3) {} }", "SEM_UNDECLARED_VARIABLE"),
        (
            "principal { habitacion sala(5, 4, 3) { piso uno {} piso dos {} } }",
            "SPA_MULTIPLE_FLOORS",
        ),
    ],
)
def test_secondary_entry_preserves_semantic_and_spatial_diagnostics(source, code):
    message = request("principal { habitacion principal(5, 4, 3) {} }", "analyze")
    message["entryFile"] = "pruebas.lumi"
    message["files"]["pruebas.lumi"] = source

    result = RequestDispatcher().dispatch(message)

    assert result["status"] == "failed"
    diagnostic = result["result"]["diagnostics"][0]
    assert diagnostic["code"] == code
    assert diagnostic["file"] == "pruebas.lumi"
    assert diagnostic["line"] == 1
    assert diagnostic["column"] >= 1


def test_switching_between_secondary_and_main_entry_preserves_project_sources():
    files = {
        "principal.lumi": "principal { habitacion sala_principal(5, 4, 3) {} }",
        "pruebas.lumi": "principal { habitacion sala(-7, 5, 3) {} }",
        "util.lumi": "funcion entero ancho() { retornar 5>> }",
    }
    secondary = request(operation="analyze", request_id="secondary-entry")
    secondary.update(entryFile="pruebas.lumi", files=files)
    main = request(operation="analyze", request_id="main-entry")
    main.update(entryFile="principal.lumi", files=files)

    secondary_result = RequestDispatcher().dispatch(secondary)
    main_result = RequestDispatcher().dispatch(main)

    assert secondary_result["status"] == "failed"
    assert secondary_result["result"]["diagnostics"][0]["code"] == "SPA_INVALID_DIMENSION"
    assert main_result["status"] == "completed"
    assert main_result["result"]["diagnostics"] == []


def test_secondary_entry_resolves_its_imports_from_the_complete_project_snapshot():
    message = request(operation="analyze")
    message.update(entryFile="pruebas.lumi", files={
        "principal.lumi": "principal { habitacion sala_principal(5, 4, 3) {} }",
        "pruebas.lumi": 'importar "util.lumi" usar ancho>> principal { habitacion sala(ancho(), 4, 3) {} }',
        "util.lumi": "funcion entero ancho() { retornar 5>> }",
    })

    result = RequestDispatcher().dispatch(message)

    assert result["status"] == "completed"
    assert result["result"]["diagnostics"] == []


def test_spatial_execution_publishes_validated_runtime_scene():
    result = RequestDispatcher().dispatch(
        request("habitacion sala(5, 4, 2.7) {}", "execute")
    )
    assert result["status"] == "completed"
    assert result["result"]["analysisStatus"] == "completed"
    assert result["result"]["limitations"] == []
    assert result["result"]["diagnostics"] == []
    assert result["result"]["capabilities"]["scenePlan"] is True
    assert result["result"]["scenePlan"]["rooms"][0]["name"] == "sala"


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


def test_indexed_furniture_in_loop_keeps_distinct_ids_and_shared_source():
    source = """principal {
  habitacion sala(12, 7, 3) {
    entero i = 0>>
    mientras i < 5 {
      silla fila[i] { color "rojo">> }
      colocar fila[i] [i * 2 - 4, 0, 0]>>
      i = i + 1>>
    }
    mover fila[0] [-4, 0, -2]>>
    rotar fila[4] [0, 90, 0]>>
  }
}
"""
    result = RequestDispatcher().dispatch(request(source))
    assert result["status"] == "completed"
    chairs = result["result"]["scenePlan"]["rooms"][0]["objects"]
    assert [chair["name"] for chair in chairs] == [f"fila[{i}]" for i in range(5)]
    assert len({chair["id"] for chair in chairs}) == 5
    assert {chair["sourceRef"]["line"] for chair in chairs} == {5}
    assert chairs[0]["position"] == [-4, 0, -2]
    assert chairs[4]["position"] == [4, 0, 0]
    assert chairs[4]["rotation"] == [0, 90, 0]


@pytest.mark.parametrize("index", ["-1", "1.0", "verdadero", '"texto"'])
def test_indexed_furniture_requires_nonnegative_integer(index):
    program = f"principal {{ habitacion sala(7, 5, 3) {{ silla fila[{index}] {{}} }} }}"
    result = RequestDispatcher().dispatch(request(program))
    assert result["status"] == "failed"
    assert result["result"]["diagnostics"][0]["code"] == "RUN_INVALID_SPATIAL_INDEX"
    assert "scenePlan" not in result["result"]


def test_indexed_furniture_does_not_overwrite_an_existing_index():
    source = "principal { habitacion sala(7, 5, 3) { silla fila[0] {} silla fila[0] {} } }"
    result = RequestDispatcher().dispatch(request(source))
    assert result["status"] == "blocked"
    assert result["result"]["diagnostics"][0]["code"] == "SPA_DUPLICATE_ELEMENT"
    assert "fila[0]" in result["result"]["diagnostics"][0]["description"]
    assert "scenePlan" not in result["result"]


def test_indexed_and_plain_furniture_names_can_coexist():
    source = """principal {
      habitacion sala(7, 5, 3) {
        silla fila {}
        silla fila[0] {}
        colocar fila [-2, 0, 0]>>
        colocar fila[0] [2, 0, 0]>>
      }
    }"""
    result = RequestDispatcher().dispatch(request(source))
    assert result["status"] == "completed"
    chairs = result["result"]["scenePlan"]["rooms"][0]["objects"]
    assert [(chair["name"], chair["position"]) for chair in chairs] == [
        ("fila", [-2, 0, 0]), ("fila[0]", [2, 0, 0]),
    ]

def test_imported_function_creates_and_moves_distinct_indexed_objects():
    entry = 'importar "sala.lumi" usar crearSala>> principal { crearSala()>> }'
    module = """funcion vacio crearSala() {
      habitacion sala(12, 7, 3) {
        entero i = 0>>
        mientras i < 5 {
          silla fila[i] {}
          colocar fila[i] [i * 2 - 4, 0, 0]>>
          i = i + 1>>
        }
        mover fila[0] [-4, 0, -2]>>
        rotar fila[4] [0, 90, 0]>>
      }
    }"""
    data = request(entry)
    data["files"]["sala.lumi"] = module
    result = RequestDispatcher().dispatch(data)
    assert result["status"] == "completed"
    chairs = result["result"]["scenePlan"]["rooms"][0]["objects"]
    assert [chair["name"] for chair in chairs] == [f"fila[{i}]" for i in range(5)]
    assert {chair["sourceRef"]["file"] for chair in chairs} == {"sala.lumi"}
    assert chairs[0]["position"] == [-4, 0, -2]
    assert chairs[4]["rotation"] == [0, 90, 0]


def test_dynamic_furniture_index_preserves_unrelated_missing_element_check():
    source = """principal {
      habitacion sala(7, 5, 3) {
        entero i = 0>>
        silla fila[i] {}
        colocar faltante [0, 0, 0]>>
      }
    }"""
    result = RequestDispatcher().dispatch(request(source))
    assert result["status"] == "blocked"
    assert "faltante" in result["result"]["diagnostics"][0]["description"]


def test_infinite_recursion_reports_the_call_and_discards_the_scene():
    source = """funcion vacio ciclo() {
  ciclo()>>
}
principal {
  habitacion sala(6, 5, 3) {}
  ciclo()>>
}"""
    result = RequestDispatcher().dispatch(request(source))
    assert result["status"] == "failed"
    diagnostic, = result["result"]["diagnostics"]
    assert diagnostic["code"] == "RUN_CALL_DEPTH_EXCEEDED"
    assert diagnostic["category"] == "RUNTIME"
    assert (diagnostic["file"], diagnostic["line"], diagnostic["column"]) == ("principal.lumi", 2, 3)
    assert "ciclo" in diagnostic["description"]
    assert "caso base" in diagnostic["suggestion"]
    assert "scenePlan" not in result["result"]


def test_mutual_recursion_with_a_base_case_can_complete_at_the_limit():
    source = """funcion entero a(entero n) {
      si n == 0 { retornar 7>> }
      retornar b(n - 1)>>
    }
    funcion entero b(entero n) {
      si n == 0 { retornar 7>> }
      retornar a(n - 1)>>
    }
    principal { mostrar(a(63))>> mostrar(b(2))>> }"""
    result = RequestDispatcher().dispatch(request(source))
    assert result["status"] == "completed"
    assert result["result"]["output"] == ["7", "7"]


@pytest.mark.parametrize(("expression", "code"), [
    ("(" * 300 + "1" + ")" * 300, "SYN_PROGRAM_TOO_DEEP"),
    ("+".join(["1"] * 1600), "SYN_PROGRAM_TOO_DEEP"),
    ("9" * 4500, "SYN_INTEGER_LITERAL_TOO_LONG"),
])
def test_extreme_source_inputs_return_source_diagnostics(expression, code):
    result = RequestDispatcher().dispatch(request(f"mostrar({expression})>>"))
    assert result["status"] == "blocked"
    diagnostic = result["result"]["diagnostics"][0]
    assert diagnostic["code"] == code
    assert diagnostic["file"] == "principal.lumi"
    assert diagnostic["suggestion"]
