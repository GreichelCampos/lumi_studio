"""Architectural resources across mutually exclusive and repeated routes."""

import pytest

from lumi_language.lexer import Lexer
from lumi_language.parser import Parser
from lumi_language.semantic_analyzer import SemanticAnalyzer


def analyze(source: str, file: str = "arquitectura_control.lumi"):
    program = Parser(Lexer(source, file).tokenize(), file=file).parse()
    return SemanticAnalyzer().analyze(program)


def codes(result):
    return [item.code for item in result.diagnostics]


@pytest.mark.parametrize(
    "source",
    [
        (
            "si verdadero { habitacion sala(5, 4, 3) {} } "
            "sino { habitacion sala(6, 5, 3) {} }"
        ),
        (
            "habitacion sala(5, 4, 3) { si verdadero { piso uno {} } "
            "sino { piso dos {} } }"
        ),
        (
            'habitacion sala(5, 4, 3) { si verdadero { pared uno { '
            'orientacion "norte">> } } sino { pared dos { '
            'orientacion "norte">> } } }'
        ),
        (
            "habitacion sala(5, 4, 3) { puerta entrada { "
            'orientacion "norte">> ancho 1>> alto 2>> desplazamiento 0>> } '
            "puerta salida { orientacion \"norte\">> ancho 1>> alto 2>> "
            "desplazamiento 2>> } }"
        ),
    ],
)
def test_exclusive_or_repeatable_architectural_resources_do_not_conflict(source):
    assert analyze(source).succeeded


@pytest.mark.parametrize(
    "source, expected, line",
    [
        (
            "si verdadero {\n  habitacion sala(5, 4, 3) {}\n"
            "  habitacion sala(6, 5, 3) {}\n}",
            "SPA_DUPLICATE_ROOM",
            3,
        ),
        (
            "habitacion sala(5, 4, 3) {\n  si verdadero {\n"
            "    piso uno {}\n    piso dos {}\n  }\n}",
            "SPA_MULTIPLE_FLOORS",
            4,
        ),
        (
            'habitacion sala(5, 4, 3) {\n  si verdadero {\n'
            '    pared uno { orientacion "norte">> }\n'
            '    pared dos { orientacion "norte">> }\n  }\n}',
            "SEM_DUPLICATE_WALL_ORIENTATION",
            4,
        ),
    ],
)
def test_duplicate_confined_to_one_optional_route_is_not_blocking(
    source, expected, line,
):
    result = analyze(source, "ruta.lumi")

    assert expected not in codes(result)
    assert result.succeeded


@pytest.mark.parametrize(
    "source",
    [
        (
            "habitacion sala(5, 4, 3) {} "
            "si verdadero { habitacion sala(6, 5, 3) {} }"
        ),
        (
            "habitacion sala(5, 4, 3) { piso base {} "
            "si verdadero { piso posible {} } }"
        ),
        (
            'habitacion sala(5, 4, 3) { pared base { orientacion "norte">> } '
            'si verdadero { pared posible { orientacion "norte">> } } }'
        ),
    ],
)
def test_duplicate_against_entry_state_of_optional_route_is_not_blocking(source):
    assert analyze(source).succeeded


def test_switch_without_default_includes_the_no_effect_route():
    result = analyze(
        "segun 1 { caso 1: habitacion sala(5, 4, 3) {} } "
        "habitacion sala(6, 5, 3) {}"
    )

    assert result.succeeded


@pytest.mark.parametrize(
    "source, expected",
    [
        (
            "si verdadero { habitacion sala(5, 4, 3) {} } "
            "sino { habitacion sala(6, 5, 3) {} } "
            "habitacion sala(7, 6, 3) {}",
            "SPA_DUPLICATE_ROOM",
        ),
        (
            "habitacion sala(5, 4, 3) { si verdadero { piso uno {} } "
            "sino { piso dos {} } piso tres {} }",
            "SPA_MULTIPLE_FLOORS",
        ),
        (
            'habitacion sala(5, 4, 3) { si verdadero { pared uno { '
            'orientacion "norte">> } } sino { pared dos { '
            'orientacion "norte">> } } pared tres { '
            'orientacion "norte">> } }',
            "SEM_DUPLICATE_WALL_ORIENTATION",
        ),
    ],
)
def test_resource_present_on_every_route_is_definite_after_join(source, expected):
    result = analyze(source)

    assert codes(result).count(expected) == 1


@pytest.mark.parametrize(
    "source, expected",
    [
        (
            "si verdadero { habitacion sala(5, 4, 3) {} "
            "habitacion sala(6, 5, 3) {} } sino { "
            "habitacion sala(5, 4, 3) {} habitacion sala(6, 5, 3) {} }",
            "SPA_DUPLICATE_ROOM",
        ),
        (
            "habitacion sala(5, 4, 3) { si verdadero { piso uno {} "
            "piso dos {} } sino { piso tres {} piso cuatro {} } }",
            "SPA_MULTIPLE_FLOORS",
        ),
        (
            'habitacion sala(5, 4, 3) { si verdadero { pared uno { '
            'orientacion "norte">> } pared dos { orientacion "norte">> } } '
            'sino { pared tres { orientacion "norte">> } pared cuatro { '
            'orientacion "norte">> } } }',
            "SEM_DUPLICATE_WALL_ORIENTATION",
        ),
    ],
)
def test_same_architectural_error_on_every_route_is_blocking(source, expected):
    result = analyze(source)

    assert codes(result).count(expected) == 2


@pytest.mark.parametrize(
    "source, expected",
    [
        ("habitacion sala(5, 4, 3) {}", "SPA_DUPLICATE_ROOM"),
        (
            "habitacion sala(5, 4, 3) { repetir 2 { piso suelo {} } }",
            "SPA_MULTIPLE_FLOORS",
        ),
        (
            'habitacion sala(5, 4, 3) { repetir 2 { pared norte { '
            'orientacion "norte">> } } }',
            "SEM_DUPLICATE_WALL_ORIENTATION",
        ),
    ],
)
def test_required_repeat_reports_architectural_duplicate(source, expected):
    wrapped = (
        f"repetir 2 {{ {source} }}"
        if source == "habitacion sala(5, 4, 3) {}"
        else source
    )
    result = analyze(wrapped)

    assert expected in codes(result)
    assert codes(result).count(expected) == 1


@pytest.mark.parametrize(
    "resource",
    [
        "habitacion sala(5, 4, 3) {}",
        "habitacion sala(5, 4, 3) { piso suelo {} }",
        'habitacion sala(5, 4, 3) { pared norte { orientacion "norte">> } }',
    ],
)
def test_optional_while_does_not_report_possible_architectural_duplicate(resource):
    result = analyze(f"booleano seguir = verdadero>> mientras seguir {{ {resource} }}")

    assert result.succeeded


def test_nested_condition_and_loop_keep_local_validation_and_terminate():
    result = analyze(
        'repetir 999999999999999999999999 { si verdadero { '
        'habitacion sala(5, 4, 3) { pared norte { color 1>> } } } }'
    )

    assert codes(result).count("SEM_SPATIAL_PROPERTY_TYPE_MISMATCH") == 1
    assert codes(result).count("SEM_MISSING_SPATIAL_PROPERTY") == 1
