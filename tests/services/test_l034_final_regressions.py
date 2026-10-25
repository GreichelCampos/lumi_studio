"""Regressions for shared nested declarations and reached spatial ASTs."""
import pytest

from services.compiler_service import CompilerService
from services.execution_service import ExecutionService
from services.results import AnalysisLimitation, CompilationStatus
from services.serialization import serialize_compilation
from services.protocol.adapters import adapt_result
from services.protocol.models import Request


ENTRY = 'importar "B" usar f>> importar "D" usar g>> mostrar(f() + g())>>'
SOURCES = {
    "B": 'funcion entero f() { importar "C" usar h>> retornar h()>> }',
    "D": 'funcion entero g() { importar "C" usar h>> retornar h()>> }',
}


@pytest.mark.parametrize("shared", [False, True])
@pytest.mark.parametrize("body", [
    'funcion entero aux() { retornar 3>> } retornar aux()>>',
    'retornar aux()>> funcion entero aux() { retornar 3>> }',
    'funcion entero aux() { retornar inner()>> funcion entero inner() { retornar 3>> } } retornar aux()>>',
])
def test_nested_declarations_and_forward_calls_in_each_scope(shared, body):
    entry = ENTRY if shared else 'importar "B" usar f>> mostrar(f())>>'
    result = CompilerService().compile(entry, "A", sources={
        **SOURCES, "C": 'funcion entero h() { ' + body + ' }',
    })
    assert result.status == CompilationStatus.COMPLETED
    assert result.diagnostics == ()
    # Runtime retains its existing declaration-order policy; only execute bodies
    # whose declarations precede calls.
    if body.startswith('funcion entero aux() { retornar 3'):
        execution = ExecutionService().execute(result)
        assert execution.succeeded and execution.diagnostics == ()
        assert execution.output == (("6",) if shared else ("3",))


def test_duplicate_nested_declarations_are_still_errors_in_shared_body():
    result = CompilerService().compile(ENTRY, "A", sources={
        **SOURCES, "C": 'funcion entero h() { funcion entero aux() { retornar 3>> } '
        'funcion entero aux() { retornar 4>> } retornar aux()>> }',
    })
    assert result.status == CompilationStatus.FAILED
    assert [d.code for d in result.diagnostics] == ["SEM_DUPLICATE_SYMBOL"]


def test_distinct_nested_body_diagnostics_survive_shared_visits():
    result = CompilerService().compile(ENTRY, "A", sources={
        **SOURCES, "C": 'funcion entero h() { funcion entero aux() { retornar "bad">> } '
        'funcion entero other() { retornar "bad">> } retornar aux()>> }',
    })
    assert [d.code for d in result.diagnostics] == ["SEM_RETURN_TYPE_MISMATCH"] * 2
    assert result.diagnostics[0].column != result.diagnostics[1].column


@pytest.mark.parametrize("location", ["entry", "direct", "transitive", "shared", "none"])
def test_spatial_limitations_use_all_successful_asts_and_keep_wire_contract(location):
    room = 'funcion vacio unused() { habitacion sala(5, 4, 3) {} }'
    sources = {**SOURCES, "C": 'funcion entero h() { retornar 3>> }'}
    entry = ENTRY
    target = {"entry": "A", "direct": "B", "transitive": "C", "shared": "C"}.get(location)
    if location == "transitive":
        entry = 'importar "B" usar f>> mostrar(f())>>'
    if target == "A":
        entry += room
    elif target:
        sources[target] += room
    result = CompilerService().compile(entry, "A", sources=sources)
    assert result.diagnostics == ()
    expected = () if location == "none" else (AnalysisLimitation.SPATIAL_SEMANTICS_UNAVAILABLE,)
    assert result.limitations == expected
    assert result.status == (CompilationStatus.COMPLETED if location == "none" else CompilationStatus.INCOMPLETE)
    serialized = serialize_compilation(result)
    assert set(serialized) == {"file", "status", "stage", "program", "imported_programs", "diagnostics", "limitations"}
    assert set(serialized["imported_programs"]) == ({"B"} if location == "transitive" else {"B", "D"})
    wire = adapt_result(Request("regression", "analyze", "A", {"A": entry, **sources}), result)
    assert wire["protocolVersion"] == "1.0.0"
    assert wire["result"]["limitations"] == ([] if location == "none" else ["spatial_semantics_unavailable"])


@pytest.mark.parametrize("broken", ['funcion entero h() {', '@'])
def test_failed_spatial_dependency_is_not_a_successful_ast(broken):
    result, context = CompilerService()._compile_with_dependencies(
        ENTRY, "A", sources={**SOURCES, "C": broken},
    )
    assert result.status == CompilationStatus.FAILED
    assert "C" not in context.successful_programs
    assert result.limitations == ()
