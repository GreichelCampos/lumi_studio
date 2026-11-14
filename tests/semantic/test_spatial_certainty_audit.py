"""Program-wide certainty rules for cumulative spatial failures."""

import pytest

from lumi_language.lexer import Lexer
from lumi_language.parser import Parser
from lumi_language.semantic_analyzer import SemanticAnalyzer


def analyze(source: str, file: str = "certeza.lumi"):
    program = Parser(Lexer(source, file).tokenize(), file=file).parse()
    return SemanticAnalyzer().analyze(program)


def codes(result):
    return [item.code for item in result.diagnostics]


@pytest.mark.parametrize(
    "control",
    [
        "si falso { mover fantasma [0, 0, 0]>> }",
        "segun 1 { caso 1: mover fantasma [0, 0, 0]>> }",
        (
            "segun 1 { caso 1: mover fantasma [0, 0, 0]>> "
            "defecto: mostrar(1)>> }"
        ),
    ],
)
def test_cumulative_error_confined_to_optional_route_is_not_reported(control):
    result = analyze(f"habitacion sala(5, 4, 3) {{ {control} }}")

    assert result.succeeded


@pytest.mark.parametrize(
    "control",
    [
        (
            "si verdadero { mover fantasma [0, 0, 0]>> } "
            "sino { mover fantasma [1, 0, 0]>> }"
        ),
        (
            "segun 1 { caso 1: mover fantasma [0, 0, 0]>> "
            "defecto: mover fantasma [1, 0, 0]>> }"
        ),
    ],
)
def test_same_cumulative_error_on_every_route_reports_each_real_location(control):
    result = analyze(
        f"habitacion sala(5, 4, 3) {{ {control} }}", "rutas.lumi",
    )

    assert codes(result) == ["SPA_ELEMENT_NOT_FOUND", "SPA_ELEMENT_NOT_FOUND"]
    assert all(item.file == "rutas.lumi" for item in result.diagnostics)
    assert len({item.column for item in result.diagnostics}) == 2


def test_different_failure_causes_across_routes_are_not_chosen_arbitrarily():
    result = analyze(
        "habitacion sala(5, 4, 3) { mesa item {} "
        "si verdadero { mover item [0, 0, 0]>> } "
        "sino { mover fantasma [1, 0, 0]>> } }"
    )

    assert result.succeeded


def test_local_error_remains_reported_inside_optional_route():
    result = analyze(
        "habitacion sala(5, 4, 3) { si falso { "
        "mesa item { color 1>> } mover fantasma [0, 0, 0]>> } }"
    )

    assert codes(result) == ["SEM_SPATIAL_PROPERTY_TYPE_MISMATCH"]


def test_nested_optional_routes_do_not_leak_cumulative_diagnostics():
    result = analyze(
        "habitacion sala(5, 4, 3) { repetir 1 { si verdadero { "
        "segun 1 { caso 1: mover fantasma [0, 0, 0]>> } } } }"
    )

    assert result.succeeded


@pytest.mark.parametrize(
    "source, accumulated_code",
    [
        (
            "habitacion sala(5, 4, 3) { repetir 2 { "
            "mesa item { color faltante>> } } }",
            "SPA_DUPLICATE_ELEMENT",
        ),
        (
            "repetir 2 { habitacion sala(faltante, 4, 3) {} }",
            "SPA_DUPLICATE_ROOM",
        ),
        (
            "booleano seguir = verdadero>> habitacion sala(5, 4, 3) { "
            "mientras seguir { mesa item { color faltante>> } } }",
            None,
        ),
    ],
)
def test_repeated_transfer_does_not_invent_error_after_failed_inference(
    source, accumulated_code,
):
    result = analyze(source)

    assert codes(result).count("SEM_UNDECLARED_VARIABLE") == 1
    assert "SEM_SPATIAL_PROPERTY_TYPE_MISMATCH" not in codes(result)
    assert "SEM_SPATIAL_DIMENSION_NOT_NUMERIC" not in codes(result)
    if accumulated_code is not None:
        assert codes(result).count(accumulated_code) == 1
