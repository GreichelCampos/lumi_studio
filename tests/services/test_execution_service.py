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


def test_spatial_execution_returns_real_unsupported_node_failure():
    result = ExecutionService().execute_source(
        "habitacion sala(5, 4, 2.7) {}", "principal.lumi"
    )

    assert result.compilation.status == CompilationStatus.COMPLETED
    assert result.compilation.scene_plan is not None
    assert result.status == ExecutionStatus.FAILED
    assert not result.succeeded
    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "RUN_UNSUPPORTED_NODE"
    assert diagnostic.category == DiagnosticCategory.RUNTIME
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "principal.lumi", 1, 1,
    )


def test_uncalled_spatial_function_is_not_misrepresented_as_complete_success():
    result = ExecutionService().execute_source(
        "funcion vacio crear() { habitacion sala(5, 4, 2.7) {} } mostrar(1)>>",
        "principal.lumi",
    )

    assert result.status == ExecutionStatus.INCOMPLETE
    assert result.execution_attempted
    assert not result.succeeded
    assert result.output == ("1",)
    assert result.diagnostics == ()


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
