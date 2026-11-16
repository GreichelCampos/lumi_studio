"""Execution facade tests using the real interpreter and source pipeline."""

import pytest

from lumi_language.diagnostics import DiagnosticCategory
from lumi_language.interpreter import Interpreter
from services.compiler_service import CompilerService
from services.execution_service import ExecutionService, InputUnavailableError
from services.results import CompilationStatus, ExecutionStatus


def test_valid_program_runs_and_keeps_output_order():
    result = ExecutionService().execute_source(
        'principal { mostrar("primero")>> mostrar(2)>> mostrar("tercero")>> }',
        "principal.lumi",
    )

    assert result.succeeded
    assert result.execution_attempted
    assert result.output == ("primero", "2", "tercero")
    assert result.diagnostics == ()


def test_existing_analysis_is_reused_without_recompilation():
    class CompileForbidden(CompilerService):
        def compile(self, *args, **kwargs):
            pytest.fail("No debe recompilar un resultado ya analizado")

    compilation = CompilerService().compile("mostrar(42)>>", "principal.lumi")
    result = ExecutionService(CompileForbidden()).execute(compilation)

    assert result.compilation is compilation
    assert result.output == ("42",)
    assert result.succeeded


@pytest.mark.parametrize("source", ["@", "entero valor =", 'entero valor = "texto">>'])
def test_analysis_failures_block_runtime_creation(source):
    def unexpected_runtime():
        pytest.fail("No debe crear un intérprete con errores previos")

    service = ExecutionService(interpreter_factory=unexpected_runtime)
    result = service.execute_source(source, "principal.lumi")

    assert result.status == ExecutionStatus.BLOCKED
    assert not result.succeeded
    assert not result.execution_attempted
    assert result.output == ()
    assert result.diagnostics == result.compilation.diagnostics
    assert result.compilation.status == CompilationStatus.FAILED


def test_runtime_error_preserves_output_and_original_diagnostic():
    compilation = CompilerService().compile(
        'mostrar("antes")>>\nmostrar(4 / 0)>>\nmostrar("después")>>',
        "principal.lumi",
    )
    original = Interpreter().execute(compilation.program)
    result = ExecutionService().execute(compilation)

    assert result.status == ExecutionStatus.FAILED
    assert result.execution_attempted
    assert result.output == ("antes",)
    assert result.diagnostics == tuple(original.diagnostics)
    diagnostic = result.diagnostics[0]
    assert diagnostic.category == DiagnosticCategory.RUNTIME
    assert diagnostic.code == "RUN_DIVISION_BY_ZERO"
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "principal.lumi", 2, 9,
    )


def test_project_import_runs_the_explicit_entry():
    compilation = CompilerService().compile_project(
        {
            "activo.lumi": "@",
            "principal.lumi": (
                'importar "utilidades.lumi" usar sumar>> mostrar(sumar(4, 5))>>'
            ),
            "utilidades.lumi": (
                "funcion entero sumar(entero a, entero b) { retornar a + b>> }"
            ),
        },
        entry_file="principal.lumi",
    )
    result = ExecutionService().execute(compilation)

    assert result.succeeded
    assert result.output == ("9",)


def test_imported_runtime_error_keeps_imported_file_location():
    result = ExecutionService().execute_source(
        'importar "roto.lumi" usar dividir>> mostrar(dividir())>>',
        "principal.lumi",
        sources={"roto.lumi": "funcion decimal dividir() { retornar 4 / 0>> }"},
    )

    assert result.status == ExecutionStatus.FAILED
    assert result.diagnostics[0].code == "RUN_DIVISION_BY_ZERO"
    assert result.diagnostics[0].file == "roto.lumi"


def test_room_execution_publishes_runtime_scene_after_complete_analysis():
    result = ExecutionService().execute_source(
        "habitacion sala(5, 4, 2.7) {}", "principal.lumi"
    )

    assert result.compilation.status == CompilationStatus.COMPLETED
    assert result.compilation.limitations == ()
    assert result.status == ExecutionStatus.COMPLETED
    assert result.succeeded
    assert result.diagnostics == ()
    assert result.scene_plan is not None
    assert result.scene_plan.rooms[0].name == "sala"


def test_optional_spatial_failure_is_decided_by_the_executed_route():
    skipped = ExecutionService().execute_source(
        "habitacion sala(5, 4, 3) { si falso { "
        "mover fantasma [0, 0, 0]>> } }",
        "principal.lumi",
    )
    executed = ExecutionService().execute_source(
        "habitacion sala(5, 4, 3) { si verdadero { "
        "mover fantasma [0, 0, 0]>> } }",
        "principal.lumi",
    )

    assert skipped.compilation.status == CompilationStatus.INCOMPLETE
    assert skipped.status == ExecutionStatus.COMPLETED
    assert skipped.scene_plan is not None
    assert executed.compilation.status == CompilationStatus.INCOMPLETE
    assert executed.status == ExecutionStatus.FAILED
    assert [item.code for item in executed.diagnostics] == [
        "RUN_SPATIAL_OPERATION_FAILED",
    ]


def test_execution_result_preserves_reserved_spatial_elements():
    result = ExecutionService().execute_source(
        'habitacion sala(5, 4, 3) { piso suelo { material "madera">> } '
        'pared norte { orientacion "norte">> color "blanco">> } '
        'puerta entrada { orientacion "norte">> ancho 0.9>> alto 2.1>> '
        'desplazamiento 0.5>> material "metal">> } '
        'ventana ventanal { orientacion "sur">> ancho 1.2>> alto 1>> '
        'desplazamiento 1.5>> elevacion 0.9>> color "azul">> } }',
        "principal.lumi",
    )

    assert result.status == ExecutionStatus.COMPLETED
    assert result.scene_plan is not None
    assert tuple(
        (element.name, element.element_kind)
        for element in result.scene_plan.rooms[0].elements
    ) == (
        ("suelo", "floor"),
        ("norte", "wall"),
        ("entrada", "door"),
        ("ventanal", "window"),
    )


def test_execution_is_blocked_by_statically_invalid_spatial_scene():
    result = ExecutionService().execute_source(
        "habitacion invalida(0, 4, 3) { }",
        "principal.lumi",
    )

    assert result.status == ExecutionStatus.BLOCKED
    assert not result.execution_attempted
    assert result.scene_plan is None
    assert result.diagnostics[0].category == DiagnosticCategory.SPATIAL
    assert result.diagnostics[0].code == "SPA_INVALID_DIMENSION"


def test_dynamic_invalid_dimension_remains_a_runtime_validation():
    result = ExecutionService().execute_source(
        "entero ancho = 0>> habitacion invalida(ancho, 4, 3) { }",
        "principal.lumi",
    )

    assert result.compilation.status == CompilationStatus.COMPLETED
    assert result.status == ExecutionStatus.FAILED
    assert result.execution_attempted
    assert result.scene_plan is None
    assert [item.code for item in result.diagnostics] == [
        "SPA_INVALID_DIMENSION"
    ]


def test_uncalled_spatial_function_does_not_create_analysis_limitation():
    result = ExecutionService().execute_source(
        "funcion vacio crear() { habitacion sala(5, 4, 2.7) {} } mostrar(1)>>",
        "principal.lumi",
    )

    assert result.compilation.status == CompilationStatus.COMPLETED
    assert result.compilation.limitations == ()
    assert result.status == ExecutionStatus.COMPLETED
    assert result.execution_attempted
    assert result.succeeded
    assert result.output == ("1",)
    assert result.diagnostics == ()
    assert result.scene_plan is not None
    assert result.scene_plan.rooms == ()


def test_injected_input_provider_is_only_used_during_execution():
    prompts = []

    def provide_input(prompt):
        prompts.append(prompt)
        return "Lumi"

    compilation = CompilerService().compile(
        'texto nombre = leer("Nombre:")>> mostrar(nombre)>>', "principal.lumi"
    )
    assert prompts == []
    result = ExecutionService(
        interpreter_factory=lambda: Interpreter(input_provider=provide_input)
    ).execute(compilation)

    assert result.succeeded
    assert prompts == ["Nombre:"]
    assert result.output == ("Lumi",)


def test_missing_host_input_does_not_block_on_stdin_or_invent_a_diagnostic():
    with pytest.raises(InputUnavailableError):
        ExecutionService().execute_source(
            'texto nombre = leer("Nombre:")>>', "principal.lumi"
        )


def test_input_infrastructure_error_propagates_unchanged():
    failure = OSError("proveedor de entrada desconectado")

    def disconnected_input(prompt):
        raise failure

    service = ExecutionService(
        interpreter_factory=lambda: Interpreter(input_provider=disconnected_input)
    )
    with pytest.raises(OSError) as raised:
        service.execute_source('texto nombre = leer("Nombre:")>>', "principal.lumi")
    assert raised.value is failure


def test_runtime_factory_failure_is_not_a_student_error():
    failure = RuntimeError("no se pudo iniciar el runtime")

    def unavailable_runtime():
        raise failure

    with pytest.raises(RuntimeError) as raised:
        ExecutionService(interpreter_factory=unavailable_runtime).execute_source(
            "mostrar(1)>>", "principal.lumi"
        )
    assert raised.value is failure


def test_repeated_executions_are_isolated_and_do_not_mutate_analysis():
    service = ExecutionService()
    compilation = CompilerService().compile(
        "entero valor = 0>> valor = valor + 1>> mostrar(valor)>>", "principal.lumi"
    )
    first = service.execute(compilation)
    second = service.execute(compilation)

    assert first.output == second.output == ("1",)
    assert first.succeeded and second.succeeded


def test_core_loop_limit_can_be_configured_without_alternative_execution_logic():
    service = ExecutionService(
        interpreter_factory=lambda: Interpreter(max_loop_iterations=2)
    )
    result = service.execute_source("mientras verdadero { mostrar(1)>> }", "principal.lumi")

    assert result.status == ExecutionStatus.FAILED
    assert result.output == ("1", "1")
    assert result.diagnostics[0].category == DiagnosticCategory.RUNTIME


def test_successful_spatial_execution_preserves_complete_trace_and_scene():
    result = ExecutionService().execute_source(
        "habitacion sala(10, 10, 3) { silla silla1 { } "
        "colocar silla1 [1, 0, 1]>> mover silla1 [2, 0, 2]>> "
        "rotar silla1 [0, 90, 0]>> }",
        "principal.lumi",
    )

    assert result.succeeded
    assert result.spatial_trace.complete
    assert [step.event_type for step in result.spatial_trace.steps] == [
        "start",
        "room_create",
        "declaration",
        "place_object",
        "move_object",
        "rotate_object",
        "end",
    ]
    assert all(
        step.scene_snapshot is not None for step in result.spatial_trace.steps
    )
    assert result.scene_plan is not None
    assert result.spatial_trace.steps[-1].scene_snapshot == result.scene_plan
    assert result.scene_plan.rooms[0].elements[0].position.x.value == 2


def test_non_spatial_execution_preserves_boundary_trace():
    result = ExecutionService().execute_source(
        'mostrar("listo")>>', "principal.lumi"
    )

    assert result.succeeded
    assert result.output == ("listo",)
    assert [step.event_type for step in result.spatial_trace.steps] == [
        "start",
        "end",
    ]
    assert all(
        step.scene_snapshot.rooms == () for step in result.spatial_trace.steps
    )


def test_semantic_failure_blocks_execution_and_has_no_trace():
    result = ExecutionService().execute_source(
        'entero valor = "texto">>', "principal.lumi"
    )

    assert result.status == ExecutionStatus.BLOCKED
    assert not result.spatial_trace.complete
    assert result.spatial_trace.unavailable_reason == "execution_not_attempted"
    assert result.spatial_trace.steps == ()


def test_runtime_error_preserves_unavailable_trace_reason():
    result = ExecutionService().execute_source(
        "mostrar(1 / 0)>>", "principal.lumi"
    )

    assert result.status == ExecutionStatus.FAILED
    assert result.scene_plan is None
    assert not result.spatial_trace.complete
    assert result.spatial_trace.unavailable_reason == "execution_failed"
    assert result.spatial_trace.steps == ()


def test_spatial_builder_error_does_not_expose_partial_trace():
    result = ExecutionService().execute_source(
        "habitacion sala(8, 8, 3) { "
        "si verdadero { mover fantasma [2, 0, 2]>> } }",
        "principal.lumi",
    )

    assert result.status == ExecutionStatus.FAILED
    assert result.diagnostics[0].code == "RUN_SPATIAL_OPERATION_FAILED"
    assert result.scene_plan is None
    assert result.spatial_trace.unavailable_reason == "execution_failed"
    assert result.spatial_trace.steps == ()


def test_runtime_spatial_validation_error_has_no_published_trace():
    result = ExecutionService().execute_source(
        "entero ancho = 0>> habitacion sala(ancho, 4, 3) { }",
        "principal.lumi",
    )

    assert result.status == ExecutionStatus.FAILED
    assert result.diagnostics[0].code == "SPA_INVALID_DIMENSION"
    assert result.scene_plan is None
    assert result.spatial_trace.unavailable_reason == "execution_failed"
    assert result.spatial_trace.steps == ()


def test_trace_step_limit_is_propagated_without_failing_execution():
    service = ExecutionService(
        interpreter_factory=lambda: Interpreter(max_spatial_trace_steps=3)
    )

    result = service.execute_source(
        "habitacion sala(8, 8, 3) { silla silla1 { } "
        "colocar silla1 [1, 0, 1]>> }",
        "principal.lumi",
    )

    assert result.status == ExecutionStatus.COMPLETED
    assert result.scene_plan is not None
    assert not result.spatial_trace.complete
    assert result.spatial_trace.unavailable_reason == "step_limit_exceeded"
    assert result.spatial_trace.steps == ()


def test_service_executions_have_independent_traces():
    service = ExecutionService()
    first = service.execute_source(
        "habitacion sala(8, 8, 3) { silla silla1 { } }",
        "primero.lumi",
    )
    second = service.execute_source(
        "habitacion estudio(6, 6, 3) { mesa mesa1 { } }",
        "segundo.lumi",
    )

    assert first.spatial_trace is not second.spatial_trace
    assert first.spatial_trace.steps is not second.spatial_trace.steps
    assert first.spatial_trace.steps[1].room_name == "sala"
    assert second.spatial_trace.steps[1].room_name == "estudio"
    assert all(
        step.source.file == "primero.lumi"
        for step in first.spatial_trace.steps
    )
    assert all(
        step.source.file == "segundo.lumi"
        for step in second.spatial_trace.steps
    )
