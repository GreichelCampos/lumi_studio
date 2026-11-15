"""Public compilation states must reflect actual spatial analysis capability."""

from services.compiler_service import CompilerService
from services.results import (
    AnalysisLimitation,
    AnalysisStage,
    CompilationStatus,
)


def test_valid_spatial_program_reports_completed_analysis():
    result = CompilerService().compile(
        "habitacion sala(5, 4, 3) { mesa mesa1 {} "
        "colocar mesa1 [0, 0, 0]>> }",
        "principal.lumi",
    )

    assert result.status is CompilationStatus.COMPLETED
    assert result.stage is AnalysisStage.SEMANTIC
    assert result.diagnostics == ()
    assert result.limitations == ()


def test_real_spatial_error_reports_failed_without_capability_limitation():
    result = CompilerService().compile(
        "habitacion sala(5, 4, 3) { mover fantasma [0, 0, 0]>> }",
        "principal.lumi",
    )

    assert result.status is CompilationStatus.FAILED
    assert [item.code for item in result.diagnostics] == [
        "SPA_ELEMENT_NOT_FOUND",
    ]
    assert result.limitations == ()


def test_recursive_unknown_spatial_effect_reports_incomplete_analysis():
    result = CompilerService().compile(
        "funcion vacio preparar() { preparar()>> } "
        "habitacion sala(5, 4, 3) { preparar()>> }",
        "principal.lumi",
    )

    assert result.status is CompilationStatus.INCOMPLETE
    assert result.diagnostics == ()
    assert result.limitations == (
        AnalysisLimitation.SPATIAL_SEMANTICS_UNAVAILABLE,
    )


def test_non_spatial_program_reports_completed_analysis():
    result = CompilerService().compile(
        "entero valor = 2 + 3>> mostrar(valor)>>",
        "principal.lumi",
    )

    assert result.status is CompilationStatus.COMPLETED
    assert result.diagnostics == ()
    assert result.limitations == ()


def test_valid_imported_spatial_function_reports_completed_analysis():
    result = CompilerService().compile(
        'importar "espacio.lumi" usar crear>> crear()>>',
        "principal.lumi",
        sources={
            "espacio.lumi": (
                "funcion vacio crear() { "
                "habitacion sala(5, 4, 3) { mesa mesa1 {} "
                "colocar mesa1 [0, 0, 0]>> } }"
            ),
        },
    )

    assert result.status is CompilationStatus.COMPLETED
    assert result.diagnostics == ()
    assert result.limitations == ()
