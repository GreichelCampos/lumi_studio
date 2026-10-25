import pytest

from lumi_language.ast_adapter import normalize_ast
from lumi_language.semantic_analyzer import SemanticAnalyzer
from services.compiler_service import CompilerService
from services.execution_service import ExecutionService
from services.protocol.adapters import adapt_result
from services.protocol.models import Request
from services.serialization import serialize_compilation


SOURCES = {
    "B": 'funcion entero f() { importar "C" usar h>> retornar h()>> }',
    "C": 'funcion entero h() { retornar 1>> }',
}
ENTRY = 'importar "B" usar f>>'


def test_explicit_transitive_import_uses_successful_catalog_without_expanding_public_imports(monkeypatch):
    received = []
    original = SemanticAnalyzer.analyze

    def inspect(self, program, imported_programs=None):
        received.append(set(imported_programs))
        before = normalize_ast(imported_programs)
        result = original(self, program, imported_programs)
        assert normalize_ast(imported_programs) == before
        return result

    monkeypatch.setattr(SemanticAnalyzer, "analyze", inspect)
    result, context = CompilerService()._compile_with_dependencies(ENTRY, "A", sources=SOURCES)
    assert result.succeeded and result.diagnostics == ()
    assert received == [{"A", "B", "C"}]
    assert context.complete
    assert list(result.imported_programs) == ["B"]
    snapshot = serialize_compilation(result)
    assert list(snapshot["imported_programs"]) == ["B"]
    assert set(snapshot) == {"file", "status", "stage", "program", "imported_programs", "diagnostics", "limitations"}


def test_shared_dependency_error_reaches_service_once_with_original_location():
    result = CompilerService().compile(ENTRY + ' importar "D" usar g>>', "A", sources={
        **SOURCES,
        "D": 'funcion entero g() { importar "C" usar h>> retornar h()>> }',
        "C": 'funcion entero h() {\n  retornar "bad">>\n}',
    })
    diagnostic, = result.diagnostics
    assert (diagnostic.code, diagnostic.category.value) == ("SEM_RETURN_TYPE_MISMATCH", "SEMANTIC")
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == ("C", 2, 3)


def test_different_import_instructions_keep_their_own_errors():
    result = CompilerService().compile(ENTRY + ' importar "D" usar g>>', "A", sources={
        **SOURCES,
        "B": 'funcion entero f() {\n  importar "C" usar missing>> retornar 1>> }',
        "D": 'funcion entero g() {\n    importar "C" usar missing>> retornar 1>> }',
    })
    assert [(d.code, d.file, d.line, d.column) for d in result.diagnostics] == [
        ("IMPORT_SYMBOL_NOT_FOUND", "B", 2, 3), ("IMPORT_SYMBOL_NOT_FOUND", "D", 2, 5),
    ]


def test_unrequested_function_is_still_not_validated():
    result = CompilerService().compile(ENTRY, "A", sources={
        **SOURCES, "C": SOURCES["C"] + ' funcion entero unused() { retornar "bad">> }',
    })
    assert result.succeeded


def test_repeated_import_still_reports_duplicate_symbol_at_second_instruction():
    result = CompilerService().compile(ENTRY + "\n  " + ENTRY, "A", sources=SOURCES)
    diagnostic, = result.diagnostics
    assert (diagnostic.code, diagnostic.file, diagnostic.line, diagnostic.column) == (
        "IMPORT_DUPLICATE_SYMBOL", "A", 2, 3,
    )


def test_successive_compilations_do_not_share_semantic_results():
    service = CompilerService()
    invalid = {**SOURCES, "C": 'funcion entero h() { retornar "bad">> }'}
    first = service.compile(ENTRY, "A", sources=invalid)
    second = service.compile(ENTRY, "A", sources=SOURCES)
    third = service.compile(ENTRY, "A", sources=invalid)
    assert not first.succeeded and second.succeeded and not third.succeeded
    assert first.diagnostics == third.diagnostics


@pytest.mark.parametrize("broken", ["entero x = >>", "@"])
def test_failed_transitive_module_never_reaches_semantic_analysis(monkeypatch, broken):
    def unexpected(*args, **kwargs):
        pytest.fail("failed parsing must not reach semantic analysis")

    monkeypatch.setattr(SemanticAnalyzer, "analyze", unexpected)
    result, context = CompilerService()._compile_with_dependencies(ENTRY, "A", sources={**SOURCES, "C": broken})
    assert not result.succeeded
    assert "C" not in context.successful_programs


def test_supported_direct_execution_serialization_and_wire_contract_are_unchanged():
    source = 'importar "B" usar f>> mostrar(f())>>'
    sources = {"B": 'funcion entero f() { retornar 7>> }'}
    compilation = CompilerService().compile(source, "A", sources=sources)
    execution = ExecutionService().execute(compilation)
    assert compilation.succeeded and execution.succeeded
    assert execution.output == ("7",)
    wire = adapt_result(Request("semantic", "execute", "A", {"A": source, **sources}), compilation, execution)
    assert wire["protocolVersion"] == "1.0.0"
    assert wire["result"]["output"] == ["7"]
    assert set(wire["result"]) == {
        "entryFile", "analysisStatus", "stage", "output", "diagnostics", "limitations",
        "executionAttempted", "capabilities",
    }
    assert list(serialize_compilation(compilation)["imported_programs"]) == ["B"]


def test_runtime_receives_transitive_catalog_for_explicit_nested_import():
    compilation = CompilerService().compile(ENTRY + " mostrar(f())>>", "A", sources=SOURCES)
    assert compilation.succeeded
    execution = ExecutionService().execute(compilation)
    assert execution.succeeded
    assert execution.output == ("1",)
    assert execution.diagnostics == ()
    assert list(compilation.imported_programs) == ["B"]


@pytest.mark.parametrize("source", [
    'importar "B" usar f>> mostrar(h())>>',
    'importar "B" usar f>>',
])
def test_catalog_does_not_change_visibility_or_top_level_import_propagation(source):
    sources = {**SOURCES, "B": 'importar "C" usar h>> funcion entero f() { retornar h()>> }'}
    result = CompilerService().compile(source, "A", sources=sources)
    assert not result.succeeded
    assert all(d.code == "SEM_UNDECLARED_FUNCTION" for d in result.diagnostics)
    assert any(d.file == "B" for d in result.diagnostics)
