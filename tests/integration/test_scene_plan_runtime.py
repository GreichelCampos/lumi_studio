from lumi_language.interpreter import Interpreter
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser
from spatial.scene_plan import SourceLocation


def parse_source(source: str, file: str = "principal.lumi"):
    return Parser(Lexer(source, file).tokenize()).parse()


def test_executes_one_room_into_scene_plan():
    result = Interpreter().execute(
        parse_source('habitacion sala(5, 4, 2.7) { mostrar("lista")>> }')
    )

    assert result.succeeded
    assert result.output == ["lista"]
    assert result.scene_plan is not None
    assert len(result.scene_plan.rooms) == 1
    room = result.scene_plan.rooms[0]
    assert room.name == "sala"
    assert (room.width.value, room.length.value, room.height.value) == (5, 4, 2.7)
    assert room.elements == ()


def test_executes_multiple_independent_rooms_in_order():
    result = Interpreter().execute(
        parse_source(
            "habitacion sala(5, 4, 2.7) { } "
            "habitacion cocina(3, 2, 2.5) { }"
        )
    )

    assert result.succeeded
    assert result.scene_plan is not None
    assert tuple(room.name for room in result.scene_plan.rooms) == (
        "sala",
        "cocina",
    )


def test_evaluates_room_dimension_expressions():
    result = Interpreter().execute(
        parse_source("habitacion sala(2 + 3, 8 / 2, 1.5 * 2) { }")
    )

    assert result.succeeded
    room = result.scene_plan.rooms[0]
    assert (room.width.value, room.length.value, room.height.value) == (5, 4, 3.0)


def test_evaluates_room_dimensions_from_variables():
    result = Interpreter().execute(
        parse_source(
            "decimal ancho = 6.5>> "
            "decimal largo = 4.5>> "
            "habitacion sala(ancho, largo, 2.7) { }"
        )
    )

    assert result.succeeded
    room = result.scene_plan.rooms[0]
    assert (room.width.value, room.length.value, room.height.value) == (
        6.5,
        4.5,
        2.7,
    )


def test_evaluates_room_dimension_from_numeric_function():
    result = Interpreter().execute(
        parse_source(
            "funcion decimal duplicar(decimal valor) { "
            "retornar valor * 2>> } "
            "habitacion sala(duplicar(3), 4, 2.7) { }"
        )
    )

    assert result.succeeded
    assert result.scene_plan.rooms[0].width.value == 6


def test_preserves_room_dimension_and_scene_source_locations():
    program = parse_source(
        """habitacion sala(
    2 + 3,
    4,
    2.7
) { }""",
        "ubicaciones.lumi",
    )
    room_node = program.statements[0]

    result = Interpreter().execute(program)

    assert result.succeeded
    scene = result.scene_plan
    room = scene.rooms[0]
    assert scene.source == SourceLocation(
        program.file,
        program.line,
        program.column,
    )
    assert room.source == SourceLocation(
        room_node.file,
        room_node.line,
        room_node.column,
    )
    assert room.width.source == SourceLocation(
        room_node.width.file,
        room_node.width.line,
        room_node.width.column,
    )


def test_existing_non_spatial_execution_remains_compatible():
    result = Interpreter().execute(parse_source("mostrar(2 + 3)>>"))

    assert result.succeeded
    assert result.output == ["5"]
    assert result.diagnostics == []
    assert result.scene_plan is not None
    assert result.scene_plan.rooms == ()


def test_reuses_interpreter_with_a_new_builder_for_each_execution():
    interpreter = Interpreter()

    first = interpreter.execute(parse_source("habitacion sala(5, 4, 3) { }"))
    second = interpreter.execute(parse_source("habitacion cocina(3, 2, 2.5) { }"))

    assert first.scene_plan is not second.scene_plan
    assert tuple(room.name for room in first.scene_plan.rooms) == ("sala",)
    assert tuple(room.name for room in second.scene_plan.rooms) == ("cocina",)


def test_reports_controlled_builder_error_without_successful_scene_plan():
    program = parse_source(
        "habitacion sala(5, 4, 3) { } "
        "habitacion sala(6, 5, 3) { }"
    )
    duplicate_room = program.statements[1]

    result = Interpreter().execute(program)

    assert not result.succeeded
    assert result.scene_plan is None
    assert len(result.diagnostics) == 1
    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "RUN_SPATIAL_OPERATION_FAILED"
    assert "ya fue construida" in diagnostic.description
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        duplicate_room.file,
        duplicate_room.line,
        duplicate_room.column,
    )


def test_runtime_failure_discards_active_room_and_next_execution_is_isolated():
    interpreter = Interpreter()
    failed = interpreter.execute(
        parse_source("habitacion sala(5, 4, 3) { mostrar(1 / 0)>> }")
    )

    recovered = interpreter.execute(
        parse_source("habitacion cocina(3, 2, 2.5) { }")
    )

    assert not failed.succeeded
    assert failed.scene_plan is None
    assert failed.diagnostics[0].code == "RUN_DIVISION_BY_ZERO"
    assert recovered.succeeded
    assert tuple(room.name for room in recovered.scene_plan.rooms) == ("cocina",)
