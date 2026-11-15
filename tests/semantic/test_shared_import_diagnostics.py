from copy import deepcopy

from lumi_language.ast_adapter import normalize_ast
from lumi_language.import_resolver import InMemoryImportResolver
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser
from lumi_language.semantic_analyzer import SemanticAnalyzer


def analyze(source, sources, analyzer=None):
    parser = Parser(Lexer(source, "A").tokenize(), InMemoryImportResolver(sources))
    program = parser.parse()
    return (analyzer or SemanticAnalyzer()).analyze(program, parser._import_context.successful_programs)


def test_shared_module_body_is_analyzed_once_in_its_own_scope(monkeypatch):
    visits = []
    original = SemanticAnalyzer._analyze_function_body

    def counted(self, node, symbol):
        visits.append((node["file"], node["name"]))
        return original(self, node, symbol)

    monkeypatch.setattr(SemanticAnalyzer, "_analyze_function_body", counted)
    result = analyze(
        'importar "B" usar f>> importar "D" usar g>>',
        {"B": 'funcion entero f() { importar "C" usar h>> retornar h()>> }',
         "D": 'funcion entero g() { importar "C" usar h>> retornar h()>> }',
         "C": 'funcion entero h() {\n  retornar "bad">>\n}'},
    )
    assert visits.count(("C", "h")) == 1
    diagnostic, = result.diagnostics
    assert diagnostic.code == "SEM_RETURN_TYPE_MISMATCH"
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == ("C", 2, 3)
    assert diagnostic.suggestion


def test_distinct_nodes_with_identical_location_and_message_remain_distinct():
    parser = Parser(Lexer('importar "B" usar f>>', "A").tokenize())
    program = parser.parse()
    imported = normalize_ast(Parser(Lexer('funcion entero f() { retornar "bad">> }', "B").tokenize()).parse())
    function = imported["statements"][0]
    function["body"].append(deepcopy(function["body"][0]))
    result = SemanticAnalyzer().analyze(program, {"B": imported})
    assert len(result.diagnostics) == 2
    assert result.diagnostics[0] == result.diagnostics[1]
    assert result.diagnostics[0] is not result.diagnostics[1]


def test_shared_body_does_not_capture_homonymous_caller_functions():
    result = analyze(
        'si verdadero {\n funcion entero helper(texto x) { retornar 1>> }\n importar "C" usar f>>\n}\n'
        'si verdadero {\n funcion entero helper(texto x) { retornar 1>> }\n importar "C" usar f>>\n}',
        {"C": 'funcion entero f() { retornar helper(1)>> }'},
    )
    diagnostic, = result.diagnostics
    assert diagnostic.code == "SEM_UNDECLARED_FUNCTION"
    assert diagnostic.file == "C"


def test_shared_body_does_not_capture_homonymous_caller_variables():
    result = analyze(
        'si verdadero { texto value = "bad">> importar "C" usar f>> }\n'
        'si verdadero { booleano value = verdadero>> importar "C" usar f>> }',
        {"C": 'funcion entero f() { retornar value>> }'},
    )
    diagnostic, = result.diagnostics
    assert diagnostic.code == "SEM_UNDECLARED_VARIABLE"
    assert diagnostic.file == "C"


def test_type_checker_diagnostics_from_shared_body_are_aggregated():
    result = analyze(
        'si verdadero { importar "C" usar f>> } si verdadero { importar "C" usar f>> }',
        {"C": 'funcion entero f() { entero x = "bad">> retornar 1>> }'},
    )
    assert [d.code for d in result.diagnostics] == ["SEM_TYPE_MISMATCH"]


def test_reusing_analyzer_resets_diagnostic_provenance():
    analyzer = SemanticAnalyzer()
    sources = {"B": 'funcion entero f() { retornar "bad">> }'}
    first = analyze('importar "B" usar f>>', sources, analyzer)
    second = analyze('importar "B" usar f>>', sources, analyzer)
    assert len(first.diagnostics) == len(second.diagnostics) == 1
    assert first.diagnostics == second.diagnostics
