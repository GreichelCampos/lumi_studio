import pytest

from lumi_language.import_resolver import InMemoryImportResolver
from lumi_language.interpreter import Interpreter
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser, ParserError
from lumi_language.semantic_analyzer import SemanticAnalyzer


def test_direct_function_import_parameters_and_return_still_execute():
    resolver = InMemoryImportResolver({
        "math.lumi": (
            "funcion decimal area(decimal ancho, decimal largo) { "
            "retornar ancho * largo>> }"
        ),
    })
    source = 'importar "math.lumi" usar area>> mostrar(area(4, 5))>>'
    parser = Parser(Lexer(source, "principal.lumi").tokenize(), resolver)
    program = parser.parse()
    semantic = SemanticAnalyzer().analyze(program, parser.imported_programs)
    assert semantic.succeeded
    runtime = Interpreter().execute(program, parser.imported_programs)
    assert runtime.succeeded
    assert runtime.output == ["20"]
    assert parser.imported_programs["math.lumi"].statements[0].file == "math.lumi"


def test_circular_dependency_stops_pipeline_at_parsing():
    resolver = InMemoryImportResolver({
        "a.lumi": 'importar "b.lumi" usar f>>',
        "b.lumi": 'importar "a.lumi" usar f>>',
    })
    parser = Parser(
        Lexer('importar "a.lumi" usar f>>', "principal.lumi").tokenize(),
        resolver,
    )
    with pytest.raises(ParserError):
        parser.parse()
    assert len(parser.diagnostics) == 1
    assert parser.diagnostics[0].code == "IMPORT_CIRCULAR_DEPENDENCY"
    assert parser.diagnostics[0].file == "b.lumi"
    assert parser.imported_programs == {}
