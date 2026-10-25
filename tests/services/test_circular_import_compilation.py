import pytest

from lumi_language.diagnostics import DiagnosticCategory
from services.compiler_service import CompilerService
from services.results import AnalysisStage, CompilationStatus


@pytest.mark.parametrize("size", [1, 2, 3, 4])
def test_compile_project_reports_cycle_at_closing_import(size):
    names = [f"file{i}.lumi" for i in range(size)]
    sources = {
        name: f'\n  importar "{names[(i + 1) % size]}" usar f>>'
        for i, name in enumerate(names)
    }
    result = CompilerService().compile_project(sources, entry_file=names[0])
    assert result.status == CompilationStatus.FAILED
    assert result.stage == AnalysisStage.SYNTACTIC
    assert not result.can_execute
    assert result.program is None
    assert len(result.diagnostics) == 1
    diagnostic = result.diagnostics[0]
    assert diagnostic.category == DiagnosticCategory.IMPORT
    assert diagnostic.code == "IMPORT_CIRCULAR_DEPENDENCY"
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        names[-1], 2, 3,
    )
    assert " \u2192 ".join(names + [names[0]]) in diagnostic.description
