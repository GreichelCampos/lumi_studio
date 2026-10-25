from dataclasses import replace
from types import MappingProxyType

import pytest

from lumi_language.ast_adapter import normalize_ast
from services.compiler_service import CompilerService
from services.execution_service import ExecutionService
from services.protocol.dispatcher import RequestDispatcher
from services.results import CompilationStatus, ExecutionStatus
from services.serialization import serialize_compilation, serialize_compilation_json


ENTRY = 'importar "B" usar f>> mostrar(f())>>'
SOURCES = {
    "B": 'funcion entero f() { importar "C" usar h>> retornar h()>> }',
    "C": 'funcion entero h() { retornar 7>> } funcion entero hidden() { retornar 9>> }',
}


def test_explicit_transitive_import_repeated_calls_preserve_ast_and_direct_imports():
    compilation = CompilerService().compile(ENTRY + " mostrar(f())>>", "A", sources=SOURCES)
    before = normalize_ast(compilation._compiled_programs)
    execution = ExecutionService().execute(compilation)
    assert execution.succeeded and execution.output == ("7", "7")
    assert execution.compilation is compilation
    assert list(compilation.imported_programs) == ["B"]
    assert normalize_ast(compilation._compiled_programs) == before


def test_shared_dependency_is_available_in_each_explicit_importing_scope():
    source = 'importar "B" usar f>> importar "D" usar g>> mostrar(f())>> mostrar(g())>>'
    sources = {**SOURCES, "D": 'funcion entero g() { importar "C" usar h>> retornar h()>> }'}
    result = ExecutionService().execute_source(source, "A", sources=sources)
    assert result.succeeded and result.output == ("7", "7")
    assert set(result.compilation._compiled_programs) == {"A", "B", "C", "D"}


def test_two_different_functions_from_same_direct_module_still_execute():
    result = ExecutionService().execute_source(
        'importar "B" usar f>> importar "B" usar g>> mostrar(f() + g())>>', "A",
        sources={"B": 'funcion entero f() { retornar 1>> } funcion entero g() { retornar 2>> }'},
    )
    assert result.succeeded and result.output == ("3",)


def test_duplicate_import_still_blocks_execution_with_original_location():
    result = ExecutionService().execute_source(ENTRY + '\n  importar "B" usar f>>', "A", sources=SOURCES)
    assert result.status is ExecutionStatus.BLOCKED
    diagnostic, = result.diagnostics
    assert (diagnostic.code, diagnostic.file, diagnostic.line, diagnostic.column) == (
        "IMPORT_DUPLICATE_SYMBOL", "A", 2, 3,
    )


def test_unrequested_transitive_function_remains_invisible():
    result = ExecutionService().execute_source(ENTRY + " mostrar(hidden())>>", "A", sources=SOURCES)
    assert result.status is ExecutionStatus.BLOCKED
    assert [d.code for d in result.diagnostics] == ["SEM_UNDECLARED_FUNCTION"]
    assert "C" in result.compilation._compiled_programs


def test_missing_file_preserves_import_location_and_blocks_runtime():
    sources = {"B": 'funcion entero f() {\n  importar "missing" usar h>> retornar 1>> }'}
    result = ExecutionService().execute_source(ENTRY, "A", sources=sources)
    assert result.status is ExecutionStatus.BLOCKED
    diagnostic, = result.diagnostics
    assert (diagnostic.code, diagnostic.file, diagnostic.line, diagnostic.column) == (
        "IMPORT_FILE_NOT_FOUND", "B", 2, 3,
    )
    assert result.compilation._compiled_programs == {}


def test_interleaved_compilations_and_independent_services_use_their_own_sources():
    compiler = CompilerService()
    sources = dict(SOURCES)
    first = compiler.compile(ENTRY, "A", sources=sources)
    sources["C"] = SOURCES["C"].replace("retornar 7", "retornar 8")
    second = compiler.compile(ENTRY, "A", sources=sources)
    sources.clear()

    class CompileForbidden(CompilerService):
        def compile(self, *args, **kwargs):
            pytest.fail("execution must not recompile")

    service = ExecutionService(CompileForbidden())
    assert service.execute(second).output == ("8",)
    assert service.execute(first).output == ("7",)
    assert ExecutionService(CompileForbidden()).execute(first).output == ("7",)


def test_legacy_result_uses_direct_import_fallback_without_recompiling():
    compilation = CompilerService().compile(ENTRY, "A", sources={"B": 'funcion entero f() { retornar 3>> }'})
    legacy = replace(compilation, _compiled_programs=None)
    result = ExecutionService().execute(legacy)
    assert result.succeeded and result.output == ("3",)


def test_present_empty_catalog_does_not_fall_back_to_direct_imports():
    compilation = CompilerService().compile(ENTRY, "A", sources={"B": 'funcion entero f() { retornar 3>> }'})
    result = ExecutionService().execute(replace(compilation, _compiled_programs=MappingProxyType({})))
    assert result.status is ExecutionStatus.FAILED
    assert result.diagnostics[0].code == "RUN_IMPORT_FILE_NOT_FOUND"


def test_public_serialization_ignores_private_catalog_without_generic_dataclass_conversion(monkeypatch):
    import dataclasses

    def forbidden(*args, **kwargs):
        pytest.fail("public serializers must not use asdict on internal results")

    monkeypatch.setattr(dataclasses, "asdict", forbidden)
    compilation = CompilerService().compile(ENTRY, "A", sources=SOURCES)
    legacy = replace(compilation, _compiled_programs=None)
    assert serialize_compilation(compilation) == serialize_compilation(legacy)
    assert serialize_compilation_json(compilation) == serialize_compilation_json(legacy)
    assert set(serialize_compilation(compilation)) == {
        "file", "status", "stage", "program", "imported_programs", "diagnostics", "limitations",
    }
    assert "_compiled_programs" not in serialize_compilation_json(compilation)
    assert list(serialize_compilation(compilation)["imported_programs"]) == ["B"]


def test_protocol_executes_transitive_import_without_new_response_fields():
    wire = RequestDispatcher().dispatch({
        "protocolVersion": "1.0.0", "requestId": "multifile", "operation": "execute",
        "entryFile": "A", "files": {"A": ENTRY, **SOURCES},
    })
    assert wire["status"] == "completed"
    assert wire["result"]["output"] == ["7"]
    assert set(wire["result"]) == {
        "entryFile", "analysisStatus", "stage", "output", "diagnostics", "limitations",
        "executionAttempted", "capabilities",
    }
    assert wire["result"]["diagnostics"] == []


def test_incomplete_spatial_compilation_keeps_existing_execution_policy():
    compilation = CompilerService().compile('habitacion sala(5, 4, 3) {}', "A")
    assert compilation.status is CompilationStatus.INCOMPLETE
    execution = ExecutionService().execute(compilation)
    assert execution.succeeded
    assert execution.scene_plan is not None
