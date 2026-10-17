from dataclasses import asdict

import pytest

from lumi_language.lexer import Lexer
from lumi_language.parser import Parser
from spatial.scene_builder import SceneBuilder


def parse(source: str):
    return Parser(Lexer(source, "principal.lumi").tokenize()).parse()


def test_resolves_acceptance_room_from_parser_ast_without_mutating_it():
    program = parse("principal {\n    habitacion sala(5.0, 4.0, 2.7) {\n    }\n}")
    original = asdict(program)
    result = SceneBuilder().build(program)
    assert result.diagnostics == ()
    assert result.scene_plan is not None
    room = result.scene_plan.rooms[0]
    assert room.name == "sala"
    assert [room.width.value, room.length.value, room.height.value] == [5.0, 4.0, 2.7]
    assert (room.source.file, room.source.line, room.source.column) == ("principal.lumi", 2, 5)
    assert room.width.source.column == 21
    assert room.elements == ()
    assert result.resolved_room_ids == frozenset({id(program.statements[0].body[0])})
    assert asdict(program) == original


@pytest.mark.parametrize("width", ["0", "-5", '"cinco"', "verdadero", "1" + "0" * 310 + ".0"])
def test_reuses_spatial_validator_for_invalid_literal_dimensions(width):
    result = SceneBuilder().build(parse(f"principal {{ habitacion sala({width}, 4, 2.7) {{}} }}"))
    assert result.scene_plan is None
    assert result.diagnostics[0].code == "SPA_INVALID_DIMENSION"
    assert result.diagnostics[0].file == "principal.lumi"
    assert result.diagnostics[0].line == 1
    assert result.diagnostics[0].column > 1


@pytest.mark.parametrize("source", [
    "habitacion sala(5, 4, 2.7) {}",
    "principal { si falso { habitacion sala(5, 4, 2.7) {} } }",
    "funcion vacio crear() { habitacion sala(5, 4, 2.7) {} }",
    "principal { entero ancho = 5>> habitacion sala(ancho, 4, 2.7) {} }",
    'principal { habitacion sala(5, 4, 2.7) { silla asiento { color "rojo">> } } }',
])
def test_does_not_claim_to_resolve_spatial_constructs_outside_the_initial_subset(source):
    result = SceneBuilder().build(parse(source))
    assert result.scene_plan is None
    assert result.resolved_room_ids == frozenset()


def test_resolves_multiple_direct_rooms_in_source_order_and_can_be_reused():
    builder = SceneBuilder()
    result = builder.build(parse("principal { habitacion primera(3, 4, 2) {} habitacion segunda(7, 6, 3) {} }"))
    assert [room.name for room in result.scene_plan.rooms] == ["primera", "segunda"]
    assert builder.build(parse("principal {} ")).scene_plan is None
