import pytest

from lumi_language.diagnostics import DiagnosticCategory
from lumi_language.interpreter import Interpreter
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser
from spatial.scene_plan import SourceLocation


def parse_source(source: str, file: str = "principal.lumi"):
    return Parser(Lexer(source, file).tokenize()).parse()


def execute(source: str, file: str = "principal.lumi"):
    return Interpreter().execute(parse_source(source, file))


def test_declares_generic_object_with_separate_type_and_name():
    result = execute("habitacion sala(5, 4, 3) { silla silla1 { } }")

    assert result.succeeded
    element = result.scene_plan.rooms[0].elements[0]
    assert (element.element_kind, element.object_type, element.name) == (
        "object",
        "silla",
        "silla1",
    )


@pytest.mark.parametrize(
    "declaration, expected_kind",
    [
        ("piso piso1 { }", "floor"),
        ("pared norte { }", "wall"),
        ("puerta entrada { }", "door"),
        ("ventana ventana1 { }", "window"),
    ],
)
def test_declares_reserved_spatial_elements(declaration, expected_kind):
    result = execute(f"habitacion sala(5, 4, 3) {{ {declaration} }}")

    assert result.succeeded
    element = result.scene_plan.rooms[0].elements[0]
    assert element.element_kind == expected_kind
    assert element.object_type is None


def test_evaluates_color_and_material_properties():
    result = execute(
        'texto acabado = "madera">> '
        "habitacion sala(5, 4, 3) { "
        'mesa mesa1 { color "rojo">> material acabado>> } }'
    )

    assert result.succeeded
    properties = result.scene_plan.rooms[0].elements[0].properties
    assert tuple((item.name, item.value) for item in properties) == (
        ("color", "rojo"),
        ("material", "madera"),
    )


def test_places_element_at_initial_position():
    result = execute(
        "habitacion sala(5, 4, 3) { "
        "silla silla1 { } colocar silla1 [1, 0, 2]>> }"
    )

    position = result.scene_plan.rooms[0].elements[0].position
    assert result.succeeded
    assert (position.x.value, position.y.value, position.z.value) == (1, 0, 2)


def test_absolute_move_replaces_initial_position():
    result = execute(
        "habitacion sala(5, 4, 3) { silla silla1 { } "
        "colocar silla1 [1, 0, 2]>> mover silla1 [-2, 0, 3]>> }"
    )

    position = result.scene_plan.rooms[0].elements[0].position
    assert result.succeeded
    assert (position.x.value, position.y.value, position.z.value) == (-2, 0, 3)


def test_absolute_rotation_replaces_previous_rotation():
    result = execute(
        "habitacion sala(5, 4, 3) { silla silla1 { } "
        "rotar silla1 [0, 45, 0]>> rotar silla1 [0, 90, 0]>> }"
    )

    rotation = result.scene_plan.rooms[0].elements[0].rotation
    assert result.succeeded
    assert (rotation.x.value, rotation.y.value, rotation.z.value) == (0, 90, 0)


def test_allows_rotation_before_placement():
    result = execute(
        "habitacion sala(5, 4, 3) { silla silla1 { } "
        "rotar silla1 [0, 90, 0]>> colocar silla1 [1, 0, 2]>> }"
    )

    element = result.scene_plan.rooms[0].elements[0]
    assert result.succeeded
    assert element.position is not None
    assert element.rotation.y.value == 90


def test_evaluates_calculated_dimensions_coordinates_and_properties():
    result = execute(
        'decimal base = 2.0>> texto tono = "azul">> '
        "habitacion sala(base * 3, base + 2, 3) { "
        "mesa mesa1 { color tono>> } "
        "colocar mesa1 [base / 2, 0, -(base + 1)]>> }"
    )

    room = result.scene_plan.rooms[0]
    element = room.elements[0]
    assert result.succeeded
    assert (room.width.value, room.length.value) == (6.0, 4.0)
    assert element.properties[0].value == "azul"
    assert (element.position.x.value, element.position.z.value) == (1.0, -3.0)


def test_builds_multiple_elements_in_declaration_order():
    result = execute(
        "habitacion sala(5, 4, 3) { "
        "mesa mesa1 { } silla silla1 { } lampara lampara1 { } }"
    )

    assert result.succeeded
    assert tuple(
        element.name for element in result.scene_plan.rooms[0].elements
    ) == ("mesa1", "silla1", "lampara1")


def test_allows_same_element_name_in_different_rooms():
    result = execute(
        "habitacion sala(5, 4, 3) { silla silla1 { } } "
        "habitacion cocina(3, 2, 2.5) { silla silla1 { } }"
    )

    assert result.succeeded
    assert tuple(room.elements[0].name for room in result.scene_plan.rooms) == (
        "silla1",
        "silla1",
    )


@pytest.mark.parametrize(
    "room_body, failing_index, expected_description",
    [
        ("colocar fantasma [1, 0, 2]>>", 0, "no está declarado"),
        ("silla silla1 { } silla silla1 { }", 1, "ya está declarado"),
        (
            "silla silla1 { } colocar silla1 [1, 0, 2]>> "
            "colocar silla1 [3, 0, 4]>>",
            2,
            "ya tiene una posición inicial",
        ),
        (
            "silla silla1 { } mover silla1 [3, 0, 4]>>",
            1,
            "debe colocarse antes de moverlo",
        ),
    ],
)
def test_reports_spatial_builder_failures_at_instruction_location(
    room_body,
    failing_index,
    expected_description,
):
    program = parse_source(f"habitacion sala(5, 4, 3) {{ {room_body} }}")
    failing_node = program.statements[0].body[failing_index]

    result = Interpreter().execute(program)

    assert not result.succeeded
    assert result.scene_plan is None
    diagnostic = result.diagnostics[0]
    assert diagnostic.category is DiagnosticCategory.RUNTIME
    assert diagnostic.code == "RUN_SPATIAL_OPERATION_FAILED"
    assert expected_description in diagnostic.description
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        failing_node.file,
        failing_node.line,
        failing_node.column,
    )


def test_failed_operation_does_not_publish_partial_scene():
    result = execute(
        "habitacion sala(5, 4, 3) { silla silla1 { } "
        "colocar silla1 [1, 0, 2]>> colocar silla1 [3, 0, 4]>> }"
    )

    assert not result.succeeded
    assert result.scene_plan is None
    assert len(result.diagnostics) == 1


def test_preserves_element_property_vector_and_component_locations():
    program = parse_source(
        """habitacion sala(5, 4, 3) {
    mesa mesa1 {
        color "verde">>
    }
    colocar mesa1 [1 + 1, 0, 3]>>
}""",
        "escena.lumi",
    )
    declaration = program.statements[0].body[0]
    placement = program.statements[0].body[1]

    result = Interpreter().execute(program)

    element = result.scene_plan.rooms[0].elements[0]
    assert result.succeeded
    assert element.source == SourceLocation(
        declaration.file,
        declaration.line,
        declaration.column,
    )
    assert element.properties[0].source == SourceLocation(
        declaration.properties[0].file,
        declaration.properties[0].line,
        declaration.properties[0].column,
    )
    assert element.position.source == SourceLocation(
        placement.position.file,
        placement.position.line,
        placement.position.column,
    )
    assert element.position.x.source == SourceLocation(
        placement.position.x.file,
        placement.position.x.line,
        placement.position.x.column,
    )


def test_builds_elements_and_final_state_in_multiple_rooms():
    result = execute(
        "habitacion sala(5, 4, 3) { sofa sofa1 { } "
        "colocar sofa1 [0, 0, 1]>> } "
        "habitacion oficina(4, 3, 2.7) { escritorio escritorio1 { } "
        "rotar escritorio1 [0, 90, 0]>> "
        "colocar escritorio1 [1, 0, -1]>> }"
    )

    assert result.succeeded
    sala, oficina = result.scene_plan.rooms
    assert sala.elements[0].position.z.value == 1
    assert oficina.elements[0].position.z.value == -1
    assert oficina.elements[0].rotation.y.value == 90
