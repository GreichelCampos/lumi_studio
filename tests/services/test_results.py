from dataclasses import fields, replace
from types import MappingProxyType

import pytest

from services.compiler_service import CompilerService
from services.results import AnalysisStage, CompilationResult, CompilationStatus


def test_internal_catalog_is_optional_keyword_only_and_excluded_from_repr_and_equality():
    result = CompilationResult("A", CompilationStatus.COMPLETED, AnalysisStage.SEMANTIC)
    assert result._compiled_programs is None
    catalog_field = next(f for f in fields(result) if f.name == "_compiled_programs")
    assert not catalog_field.repr and not catalog_field.compare and catalog_field.kw_only
    populated = replace(result, _compiled_programs=MappingProxyType({}))
    assert populated == result
    assert repr(populated) == repr(result)
    assert "_compiled_programs" not in repr(populated)


def test_compiled_catalog_is_read_only_and_independent_of_traversal_context():
    compilation, context = CompilerService()._compile_with_dependencies(
        'importar "B" usar f>>', "A",
        sources={"B": 'funcion entero f() { importar "C" usar g>> retornar g()>> }',
                 "C": 'funcion entero g() { retornar 1>> }'},
    )
    catalog = compilation._compiled_programs
    assert set(catalog) == {"A", "B", "C"}
    assert catalog["B"] is compilation.imported_programs["B"]
    assert catalog["C"] is context.modules["C"].program
    with pytest.raises(TypeError):
        catalog["other"] = catalog["C"]
    context.modules.clear()
    context.relations.clear()
    assert set(catalog) == {"A", "B", "C"}


def test_failed_compilation_catalog_contains_only_successfully_parsed_modules():
    result = CompilerService().compile(
        'importar "good" usar f>> importar "bad" usar g>>', "A",
        sources={"good": 'funcion entero f() { retornar 1>> }', "bad": "entero x = >>"},
    )
    assert result.status is CompilationStatus.FAILED
    assert result.stage is AnalysisStage.SYNTACTIC
    assert set(result._compiled_programs) == {"good"}
    assert result.program is None
    assert dict(result.imported_programs) == {}
    assert result.diagnostics[0].file == "bad"
