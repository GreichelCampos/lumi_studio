"""In-memory regressions for real EOF and consumed unexpected tokens."""

import pytest

from lumi_language.ast_nodes import LiteralNode, MainNode, ShowNode
from lumi_language.diagnostics import DiagnosticCategory
from lumi_language.import_resolver import InMemoryImportResolver
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser, ParserError


@pytest.mark.parametrize("source,line,column", [
    pytest.param("principal {\n    mostrar(1)>>\n", 3, 1, id="final-newline"),
    pytest.param("principal {\n    mostrar(1)>>", 2, 17, id="no-final-newline"),
    pytest.param("principal {\n    mostrar(1)>>   ", 2, 20, id="trailing-spaces"),
    pytest.param("principal {\n    mostrar(1)>>\n  ", 3, 3, id="spaces-after-newline"),
    pytest.param("principal { -- fin", 1, 19, id="line-comment"),
    pytest.param("principal { -- fin\n", 2, 1, id="line-comment-newline"),
    pytest.param("principal {\n--\nfin\n--  ", 4, 5, id="multiline-comment"),
])
@pytest.mark.parametrize("imported", [False, True], ids=["entry", "imported"])
def test_real_eof_location(source, line, column, imported):
    file = "biblioteca.lumi" if imported else "principal.lumi"
    if imported:
        resolver = InMemoryImportResolver({file: source})
        entry = 'importar "biblioteca.lumi" usar prueba>>'
        parser = Parser(Lexer(entry, "entrada.lumi").tokenize(), import_resolver=resolver)
    else:
        parser = Parser(Lexer(source, file).tokenize())
    with pytest.raises(ParserError) as raised:
        parser.parse()
    diagnostic = raised.value.diagnostic
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (file, line, column)
    assert diagnostic.category == DiagnosticCategory.SYNTACTIC
    assert diagnostic.code == "SYN_UNEXPECTED_TOKEN"
    assert diagnostic.description == (
        "Se esperaba '}' para cerrar el bloque. Encontrado: fin de archivo."
    )
    assert diagnostic.suggestion is None


@pytest.mark.parametrize("source,line,column,lexeme", [
    ("entero x = >>", 1, 12, ">>"),
    ("entero x = )", 1, 12, ")"),
    ("entero x = ]\n   ", 1, 12, "]"),
])
def test_last_consumed_token_is_described_as_token(source, line, column, lexeme):
    parser = Parser(Lexer(source, "ultimo.lumi").tokenize())
    with pytest.raises(ParserError) as raised:
        parser.parse()
    diagnostic = raised.value.diagnostic
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == ("ultimo.lumi", line, column)
    assert diagnostic.category == DiagnosticCategory.SYNTACTIC
    assert diagnostic.code == "SYN_UNEXPECTED_TOKEN"
    assert diagnostic.description == f"Se esperaba una expresion. Encontrado: '{lexeme}'."


def test_token_list_and_ast_locations_remain_compatible():
    source = "principal {\n    mostrar(12)>>\n}\n-- fin\n"
    tokens = Lexer(source, "origen.lumi").tokenize()
    assert isinstance(tokens, list)
    assert [(token.lexeme, token.file, token.line, token.column) for token in tokens] == [
        ("principal", "origen.lumi", 1, 1), ("{", "origen.lumi", 1, 11),
        ("mostrar", "origen.lumi", 2, 5), ("(", "origen.lumi", 2, 12),
        ("12", "origen.lumi", 2, 13), (")", "origen.lumi", 2, 15),
        (">>", "origen.lumi", 2, 16), ("}", "origen.lumi", 3, 1),
    ]
    program = Parser(tokens).parse()
    # A caller supplying an ordinary list still gets the same valid AST.
    assert Parser(list(tokens)).parse() == program
    main, = program.statements
    show, = main.body
    assert isinstance(main, MainNode) and isinstance(show, ShowNode)
    assert isinstance(show.expression, LiteralNode)
    assert [(node.file, node.line, node.column) for node in
            (program, main, show, show.expression)] == [
        ("origen.lumi", 1, 1), ("origen.lumi", 1, 1),
        ("origen.lumi", 2, 5), ("origen.lumi", 2, 13),
    ]


def test_empty_stream_keeps_file_and_real_end():
    parser = Parser(Lexer("-- fin\n  ", "vacio.lumi").tokenize())
    assert parser.parse().file == "vacio.lumi"
    diagnostic = parser.error("Se esperaba una expresion.").diagnostic
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == ("vacio.lumi", 2, 3)


def test_plain_token_list_keeps_legacy_eof_fallback():
    parser = Parser(list(Lexer("entero x =", "manual.lumi").tokenize()))
    with pytest.raises(ParserError) as raised:
        parser.parse()
    assert (raised.value.diagnostic.file, raised.value.diagnostic.line,
            raised.value.diagnostic.column) == ("manual.lumi", 1, 10)
