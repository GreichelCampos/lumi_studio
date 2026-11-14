import pytest

from lumi_language.interpreter import Interpreter
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser


def execute(source: str):
    program = Parser(Lexer(source, "geometria.lumi").tokenize()).parse()
    return Interpreter().execute(program)


def codes(result):
    return [diagnostic.code for diagnostic in result.diagnostics]


def test_valid_wall_door_and_window_geometry_succeeds():
    result = execute(
        'habitacion sala(6, 5, 3) { '
        'pared frente { orientacion "norte">> } '
        'puerta entrada { orientacion "norte">> ancho 0.9>> alto 2.1>> '
        'desplazamiento 0.5>> } '
        'ventana luz { orientacion "sur">> ancho 1.2>> alto 1.0>> '
        'desplazamiento 2.0>> elevacion 0.9>> } }'
    )

    assert result.succeeded

@pytest.mark.parametrize(
    "declaration",
    [
        'puerta entrada { orientacion "norte">> ancho 0>> alto 2>> desplazamiento 1>> }',
        'ventana luz { orientacion "sur">> ancho 1>> alto -1>> desplazamiento 1>> elevacion 1>> }',
    ],
)
def test_opening_dimensions_must_be_positive(declaration):
    result = execute(f"habitacion sala(6, 5, 3) {{ {declaration} }}")

    assert codes(result) == ["SPA_INVALID_PROPERTY"]


@pytest.mark.parametrize(
    "declaration",
    [
        'puerta entrada { orientacion "norte">> ancho 1>> alto 2>> desplazamiento 5.5>> }',
        'ventana luz { orientacion "este">> ancho 1>> alto 1.5>> desplazamiento 1>> elevacion 2>> }',
    ],
)
def test_openings_outside_wall_bounds_are_rejected(declaration):
    result = execute(f"habitacion sala(6, 5, 3) {{ {declaration} }}")

    assert codes(result) == ["SPA_OBJECT_OUT_OF_BOUNDS"]


def test_overlapping_openings_on_same_wall_are_rejected_at_second_declaration():
    result = execute(
        'habitacion sala(6, 5, 3) { '
        'puerta entrada { orientacion "norte">> ancho 1>> alto 2>> desplazamiento 1>> } '
        'ventana luz { orientacion "norte">> ancho 1>> alto 1>> '
        'desplazamiento 1.5>> elevacion 0.5>> } }'
    )

    assert codes(result) == ["SPA_OBJECT_COLLISION"]
    assert "luz" in result.diagnostics[0].description


def test_openings_that_only_touch_do_not_overlap():
    result = execute(
        'habitacion sala(6, 5, 3) { '
        'puerta entrada { orientacion "norte">> ancho 1>> alto 2>> desplazamiento 1>> } '
        'ventana luz { orientacion "norte">> ancho 1>> alto 1>> '
        'desplazamiento 2>> elevacion 1>> } }'
    )

    assert result.succeeded


def test_furniture_inside_room_with_rotation_succeeds():
    result = execute(
        'habitacion sala(6, 5, 3) { mesa mesa1 { } '
        'colocar mesa1 [0, 0, 0]>> rotar mesa1 [0, 45, 0]>> }'
    )

    assert result.succeeded


def test_furniture_outside_room_uses_real_catalog_dimensions():
    result = execute(
        'habitacion sala(6, 5, 3) { sofa sofa1 { } colocar sofa1 [2.5, 0, 0]>> }'
    )

    assert codes(result) == ["SPA_OBJECT_OUT_OF_BOUNDS"]


def test_rotated_furniture_collision_is_detected():
    result = execute(
        'habitacion sala(6, 5, 3) { '
        'mesa mesa1 { } mesa mesa2 { } '
        'colocar mesa1 [0, 0, 0]>> colocar mesa2 [0.8, 0, 0]>> '
        'rotar mesa2 [0, 45, 0]>> }'
    )

    assert codes(result) == ["SPA_OBJECT_COLLISION"]


def test_furniture_surface_contact_is_not_a_collision():
    result = execute(
        'habitacion sala(6, 5, 3) { '
        'mesa mesa1 { } mesa mesa2 { } '
        'colocar mesa1 [0, 0, 0]>> colocar mesa2 [1.2, 0, 0]>> }'
    )

    assert result.succeeded


def test_furniture_in_door_clearance_is_rejected():
    result = execute(
        'habitacion sala(6, 5, 3) { '
        'puerta entrada { orientacion "norte">> ancho 1>> alto 2>> desplazamiento 2.5>> } '
        'silla silla1 { } colocar silla1 [0, 0, -2.2]>> }'
    )

    assert codes(result) == ["SPA_BLOCKED_DOOR"]


def test_spatial_diagnostic_preserves_property_source_location():
    result = execute(
        'habitacion sala(6, 5, 3) {\n'
        'puerta entrada { orientacion "norte">> ancho 1>> alto 2>>\n'
        'desplazamiento 5.5>> } }'
    )

    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "SPA_OBJECT_OUT_OF_BOUNDS"
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "geometria.lumi",
        3,
        1,
    )


def test_incomplete_geometry_is_preserved_without_inventing_defaults():
    result = execute(
        'habitacion sala(6, 5, 3) { puerta entrada { orientacion "norte">> } }'
    )

    assert result.succeeded
