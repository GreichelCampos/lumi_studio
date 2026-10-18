from lumi_language.diagnostics import DiagnosticCategory
from lumi_language.interpreter import Interpreter
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser


def parse_source(source: str, file: str = "principal.lumi"):
    return Parser(Lexer(source, file).tokenize()).parse()


def execute(source: str, file: str = "principal.lumi"):
    return Interpreter().execute(parse_source(source, file))


def test_validates_a_valid_room_automatically():
    result = execute("habitacion sala(5, 4, 3) { }")

    assert result.succeeded
    assert result.diagnostics == []
    assert result.scene_plan is not None
    assert tuple(room.name for room in result.scene_plan.rooms) == ("sala",)


def test_reports_zero_and_negative_dimensions_and_preserves_scene_plan():
    result = execute("habitacion sala(0, -4, 3) { }")

    assert not result.succeeded
    assert result.scene_plan is not None
    assert [diagnostic.code for diagnostic in result.diagnostics] == [
        "SPA_INVALID_DIMENSION",
        "SPA_INVALID_DIMENSION",
    ]
    assert all(
        diagnostic.category is DiagnosticCategory.SPATIAL
        for diagnostic in result.diagnostics
    )


def test_reports_non_numeric_vector_components_representable_in_lumi():
    result = execute(
        'habitacion sala(5, 4, 3) { silla silla1 { } '
        'colocar silla1 ["izquierda", verdadero, 0]>> }'
    )

    assert not result.succeeded
    assert result.scene_plan is not None
    assert [diagnostic.code for diagnostic in result.diagnostics] == [
        "SPA_INVALID_VECTOR",
        "SPA_INVALID_VECTOR",
    ]


def test_reports_invalid_color_and_material_values_representable_in_lumi():
    result = execute(
        "habitacion sala(5, 4, 3) { "
        "mesa mesa1 { color 7>> material falso>> } }"
    )

    assert not result.succeeded
    assert result.scene_plan is not None
    assert [diagnostic.code for diagnostic in result.diagnostics] == [
        "SPA_INVALID_PROPERTY",
        "SPA_INVALID_PROPERTY",
    ]


def test_accumulates_dimension_vector_and_property_diagnostics_in_order():
    result = execute(
        'habitacion sala(0, -4, 3) { '
        'silla silla1 { color 7>> } '
        'colocar silla1 ["x", verdadero, 0]>> }'
    )

    assert not result.succeeded
    assert result.scene_plan is not None
    assert [diagnostic.code for diagnostic in result.diagnostics] == [
        "SPA_INVALID_DIMENSION",
        "SPA_INVALID_DIMENSION",
        "SPA_INVALID_VECTOR",
        "SPA_INVALID_VECTOR",
        "SPA_INVALID_PROPERTY",
    ]


def test_preserves_exact_source_locations_for_spatial_diagnostics():
    program = parse_source(
        """habitacion sala(
    0,
    4,
    3
) {
    mesa mesa1 {
        color 7>>
    }
    colocar mesa1 ["x", 0, 0]>>
}""",
        "ubicaciones.lumi",
    )
    room_node = program.statements[0]
    property_node = room_node.body[0].properties[0]
    vector_component = room_node.body[1].position.x

    result = Interpreter().execute(program)

    assert [diagnostic.code for diagnostic in result.diagnostics] == [
        "SPA_INVALID_DIMENSION",
        "SPA_INVALID_VECTOR",
        "SPA_INVALID_PROPERTY",
    ]
    expected_locations = [
        (room_node.width.file, room_node.width.line, room_node.width.column),
        (
            vector_component.file,
            vector_component.line,
            vector_component.column,
        ),
        (
            property_node.file,
            property_node.line,
            property_node.column,
        ),
    ]
    assert [
        (diagnostic.file, diagnostic.line, diagnostic.column)
        for diagnostic in result.diagnostics
    ] == expected_locations


def test_runtime_failure_skips_spatial_validation_and_discards_scene_plan():
    result = execute("habitacion sala(0, 4, 3) { mostrar(1 / 0)>> }")

    assert not result.succeeded
    assert result.scene_plan is None
    assert [diagnostic.code for diagnostic in result.diagnostics] == [
        "RUN_DIVISION_BY_ZERO"
    ]


def test_builder_failure_remains_a_runtime_diagnostic_without_scene_plan():
    result = execute(
        "habitacion sala(5, 4, 3) { silla silla1 { } "
        "mover silla1 [1, 0, 2]>> }"
    )

    assert not result.succeeded
    assert result.scene_plan is None
    assert len(result.diagnostics) == 1
    assert result.diagnostics[0].category is DiagnosticCategory.RUNTIME
    assert result.diagnostics[0].code == "RUN_SPATIAL_OPERATION_FAILED"
    assert "debe colocarse antes de moverlo" in result.diagnostics[0].description


def test_reused_interpreter_does_not_retain_spatial_diagnostics():
    interpreter = Interpreter()

    invalid = interpreter.execute(parse_source("habitacion sala(0, 4, 3) { }"))
    valid = interpreter.execute(parse_source("habitacion cocina(3, 2, 2.5) { }"))

    assert not invalid.succeeded
    assert invalid.scene_plan is not None
    assert valid.succeeded
    assert valid.diagnostics == []
    assert tuple(room.name for room in valid.scene_plan.rooms) == ("cocina",)


def test_program_without_rooms_produces_a_valid_empty_scene_plan():
    result = execute("mostrar(2 + 3)>>")

    assert result.succeeded
    assert result.scene_plan is not None
    assert result.scene_plan.rooms == ()


def test_negative_and_zero_coordinates_remain_valid():
    result = execute(
        "habitacion sala(5, 4, 3) { silla silla1 { } "
        "colocar silla1 [-2, 0, 3]>> rotar silla1 [0, -90, 0]>> }"
    )

    assert result.succeeded
    assert result.diagnostics == []
    element = result.scene_plan.rooms[0].elements[0]
    assert (element.position.x.value, element.position.y.value) == (-2, 0)
    assert element.rotation.y.value == -90


def test_accumulates_errors_from_multiple_rooms_independently():
    result = execute(
        "habitacion sala(0, 4, 3) { } "
        "habitacion cocina(3, -2, 2.5) { }"
    )

    assert not result.succeeded
    assert result.scene_plan is not None
    assert tuple(room.name for room in result.scene_plan.rooms) == (
        "sala",
        "cocina",
    )
    assert [diagnostic.code for diagnostic in result.diagnostics] == [
        "SPA_INVALID_DIMENSION",
        "SPA_INVALID_DIMENSION",
    ]
    assert "'sala'" in result.diagnostics[0].description
    assert "'cocina'" in result.diagnostics[1].description
