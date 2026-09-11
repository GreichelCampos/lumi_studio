from lumi_language.interpreter import Interpreter
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser
from lumi_language.semantic_analyzer import SemanticAnalyzer


def parse_source(source: str, file: str = "principal.lumi"):
    tokens = Lexer(source, file).tokenize()
    return Parser(tokens).parse()


def test_lexer_parser_and_semantic_analyzer_accept_valid_program():
    source = """
principal {
    entero contador = 0>>
    mientras contador < 3 {
        contador = contador + 1>>
    }
    mostrar(contador)>>
}
"""

    ast = parse_source(source)
    result = SemanticAnalyzer().analyze(ast)

    assert result.succeeded
    assert result.diagnostics == []


def test_semantic_analyzer_reports_duplicate_at_parser_location():
    source = """entero ancho = 5>>
entero ancho = 6>>"""

    result = SemanticAnalyzer().analyze(parse_source(source))

    assert not result.succeeded
    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "SEM_DUPLICATE_SYMBOL"
    assert diagnostic.file == "principal.lumi"
    assert diagnostic.line == 2
    assert diagnostic.column == 1


def test_semantic_analyzer_reports_identifier_location():
    result = SemanticAnalyzer().analyze(
        parse_source("mostrar(no_declarada)>>")
    )

    assert not result.succeeded
    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "SEM_UNDECLARED_VARIABLE"
    assert diagnostic.file == "principal.lumi"
    assert diagnostic.line == 1
    assert diagnostic.column == 9


def test_semantic_analyzer_reports_assignment_type_location():
    result = SemanticAnalyzer().analyze(
        parse_source('entero cantidad = "cuatro">>')
    )

    assert not result.succeeded
    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "SEM_TYPE_MISMATCH"
    assert diagnostic.file == "principal.lumi"
    assert diagnostic.line == 1
    assert diagnostic.column == 1


def test_lexer_parser_and_interpreter_execute_program():
    source = """
principal {
    entero contador = 0>>
    mientras contador < 3 {
        mostrar(contador)>>
        contador = contador + 1>>
    }
}
"""

    ast = parse_source(source)
    semantic_result = SemanticAnalyzer().analyze(ast)
    execution_result = Interpreter().execute(ast)

    assert semantic_result.succeeded
    assert execution_result.succeeded
    assert execution_result.output == ["0", "1", "2"]


def test_interpreter_runtime_diagnostic_keeps_parser_location():
    ast = parse_source("mostrar(4 / 0)>>")

    result = Interpreter().execute(ast)

    assert not result.succeeded
    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "RUN_DIVISION_BY_ZERO"
    assert diagnostic.file == "principal.lumi"
    assert diagnostic.line == 1
    assert diagnostic.column == 9
