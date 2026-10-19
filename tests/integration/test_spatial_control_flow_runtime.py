from lumi_language.import_resolver import InMemoryImportResolver
from lumi_language.interpreter import Interpreter
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser


def parse_source(source: str, file: str = "principal.lumi", resolver=None):
    parser = Parser(Lexer(source, file).tokenize(), import_resolver=resolver)
    return parser, parser.parse()


def execute(source: str):
    _, program = parse_source(source)
    return Interpreter().execute(program)


def element(result, room_index: int = 0, element_index: int = 0):
    return result.scene_plan.rooms[room_index].elements[element_index]


def test_true_if_places_element():
    result = execute(
        "habitacion sala(5, 4, 3) { silla silla1 { } "
        "si verdadero { colocar silla1 [1, 0, 2]>> } }"
    )

    assert result.succeeded
    assert element(result).position.x.value == 1


def test_false_if_does_not_place_element():
    result = execute(
        "habitacion sala(5, 4, 3) { silla silla1 { } "
        "si falso { colocar silla1 [1, 0, 2]>> } }"
    )

    assert result.succeeded
    assert element(result).position is None


def test_else_executes_only_selected_branch():
    result = execute(
        "habitacion sala(5, 4, 3) { silla silla1 { } "
        "si falso { colocar silla1 [1, 0, 2]>> } "
        "sino { colocar silla1 [3, 0, 4]>> } }"
    )

    position = element(result).position
    assert result.succeeded
    assert (position.x.value, position.z.value) == (3, 4)


def test_switch_executes_only_selected_case():
    result = execute(
        'texto estilo = "industrial">> '
        "habitacion sala(5, 4, 3) { silla silla1 { } "
        "segun estilo { "
        'caso "minimalista": colocar silla1 [1, 0, 1]>> '
        'caso "industrial": colocar silla1 [2, 0, 2]>> '
        "defecto: colocar silla1 [3, 0, 3]>> } }"
    )

    position = element(result).position
    assert result.succeeded
    assert (position.x.value, position.z.value) == (2, 2)


def test_for_executes_repeated_absolute_moves_and_keeps_final_position():
    result = execute(
        "habitacion sala(8, 5, 3) { silla silla1 { } "
        "colocar silla1 [0, 0, 0]>> "
        "hacer entero i = 0; i < 4; i = i + 1 { "
        "mover silla1 [i, 0, i * 2]>> } }"
    )

    position = element(result).position
    assert result.succeeded
    assert (position.x.value, position.z.value) == (3, 6)


def test_while_executes_repeated_absolute_rotations_and_keeps_final_rotation():
    result = execute(
        "habitacion sala(5, 4, 3) { silla silla1 { } entero angulo = 0>> "
        "mientras angulo < 90 { angulo = angulo + 30>> "
        "rotar silla1 [0, angulo, 0]>> } }"
    )

    assert result.succeeded
    assert element(result).rotation.y.value == 90


def test_loop_variables_and_expressions_calculate_positions():
    result = execute(
        "decimal inicio = -2.0>> decimal separacion = 1.5>> "
        "habitacion sala(8, 5, 3) { mesa mesa1 { } "
        "colocar mesa1 [0, 0, 0]>> "
        "hacer entero i = 0; i < 3; i = i + 1 { "
        "mover mesa1 [inicio + i * separacion, 0, i + 1]>> } }"
    )

    position = element(result).position
    assert result.succeeded
    assert (position.x.value, position.z.value) == (1.0, 3)


def test_local_function_called_in_room_moves_active_room_element():
    result = execute(
        "funcion vacio centrar() { mover mesa1 [0, 0, 0]>> } "
        "habitacion sala(5, 4, 3) { mesa mesa1 { } "
        "colocar mesa1 [2, 0, 2]>> centrar()>> }"
    )

    position = element(result).position
    assert result.succeeded
    assert (position.x.value, position.z.value) == (0, 0)


def test_function_parameters_calculate_spatial_coordinates():
    result = execute(
        "funcion vacio ubicar(decimal base, decimal desplazamiento) { "
        "mover mesa1 [base + desplazamiento, 0, base * 2]>> } "
        "habitacion sala(8, 5, 3) { mesa mesa1 { } "
        "colocar mesa1 [0, 0, 0]>> ubicar(2, 1.5)>> }"
    )

    position = element(result).position
    assert result.succeeded
    assert (position.x.value, position.z.value) == (3.5, 4)


def test_numeric_function_calculates_room_dimensions():
    result = execute(
        "funcion decimal duplicar(decimal valor) { retornar valor * 2>> } "
        "habitacion sala(duplicar(3), duplicar(2), 2.7) { }"
    )

    room = result.scene_plan.rooms[0]
    assert result.succeeded
    assert (room.width.value, room.length.value) == (6, 4)


def test_multiple_rooms_keep_independent_final_states():
    result = execute(
        "habitacion sala(5, 4, 3) { silla item1 { } "
        "colocar item1 [1, 0, 1]>> mover item1 [2, 0, 2]>> } "
        "habitacion oficina(4, 3, 2.7) { mesa item1 { } "
        "rotar item1 [0, 90, 0]>> colocar item1 [-1, 0, -2]>> }"
    )

    sala_item = element(result, 0)
    oficina_item = element(result, 1)
    assert result.succeeded
    assert (sala_item.object_type, sala_item.position.x.value) == ("silla", 2)
    assert (oficina_item.object_type, oficina_item.position.x.value) == ("mesa", -1)
    assert oficina_item.rotation.y.value == 90


def test_boolean_controls_optional_placement():
    result = execute(
        "booleano incluir = verdadero>> booleano omitir = falso>> "
        "habitacion sala(5, 4, 3) { televisor tv1 { } alfombra alfombra1 { } "
        "si incluir { colocar tv1 [0, 1.5, -2]>> } "
        "si omitir { colocar alfombra1 [0, 0, 0]>> } }"
    )

    assert result.succeeded
    assert element(result, 0, 0).position is not None
    assert element(result, 0, 1).position is None


def test_second_place_in_loop_reports_spatial_failure():
    source = """habitacion sala(5, 4, 3) {
    silla silla1 { }
    hacer entero i = 0; i < 2; i = i + 1 {
        colocar silla1 [i, 0, 0]>>
    }
}"""
    _, program = parse_source(source)
    placement = program.statements[0].body[1].body[0]

    result = Interpreter().execute(program)

    assert not result.succeeded
    assert result.scene_plan is None
    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "RUN_SPATIAL_OPERATION_FAILED"
    assert "ya tiene una posición inicial" in diagnostic.description
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        placement.file,
        placement.line,
        placement.column,
    )


def test_spatial_failure_inside_function_keeps_operation_location():
    source = """funcion vacio colocar_fantasma() {
    colocar fantasma [1, 0, 2]>>
}
habitacion sala(5, 4, 3) {
    colocar_fantasma()>>
}"""
    _, program = parse_source(source)
    failed_operation = program.statements[0].body[0]

    result = Interpreter().execute(program)

    assert not result.succeeded
    assert result.scene_plan is None
    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "RUN_SPATIAL_OPERATION_FAILED"
    assert "no está declarado" in diagnostic.description
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        failed_operation.file,
        failed_operation.line,
        failed_operation.column,
    )


def test_spatial_failure_inside_loop_discards_scene_plan():
    result = execute(
        "habitacion sala(5, 4, 3) { silla silla1 { } "
        "hacer entero i = 0; i < 1; i = i + 1 { "
        "mover silla1 [i, 0, 0]>> } }"
    )

    assert not result.succeeded
    assert result.scene_plan is None
    assert result.diagnostics[0].code == "RUN_SPATIAL_OPERATION_FAILED"


def test_execution_after_failure_uses_fresh_scene_builder():
    interpreter = Interpreter()
    _, failed_program = parse_source(
        "habitacion fallida(5, 4, 3) { silla silla1 { } "
        "colocar silla1 [0, 0, 0]>> colocar silla1 [1, 0, 1]>> }"
    )
    _, valid_program = parse_source(
        "habitacion nueva(3, 2, 2.5) { mesa mesa1 { } }"
    )

    failed = interpreter.execute(failed_program)
    recovered = interpreter.execute(valid_program)

    assert failed.scene_plan is None
    assert recovered.succeeded
    assert tuple(room.name for room in recovered.scene_plan.rooms) == ("nueva",)
    assert tuple(item.name for item in recovered.scene_plan.rooms[0].elements) == (
        "mesa1",
    )


def test_imported_function_operates_on_active_room_builder():
    resolver = InMemoryImportResolver(
        {
            "espacial.lumi": (
                "funcion vacio mover_a(decimal x, decimal z) { "
                "mover silla1 [x, 0, z]>> }"
            )
        }
    )
    parser, program = parse_source(
        'importar "espacial.lumi" usar mover_a>> '
        "habitacion sala(5, 4, 3) { silla silla1 { } "
        "colocar silla1 [0, 0, 0]>> mover_a(3, -2)>> }",
        resolver=resolver,
    )

    result = Interpreter().execute(program, parser.imported_programs)

    position = element(result).position
    assert result.succeeded
    assert (position.x.value, position.z.value) == (3, -2)
