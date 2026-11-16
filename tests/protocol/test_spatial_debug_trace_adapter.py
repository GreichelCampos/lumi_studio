import json

from lumi_language.interpreter import Interpreter
from services.execution_service import ExecutionService
from services.protocol import adapters as protocol_adapters
from services.protocol.debug_trace_adapter import adapt_spatial_debug_trace
from services.protocol.dispatcher import RequestDispatcher
from services.protocol.serialization import response_size_bytes


def entry_program(source: str) -> str:
    if "principal" in source:
        return source
    return f"principal {{ {source} }}"


def request(files, *, operation="execute", entry="principal.lumi"):
    normalized = dict(files)
    normalized[entry] = entry_program(normalized[entry])
    return {
        "protocolVersion": "1.0.0",
        "requestId": f"trace-{operation}",
        "operation": operation,
        "entryFile": entry,
        "files": normalized,
    }


def test_converts_complete_trace_to_frontend_debug_step_contract():
    source = """principal { habitacion sala(10, 10, 3) {
    silla silla1 { }
    colocar silla1 [1, 0, 1]>>
    mover silla1 [2, 0, 2]>>
    rotar silla1 [0, 90, 0]>>
} }"""
    execution = ExecutionService().execute_source(source, "principal.lumi")
    original_snapshot = execution.spatial_trace.steps[3].scene_snapshot

    adapted = adapt_spatial_debug_trace(
        execution.spatial_trace, {"principal.lumi": source}
    )

    assert adapted.available
    assert adapted.unavailable_reason is None
    assert [step["eventType"] for step in adapted.debug_steps] == [
        "start",
        "room_create",
        "declaration",
        "place_object",
        "move_object",
        "rotate_object",
        "end",
    ]
    assert [step["stepIndex"] for step in adapted.debug_steps] == list(range(7))
    assert [step["id"] for step in adapted.debug_steps] == [
        f"step-{index}" for index in range(7)
    ]
    declaration, placement = adapted.debug_steps[2:4]
    assert declaration["roomId"] == placement["roomId"]
    assert declaration["activeObjectId"] == placement["activeObjectId"]
    assert declaration["spatialState"] == {
        "element_kind": "object",
        "object_type": "silla",
    }
    assert placement["sourceRef"] == {
        "file": "principal.lumi",
        "line": 3,
        "column": 5,
    }
    assert placement["lineNumber"] == 3
    assert placement["codeLine"] == "    colocar silla1 [1, 0, 1]>>"
    assert placement["actionDescription"] == placement["description"]
    assert placement["sceneSnapshot"]["rooms"][0]["objects"][0][
        "position"
    ] == [1, 0, 1]
    assert execution.spatial_trace.steps[3].scene_snapshot == original_snapshot
    assert adapted.debug_steps[-1]["sceneSnapshot"] == adapted.debug_steps[-2][
        "sceneSnapshot"
    ]
    json.dumps(adapted.debug_steps, ensure_ascii=False, allow_nan=False)


def test_uses_imported_source_for_code_line_and_location():
    files = {
        "principal.lumi": (
            'importar "operaciones.lumi" usar ubicar>>\n'
            "principal { habitacion sala(8, 8, 3) {\n"
            "    silla silla1 { }\n"
            "    ubicar()>>\n"
            "} }"
        ),
        "operaciones.lumi": (
            "funcion vacio ubicar() {\n"
            "    colocar silla1 [1, 0, 1]>>\n"
            "}"
        ),
    }
    execution = ExecutionService().execute_source(
        files["principal.lumi"],
        "principal.lumi",
        sources={"operaciones.lumi": files["operaciones.lumi"]},
    )

    adapted = adapt_spatial_debug_trace(execution.spatial_trace, files)

    placement = next(
        step for step in adapted.debug_steps if step["eventType"] == "place_object"
    )
    assert placement["sourceRef"]["file"] == "operaciones.lumi"
    assert placement["sourceRef"]["line"] == 2
    assert placement["codeLine"] == "    colocar silla1 [1, 0, 1]>>"


def test_preserves_unicode_in_code_lines_and_serialized_size():
    source = 'principal { habitacion sala(8, 8, 3) { silla silla1 { color "café ☕">> } } }'
    execution = ExecutionService().execute_source(source, "unicode.lumi")

    adapted = adapt_spatial_debug_trace(
        execution.spatial_trace, {"unicode.lumi": source}
    )

    declaration = next(
        step for step in adapted.debug_steps if step["eventType"] == "declaration"
    )
    assert "café ☕" in declaration["codeLine"]
    encoded = json.dumps(
        {"debugSteps": list(adapted.debug_steps)},
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
    ).encode("utf-8")
    assert adapted.serialized_size_bytes == len(encoded)


def test_incomplete_runtime_trace_keeps_its_unavailability_reason():
    execution = ExecutionService().execute_source(
        entry_program("mostrar(1 / 0)>>"), "principal.lumi"
    )

    adapted = adapt_spatial_debug_trace(
        execution.spatial_trace, {"principal.lumi": "mostrar(1 / 0)>>"}
    )

    assert not adapted.available
    assert adapted.debug_steps == ()
    assert adapted.unavailable_reason == "execution_failed"


def test_step_limit_trace_is_not_converted_as_complete():
    source = entry_program(
        "habitacion sala(8, 8, 3) { silla silla1 { } "
        "colocar silla1 [1, 0, 1]>> }"
    )
    service = ExecutionService(
        interpreter_factory=lambda: Interpreter(max_spatial_trace_steps=3)
    )
    execution = service.execute_source(source, "principal.lumi")

    adapted = adapt_spatial_debug_trace(
        execution.spatial_trace, {"principal.lumi": source}
    )

    assert execution.succeeded
    assert not adapted.available
    assert adapted.debug_steps == ()
    assert adapted.unavailable_reason == "step_limit_exceeded"


def test_missing_source_returns_explicit_unavailability():
    source = entry_program("habitacion sala(8, 8, 3) { }")
    execution = ExecutionService().execute_source(source, "principal.lumi")

    adapted = adapt_spatial_debug_trace(execution.spatial_trace, {})

    assert not adapted.available
    assert adapted.unavailable_reason == "source_unavailable:principal.lumi:1"


def test_response_size_budget_rejects_whole_trace_without_truncation():
    source = entry_program("habitacion sala(8, 8, 3) { silla silla1 { } }")
    execution = ExecutionService().execute_source(source, "principal.lumi")
    sources = {"principal.lumi": source}
    complete = adapt_spatial_debug_trace(execution.spatial_trace, sources)

    exact = adapt_spatial_debug_trace(
        execution.spatial_trace,
        sources,
        available_bytes=complete.serialized_size_bytes,
    )
    too_large = adapt_spatial_debug_trace(
        execution.spatial_trace,
        sources,
        available_bytes=complete.serialized_size_bytes - 1,
    )

    assert exact.available
    assert not too_large.available
    assert too_large.debug_steps == ()
    assert too_large.unavailable_reason == "response_size_exceeded"


def test_public_f5_remains_without_trace_and_f6_publishes_real_steps():
    files = {"principal.lumi": entry_program("habitacion sala(8, 8, 3) { }")}
    dispatcher = RequestDispatcher()

    analysis = dispatcher.dispatch(request(files, operation="analyze"))
    execution_request = request(files)
    execution_request["requestId"] = "trace-execute"
    execution = dispatcher.dispatch(execution_request)

    assert analysis["status"] == "completed"
    assert analysis["result"]["capabilities"]["debugTrace"] is False
    assert "debugSteps" not in analysis["result"]
    assert execution["status"] == "completed"
    assert execution["result"]["capabilities"]["scenePlan"] is True
    assert execution["result"]["capabilities"]["debugTrace"] is True
    assert [
        step["eventType"] for step in execution["result"]["debugSteps"]
    ] == ["start", "room_create", "end"]


def test_public_failed_and_step_limited_runs_publish_no_partial_steps():
    failed = RequestDispatcher().dispatch(
        request({"principal.lumi": entry_program("mostrar(1 / 0)>>")})
    )
    limited_dispatcher = RequestDispatcher(
        executor=ExecutionService(
            interpreter_factory=lambda: Interpreter(max_spatial_trace_steps=2)
        )
    )
    limited_request = request(
        {"principal.lumi": entry_program("habitacion sala(8, 8, 3) { }")}
    )
    limited_request["requestId"] = "trace-limited"
    limited = limited_dispatcher.dispatch(limited_request)

    assert failed["status"] == "failed"
    assert failed["result"]["capabilities"]["debugTrace"] is False
    assert failed["result"]["debugTraceUnavailableReason"] == "execution_failed"
    assert "debugSteps" not in failed["result"]
    assert limited["status"] == "completed"
    assert limited["result"]["capabilities"]["debugTrace"] is False
    assert limited["result"]["debugTraceUnavailableReason"] == (
        "step_limit_exceeded"
    )
    assert "debugSteps" not in limited["result"]
    assert limited["result"]["scenePlan"]["rooms"][0]["name"] == "sala"


def test_public_import_trace_keeps_module_source_and_unicode():
    files = {
        "principal.lumi": (
            'importar "acciones.lumi" usar ubicar>>\n'
            "principal { habitacion sala(8, 8, 3) { silla silla1 { } ubicar()>> } }"
        ),
        "acciones.lumi": (
            "funcion vacio ubicar() {\n"
            '    mostrar("café ☕")>> colocar silla1 [1, 0, 1]>>\n'
            "}"
        ),
    }

    response = RequestDispatcher().dispatch(request(files))

    placement = next(
        step
        for step in response["result"]["debugSteps"]
        if step["eventType"] == "place_object"
    )
    assert placement["sourceRef"]["file"] == "acciones.lumi"
    assert 'mostrar("café ☕")' in placement["codeLine"]


def test_full_response_budget_disables_trace_but_preserves_execution(
    monkeypatch,
):
    files = {
        "principal.lumi": (
            "principal { habitacion sala(8, 8, 3) { silla silla1 { } "
            "colocar silla1 [1, 0, 1]>> } }"
        )
    }
    full = RequestDispatcher().dispatch(request(files))
    full_size = response_size_bytes(full)
    monkeypatch.setattr(protocol_adapters, "MAX_RESPONSE_BYTES", full_size - 16)
    retry = request(files)
    retry["requestId"] = "trace-budget"

    response = RequestDispatcher().dispatch(retry)

    assert response["status"] == "completed"
    assert response["result"]["capabilities"]["scenePlan"] is True
    assert response["result"]["capabilities"]["debugTrace"] is False
    assert response["result"]["debugTraceUnavailableReason"] == (
        "response_size_exceeded"
    )
    assert "debugSteps" not in response["result"]
    assert response_size_bytes(response) < full_size - 16
