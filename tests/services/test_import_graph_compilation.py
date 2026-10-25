import pytest

from services.compiler_service import CompilerService
from services.serialization import serialize_compilation


FUNCTION = "funcion entero f() { retornar 1>> }"


def test_service_obtains_transitive_context_without_expanding_public_imports():
    service = CompilerService()
    sources = {"B": 'importar "C" usar f>> ' + FUNCTION, "C": FUNCTION}
    result, context = service._compile_with_dependencies('importar "B" usar f>>', "A", sources=sources)
    assert result.succeeded
    assert context.complete
    assert set(context.successful_programs) == {"A", "B", "C"}
    assert list(result.imported_programs) == ["B"]
    serialized = serialize_compilation(result)
    assert list(serialized["imported_programs"]) == ["B"]
    assert set(serialized) == {"file", "status", "stage", "program", "imported_programs", "diagnostics", "limitations"}
    assert serialized == serialize_compilation(service.compile('importar "B" usar f>>', "A", sources=sources))


@pytest.mark.parametrize("bad", ["@", "entero x = >>", 'importar "A" usar f>>'])
def test_failed_compilation_returns_partial_context_without_public_result_changes(bad):
    result, context = CompilerService()._compile_with_dependencies(
        'importar "B" usar f>>', "A", sources={"B": bad},
    )
    assert not result.succeeded
    assert not context.complete
    assert set(context.modules) == {"A", "B"}
    assert context.active_files == []
    assert result.program is None
    assert dict(result.imported_programs) == {}
    assert "modules" not in serialize_compilation(result)


def test_successive_compilations_on_same_service_are_isolated():
    service = CompilerService()
    _, first = service._compile_with_dependencies('importar "B" usar f>>', "A", sources={"B": FUNCTION})
    result, second = service._compile_with_dependencies("", "empty")
    assert result.succeeded
    assert first is not second
    assert set(first.modules) == {"A", "B"}
    assert set(second.modules) == {"empty"}
    assert second.relations == []
    assert first.modules["B"].program is not None


def test_entry_lexical_error_is_registered_without_ast():
    result, context = CompilerService()._compile_with_dependencies("@", "A")
    assert result.lexical_error
    assert context.modules["A"].failure_kind == "LexerError"
    assert context.successful_programs == {}
    assert not context.complete
