"""Integration tests against the actual lexer, parser and semantic analyzer."""

import pytest

from lumi_language.diagnostics import DiagnosticCategory
from lumi_language.lexer_error import LexerError
from lumi_language.parser import ParserError
from services.compiler_service import CompilerService
from services.results import AnalysisLimitation, AnalysisStage, CompilationStatus


def test_analysis_does_not_execute_output_or_input():
    result = CompilerService().compile(
        'principal { texto nombre = leer("Nombre:")>> mostrar(nombre)>> }',
        "principal.lumi",
    )

    assert result.succeeded
    assert result.can_execute
    assert result.stage == AnalysisStage.SEMANTIC
    assert result.program is not None
    assert result.diagnostics == ()
    assert result.lexical_error is None


def test_lexical_failure_preserves_raw_message_without_inventing_diagnostic():
    source = "mostrar(@)>>"
    with pytest.raises(LexerError) as original:
        from lumi_language.lexer import Lexer
        Lexer(source, "principal.lumi").tokenize()

    result = CompilerService().compile(source, "principal.lumi")

    assert result.status == CompilationStatus.FAILED
    assert result.stage == AnalysisStage.LEXICAL
    assert result.lexical_error == str(original.value)
    assert result.diagnostics == ()
    assert result.program is None
    assert not result.can_execute


def test_syntax_failure_preserves_core_diagnostic_and_does_not_duplicate_it():
    from lumi_language.lexer import Lexer
    from lumi_language.parser import Parser

    source = "entero cantidad = 1"
    with pytest.raises(ParserError) as original:
        Parser(Lexer(source, "principal.lumi").tokenize()).parse()

    result = CompilerService().compile(source, "principal.lumi")

    assert result.status == CompilationStatus.FAILED
    assert result.stage == AnalysisStage.SYNTACTIC
    assert result.diagnostics == (original.value.diagnostic,)
    assert result.diagnostics[0].category == DiagnosticCategory.SYNTACTIC
    assert not result.can_execute


def test_semantic_failure_preserves_location_code_message_and_suggestion():
    from lumi_language.lexer import Lexer
    from lumi_language.parser import Parser
    from lumi_language.semantic_analyzer import SemanticAnalyzer

    source = 'entero cantidad = "cuatro">>'
    program = Parser(Lexer(source, "principal.lumi").tokenize()).parse()
    original = SemanticAnalyzer().analyze(program)
    result = CompilerService().compile(source, "principal.lumi")

    assert result.status == CompilationStatus.FAILED
    assert result.stage == AnalysisStage.SEMANTIC
    assert result.diagnostics == tuple(original.diagnostics)
    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "SEM_TYPE_MISMATCH"
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "principal.lumi", 1, 1,
    )
    assert not result.can_execute


def test_project_uses_explicit_entry_even_if_another_file_is_first():
    result = CompilerService().compile_project(
        {
            "activo.lumi": "@",
            "principal.lumi": 'mostrar("principal")>>',
        },
        entry_file="principal.lumi",
    )

    assert result.succeeded
    assert result.file == "principal.lumi"
    assert result.program.file == "principal.lumi"


def test_import_context_is_collected_without_altering_source_mapping():
    sources = {
        "principal.lumi": 'importar "utilidades.lumi" usar respuesta>>',
        "utilidades.lumi": "funcion entero respuesta() { retornar 42>> }",
    }
    original = dict(sources)
    result = CompilerService().compile_project(sources, entry_file="principal.lumi")

    assert result.succeeded
    assert set(result.imported_programs) == {"utilidades.lumi"}
    assert sources == original
    with pytest.raises(TypeError):
        result.imported_programs["extra.lumi"] = result.program


def test_missing_import_returns_authentic_import_error():
    result = CompilerService().compile(
        'importar "ausente.lumi" usar respuesta>>', "principal.lumi"
    )

    assert not result.can_execute
    assert len(result.diagnostics) == 1
    diagnostic = result.diagnostics[0]
    assert diagnostic.category == DiagnosticCategory.IMPORT
    assert diagnostic.code == "IMPORT_FILE_NOT_FOUND"
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "principal.lumi", 1, 1,
    )


@pytest.mark.parametrize(
    "imported_source, expected_stage",
    [("@", AnalysisStage.LEXICAL), ("entero valor =", AnalysisStage.SYNTACTIC)],
)
def test_errors_inside_imports_retain_the_available_origin(imported_source, expected_stage):
    result = CompilerService().compile(
        'importar "roto.lumi" usar respuesta>>',
        "principal.lumi",
        sources={"roto.lumi": imported_source},
    )

    assert result.status == CompilationStatus.FAILED
    assert result.stage == expected_stage
    if expected_stage == AnalysisStage.LEXICAL:
        assert result.lexical_error.startswith("roto.lumi:")
        assert result.diagnostics == ()
    else:
        assert result.diagnostics[0].file == "roto.lumi"


@pytest.mark.parametrize(
    "source",
    [
        "habitacion sala(5, 4, 2.7) { pared pared1 {} }",
        "funcion vacio crear() { habitacion sala(5, 4, 2.7) {} }",
        "si falso { habitacion sala(5, 4, 2.7) {} }",
    ],
)
def test_spatial_syntax_is_flagged_as_incomplete_without_evaluation(source):
    result = CompilerService().compile(source, "principal.lumi")

    assert result.status == CompilationStatus.INCOMPLETE
    assert not result.succeeded
    assert result.can_execute
    assert result.diagnostics == ()
    assert result.limitations == (AnalysisLimitation.SPATIAL_SEMANTICS_UNAVAILABLE,)


def test_spatial_syntax_inside_imported_function_is_flagged():
    result = CompilerService().compile(
        'importar "espacio.lumi" usar crear>>',
        "principal.lumi",
        sources={
            "espacio.lumi": (
                "funcion vacio crear() { habitacion sala(5, 4, 2.7) {} }"
            ),
        },
    )

    assert result.status == CompilationStatus.INCOMPLETE
    assert result.limitations


def test_repeated_analysis_does_not_leak_diagnostics_or_imports():
    service = CompilerService()
    failed = service.compile("mostrar(desconocida)>>", "malo.lumi")
    valid = service.compile('mostrar("bien")>>', "bueno.lumi")

    assert failed.diagnostics
    assert valid.succeeded
    assert valid.diagnostics == ()
    assert not valid.imported_programs


def test_unknown_semantic_failure_propagates_unchanged(monkeypatch):
    from lumi_language.semantic_analyzer import SemanticAnalyzer

    failure = RuntimeError("fallo interno del analizador")

    def fail_analysis(self, program, imported_programs):
        raise failure

    monkeypatch.setattr(SemanticAnalyzer, "analyze", fail_analysis)
    with pytest.raises(RuntimeError) as raised:
        CompilerService().compile('mostrar("hola")>>', "principal.lumi")

    assert raised.value is failure


@pytest.mark.parametrize("source", ["@", "entero valor ="])
def test_earlier_failures_do_not_reach_semantic_analysis(monkeypatch, source):
    from lumi_language.semantic_analyzer import SemanticAnalyzer

    def unexpected_analysis(*args):
        pytest.fail("El análisis semántico no debe ejecutarse tras este error")

    monkeypatch.setattr(SemanticAnalyzer, "analyze", unexpected_analysis)
    assert CompilerService().compile(source, "principal.lumi").status == CompilationStatus.FAILED


def test_entry_must_exist_and_conflicting_contents_are_rejected():
    service = CompilerService()
    with pytest.raises(ValueError, match="principal"):
        service.compile_project({"otro.lumi": ""}, entry_file="principal.lumi")
    with pytest.raises(ValueError, match="contenidos"):
        service.compile("", "principal.lumi", sources={"principal.lumi": "@"})


@pytest.mark.parametrize("source, file", [(None, "a.lumi"), ("", ""), ("", None)])
def test_invalid_host_inputs_are_not_reported_as_student_diagnostics(source, file):
    with pytest.raises((TypeError, ValueError)):
        CompilerService().compile(source, file)
