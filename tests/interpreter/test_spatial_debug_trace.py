from dataclasses import FrozenInstanceError

import pytest

from lumi_language.import_resolver import InMemoryImportResolver
from lumi_language.interpreter import Interpreter
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser


def parse_source(source: str, file: str = "principal.lumi", resolver=None):
    parser = Parser(Lexer(source, file).tokenize(), import_resolver=resolver)
    return parser, parser.parse()


def execute(source: str, *, interpreter=None, file="principal.lumi"):
    _, program = parse_source(source, file)
    return (interpreter or Interpreter()).execute(program)


def event_types(result):
    return [step.event_type for step in result.spatial_trace.steps]


def test_records_spatial_operations_in_execution_order_with_locations():
    source = """habitacion sala(10, 10, 3) {
    silla silla1 { }
    colocar silla1 [1, 0, 1]>>
    mover silla1 [2, 0, 2]>>
    rotar silla1 [0, 90, 0]>>
}"""

    result = execute(source, file="orden.lumi")

    assert result.succeeded
    assert result.spatial_trace.complete
    assert event_types(result) == [
        "start",
        "room_create",
        "declaration",
        "place_object",
        "move_object",
        "rotate_object",
        "end",
    ]
    assert [step.index for step in result.spatial_trace.steps] == list(range(7))
    assert [step.source.line for step in result.spatial_trace.steps[1:-1]] == [
        1,
        2,
        3,
        4,
        5,
    ]
    assert all(
        step.source.file == "orden.lumi" for step in result.spatial_trace.steps
    )
    operation = result.spatial_trace.steps[3]
    assert operation.room_name == "sala"
    assert operation.element_name == "silla1"
    assert operation.description
    assert result.spatial_trace.steps[-1].scene_snapshot == result.scene_plan


def test_function_events_use_the_shared_builder_without_reexecution():
    source = """funcion vacio preparar() {
    colocar silla1 [1, 0, 1]>>
    mover silla1 [3, 0, 2]>>
}
habitacion sala(10, 10, 3) {
    silla silla1 { }
    preparar()>>
}"""

    result = execute(source)

    assert result.succeeded
    assert event_types(result).count("place_object") == 1
    assert event_types(result).count("move_object") == 1
    assert result.spatial_trace.steps[3].source.line == 2
    assert result.spatial_trace.steps[4].source.line == 3


def test_cycles_record_each_effect_and_false_branch_records_none():
    source = """habitacion sala(12, 12, 3) {
    silla silla1 { }
    colocar silla1 [0, 0, 0]>>
    entero angulo = 0>>
    mientras angulo < 90 {
        angulo = angulo + 30>>
        rotar silla1 [0, angulo, 0]>>
    }
    si falso { mover silla1 [4, 0, 4]>> }
}"""

    result = execute(source)

    assert result.succeeded
    assert event_types(result).count("rotate_object") == 3
    assert "move_object" not in event_types(result)
    rotation_steps = [
        step
        for step in result.spatial_trace.steps
        if step.event_type == "rotate_object"
    ]
    assert [
        step.scene_snapshot.rooms[0].elements[0].rotation.y.value
        for step in rotation_steps
    ] == [30, 60, 90]


def test_imported_function_event_preserves_imported_source_file():
    resolver = InMemoryImportResolver(
        {
            "operaciones.lumi": (
                "funcion vacio ubicar() {\n"
                "    colocar silla1 [1, 0, 1]>>\n"
                "}"
            )
        }
    )
    parser, program = parse_source(
        'importar "operaciones.lumi" usar ubicar>>\n'
        "habitacion sala(8, 8, 3) {\n"
        "    silla silla1 { }\n"
        "    ubicar()>>\n"
        "}",
        resolver=resolver,
    )

    result = Interpreter().execute(program, parser.imported_programs)

    assert result.succeeded
    place_step = next(
        step
        for step in result.spatial_trace.steps
        if step.event_type == "place_object"
    )
    assert place_step.source.file == "operaciones.lumi"
    assert place_step.source.line == 2
    assert place_step.room_name == "sala"


def test_snapshots_remain_immutable_and_independent_after_later_operations():
    result = execute(
        "habitacion sala(10, 10, 3) { silla silla1 { } "
        "colocar silla1 [1, 0, 1]>> mover silla1 [2, 0, 2]>> }"
    )

    declaration = result.spatial_trace.steps[2].scene_snapshot
    placement = result.spatial_trace.steps[3].scene_snapshot
    movement = result.spatial_trace.steps[4].scene_snapshot

    assert declaration.rooms[0].elements[0].position is None
    assert placement.rooms[0].elements[0].position.x.value == 1
    assert movement.rooms[0].elements[0].position.x.value == 2
    with pytest.raises(FrozenInstanceError):
        placement.rooms[0].name = "otra"


def test_multiple_rooms_are_visible_in_subsequent_snapshots():
    result = execute(
        "habitacion sala(8, 8, 3) { } "
        "habitacion estudio(6, 6, 3) { mesa mesa1 { } }"
    )

    room_steps = [
        step
        for step in result.spatial_trace.steps
        if step.event_type == "room_create"
    ]
    assert [step.room_name for step in room_steps] == ["sala", "estudio"]
    assert [room.name for room in room_steps[1].scene_snapshot.rooms] == [
        "sala",
        "estudio",
    ]


def test_reusing_interpreter_does_not_share_trace_or_scene_state():
    interpreter = Interpreter()
    first = execute(
        "habitacion sala(8, 8, 3) { silla silla1 { } }",
        interpreter=interpreter,
    )
    second = execute("mostrar(1)>>", interpreter=interpreter)

    assert "declaration" in event_types(first)
    assert event_types(second) == ["start", "end"]
    assert second.scene_plan.rooms == ()
    assert first.spatial_trace is not second.spatial_trace


def test_failed_execution_does_not_publish_partial_trace():
    result = execute(
        "habitacion sala(8, 8, 3) { silla silla1 { } "
        "colocar silla1 [1, 0, 1]>> colocar silla1 [2, 0, 2]>> }"
    )

    assert not result.succeeded
    assert result.scene_plan is None
    assert not result.spatial_trace.complete
    assert result.spatial_trace.unavailable_reason == "execution_failed"
    assert result.spatial_trace.steps == ()


def test_step_limit_marks_trace_unavailable_without_stopping_execution():
    interpreter = Interpreter(max_spatial_trace_steps=3)

    result = execute(
        "habitacion sala(8, 8, 3) { silla silla1 { } "
        "colocar silla1 [1, 0, 1]>> }",
        interpreter=interpreter,
    )

    assert result.succeeded
    assert result.scene_plan.rooms[0].elements[0].position is not None
    assert not result.spatial_trace.complete
    assert result.spatial_trace.unavailable_reason == "step_limit_exceeded"
    assert result.spatial_trace.steps == ()


def test_non_spatial_program_has_only_execution_boundary_events():
    result = execute('mostrar("hola")>>')

    assert result.succeeded
    assert result.output == ["hola"]
    assert event_types(result) == ["start", "end"]
    assert all(
        step.scene_snapshot.rooms == () for step in result.spatial_trace.steps
    )


def test_invalid_trace_limit_is_rejected():
    with pytest.raises(ValueError, match="max_spatial_trace_steps"):
        Interpreter(max_spatial_trace_steps=0)
