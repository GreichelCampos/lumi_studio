"""Conservative spatial effects of Lumi loop constructs."""

import time

import pytest

from lumi_language.lexer import Lexer
from lumi_language.parser import Parser
from lumi_language.semantic_analyzer import SemanticAnalyzer


def analyze(source: str, file: str = "ciclos.lumi"):
    program = Parser(Lexer(source, file).tokenize(), file=file).parse()
    return SemanticAnalyzer().analyze(program)


def codes(result):
    return [item.code for item in result.diagnostics]


@pytest.mark.parametrize("count", ["0", "-1"])
def test_repeat_non_positive_has_no_spatial_effect(count):
    result = analyze(
        f"habitacion sala(5, 4, 3) {{ repetir {count} {{ mesa item {{}} }} "
        "rotar item [0, 90, 0]>> }"
    )

    assert codes(result) == ["SPA_ELEMENT_NOT_FOUND"]


def test_repeat_one_applies_effect_once():
    result = analyze(
        "habitacion sala(5, 4, 3) { repetir 1 { mesa item {} "
        "colocar item [0, 0, 0]>> mover item [1, 0, 1]>> } "
        "mover item [2, 0, 2]>> }"
    )

    assert result.succeeded


@pytest.mark.parametrize(
    "body, expected",
    [
        ("mesa item {}", "SPA_DUPLICATE_ELEMENT"),
        ("colocar item [0, 0, 0]>>", "SPA_ELEMENT_ALREADY_PLACED"),
    ],
)
def test_repeat_two_reports_error_from_second_iteration(body, expected):
    prefix = "mesa item {} " if body.startswith("colocar") else ""
    result = analyze(
        f"habitacion sala(5, 4, 3) {{ {prefix}repetir 2 {{ {body} }} }}",
        file="segunda.lumi",
    )

    assert codes(result) == [expected]
    assert result.diagnostics[0].file == "segunda.lumi"


def test_repeat_unknown_is_optional_and_does_not_block():
    result = analyze(
        "entero cantidad = 2>> habitacion sala(5, 4, 3) { "
        "repetir cantidad { mesa item {} colocar item [0, 0, 0]>> } "
        "mover item [1, 0, 1]>> }"
    )

    assert result.succeeded


def test_repeat_huge_count_is_bounded_and_finds_stable_error():
    started = time.monotonic()
    result = analyze(
        "habitacion sala(5, 4, 3) { repetir 999999999999999999999999 { "
        "mesa item {} } }"
    )

    assert codes(result) == ["SPA_DUPLICATE_ELEMENT"]
    assert time.monotonic() - started < 1.0


def test_while_false_has_zero_effect_but_keeps_local_validation():
    result = analyze(
        'habitacion sala(5, 4, 3) { mientras falso { mesa item { color 1>> } } '
        "rotar item [0, 90, 0]>> }"
    )

    assert codes(result) == [
        "SEM_SPATIAL_PROPERTY_TYPE_MISMATCH", "SPA_ELEMENT_NOT_FOUND",
    ]


def test_while_unknown_joins_zero_and_more_iterations_without_false_error():
    result = analyze(
        "booleano continuar = verdadero>> habitacion sala(5, 4, 3) { "
        "mientras continuar { mesa item {} colocar item [0, 0, 0]>> } "
        "mover item [1, 0, 1]>> }"
    )

    assert result.succeeded


@pytest.mark.parametrize(
    "header, expected",
    [
        ("entero i = 0; i < 0; i = i + 1", ["SPA_ELEMENT_NOT_FOUND"]),
        ("entero i = 0; i < 1; i = i + 1", []),
        ("entero i = 0; i < 3; i = i + 1", ["SPA_DUPLICATE_ELEMENT"]),
    ],
)
def test_for_canonical_zero_one_and_many_iterations(header, expected):
    result = analyze(
        f"habitacion sala(5, 4, 3) {{ hacer {header} {{ mesa item {{}} }} "
        "rotar item [0, 90, 0]>> }"
    )

    assert codes(result) == expected


def test_for_unknown_count_degrades_conservatively():
    result = analyze(
        "entero limite = 3>> habitacion sala(5, 4, 3) { "
        "hacer entero i = 0; i < limite; i = i + 1 { mesa item {} } "
        "rotar item [0, 90, 0]>> }"
    )

    assert result.succeeded


def test_move_before_place_is_confirmed_in_required_iteration():
    result = analyze(
        "habitacion sala(5, 4, 3) { mesa item {} "
        "repetir 1 { mover item [1, 0, 1]>> } }",
        file="ubicacion.lumi",
    )

    diagnostic, = result.diagnostics
    assert diagnostic.code == "SPA_ELEMENT_NOT_PLACED"
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "ubicacion.lumi", 1, 53,
    )


def test_conditions_inside_loops_and_loops_inside_conditions_compose():
    inner_condition = analyze(
        "habitacion sala(5, 4, 3) { repetir 1 { si verdadero { mesa item {} } "
        "sino { silla item {} } } rotar item [0, 90, 0]>> }"
    )
    inner_loop = analyze(
        "habitacion sala(5, 4, 3) { si verdadero { repetir 1 { mesa item {} } } "
        "sino { repetir 1 { silla item {} } } rotar item [0, 90, 0]>> }"
    )

    assert inner_condition.succeeded
    assert inner_loop.succeeded
