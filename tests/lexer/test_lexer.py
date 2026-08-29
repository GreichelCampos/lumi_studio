import json
from pathlib import Path

import pytest

from lumi_language.lexer import Lexer, LexerError


@pytest.mark.parametrize(
    "fixture_name",
    [
        "basic_declaration.json",
        "principal_block.json",
        "for_loop.json",
    ],
)
def test_lexer_fixtures(fixture_name):
    fixture_path = Path(__file__).parent / "fixtures" / "tokens" / fixture_name

    with fixture_path.open(encoding="utf-8") as fixture_file:
        fixture = json.load(fixture_file)

    lexer = Lexer(
        fixture["source"],
        fixture["file"],
    )

    tokens = lexer.tokenize()
    expected_tokens = fixture["expected_tokens"]

    assert len(tokens) == len(expected_tokens)

    for token, expected in zip(tokens, expected_tokens):
        assert token.type.name == expected["type"]
        assert token.lexeme == expected["lexeme"]
        assert token.file == fixture["file"]
        assert token.line == expected["line"]
        assert token.column == expected["column"]


def test_unterminated_string_raises_error():
    lexer = Lexer(
        '"Hola',
        "principal.lumi",
    )

    with pytest.raises(LexerError):
        lexer.tokenize()


def test_invalid_character_raises_error():
    lexer = Lexer(
        "@",
        "principal.lumi",
    )

    with pytest.raises(LexerError):
        lexer.tokenize()


def test_operators():
    lexer = Lexer(
        "+ - * / = == != > < >= <= y o no >>",
        "principal.lumi",
    )

    tokens = lexer.tokenize()

    expected_types = [
        "PLUS",
        "MINUS",
        "MULTIPLY",
        "DIVIDE",
        "ASSIGN",
        "EQUAL_EQUAL",
        "NOT_EQUAL",
        "GREATER",
        "LESS",
        "GREATER_EQUAL",
        "LESS_EQUAL",
        "AND",
        "OR",
        "NOT",
        "TERMINATOR",
    ]

    assert [token.type.name for token in tokens] == expected_types


def test_delimiters():
    lexer = Lexer(
        "{ } ( ) [ ] , : ;",
        "principal.lumi",
    )

    tokens = lexer.tokenize()

    expected_types = [
        "LEFT_BRACE",
        "RIGHT_BRACE",
        "LEFT_PAREN",
        "RIGHT_PAREN",
        "LEFT_BRACKET",
        "RIGHT_BRACKET",
        "COMMA",
        "COLON",
        "SEMICOLON",
    ]

    assert [token.type.name for token in tokens] == expected_types


@pytest.mark.parametrize(
    "lexeme, expected_type",
    [
        ("principal", "PRINCIPAL"),
        ("entero", "INTEGER_TYPE"),
        ("decimal", "DECIMAL_TYPE"),
        ("texto", "STRING_TYPE"),
        ("booleano", "BOOLEAN_TYPE"),
        ("verdadero", "TRUE"),
        ("falso", "FALSE"),
        ("nulo", "NULL"),
        ("lista", "LIST_TYPE"),
        ("vector", "VECTOR_TYPE"),
        ("importar", "IMPORT"),
        ("usar", "USE"),
        ("funcion", "FUNCTION"),
        ("retornar", "RETURN"),
        ("vacio", "VOID"),
        ("si", "IF"),
        ("sino", "ELSE"),
        ("segun", "SWITCH"),
        ("caso", "CASE"),
        ("defecto", "DEFAULT"),
        ("hacer", "FOR"),
        ("mientras", "WHILE"),
        ("repetir", "REPEAT"),
        ("leer", "READ"),
        ("mostrar", "SHOW"),
        ("habitacion", "ROOM"),
        ("piso", "FLOOR"),
        ("pared", "WALL"),
        ("puerta", "DOOR"),
        ("ventana", "WINDOW"),
        ("colocar", "PLACE"),
        ("mover", "MOVE"),
        ("rotar", "ROTATE"),
        ("visualizar3D", "VISUALIZE_3D"),
        ("en", "IN"),
        ("color", "COLOR"),
        ("material", "MATERIAL"),
        ("posicion", "POSITION"),
        ("y", "AND"),
        ("o", "OR"),
        ("no", "NOT"),
    ],
)
def test_keywords(lexeme, expected_type):
    lexer = Lexer(
        lexeme,
        "principal.lumi",
    )

    tokens = lexer.tokenize()

    assert len(tokens) == 1
    assert tokens[0].type.name == expected_type
    assert tokens[0].lexeme == lexeme


def test_identifiers():
    lexer = Lexer(
        "edad nombre_completo habitacion2 _temporal",
        "principal.lumi",
    )

    tokens = lexer.tokenize()

    expected_lexemes = [
        "edad",
        "nombre_completo",
        "habitacion2",
        "_temporal",
    ]

    assert [token.type.name for token in tokens] == [
        "IDENTIFIER",
        "IDENTIFIER",
        "IDENTIFIER",
        "IDENTIFIER",
    ]

    assert [token.lexeme for token in tokens] == expected_lexemes


def test_numbers():
    lexer = Lexer(
        "0 20 125 5.5 10.25",
        "principal.lumi",
    )

    tokens = lexer.tokenize()

    expected_types = [
        "INTEGER_LITERAL",
        "INTEGER_LITERAL",
        "INTEGER_LITERAL",
        "DECIMAL_LITERAL",
        "DECIMAL_LITERAL",
    ]

    expected_lexemes = [
        "0",
        "20",
        "125",
        "5.5",
        "10.25",
    ]

    assert [token.type.name for token in tokens] == expected_types
    assert [token.lexeme for token in tokens] == expected_lexemes


def test_multiline_comment():
    lexer = Lexer(
        "--\nEste es un comentario\nde varias lineas.\n--\nentero edad = 20>>",
        "principal.lumi",
    )

    tokens = lexer.tokenize()

    expected_types = [
        "INTEGER_TYPE",
        "IDENTIFIER",
        "ASSIGN",
        "INTEGER_LITERAL",
        "TERMINATOR",
    ]

    assert [token.type.name for token in tokens] == expected_types


def test_unterminated_multiline_comment_raises_error():
    lexer = Lexer(
        "--\nComentario sin cerrar",
        "principal.lumi",
    )

    with pytest.raises(LexerError):
        lexer.tokenize()


@pytest.mark.parametrize(
    "source",
    [
        "5.",
        ".5",
    ],
)
def test_invalid_decimal_raises_error(source):
    lexer = Lexer(
        source,
        "principal.lumi",
    )

    with pytest.raises(LexerError):
        lexer.tokenize()