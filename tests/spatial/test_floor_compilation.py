from dataclasses import asdict, replace

import pytest

from lumi_language.lexer import Lexer
from lumi_language.parser import Parser
from services.compiler_service import CompilerService
from services.protocol.dispatcher import RequestDispatcher
from services.protocol.scene_adapter import scene_plan_dto
from services.results import CompilationStatus
from spatial.scene_builder import SceneBuilder


def source(body):
    return f"principal {{\n    habitacion cocina(8,6,3) {{\n        {body}\n    }}\n}}"


def compile_floor(body):
    return CompilerService().compile(source(body), "principal.lumi")


def test_resolves_floor_properties_and_locations_without_mutating_ast():
    program = Parser(Lexer(source('piso suelo { material "madera">> color "#C8A27A">> }'), "principal.lumi").tokenize()).parse()
    original = asdict(program)
    result = SceneBuilder().build(program)
    assert result.diagnostics == ()
    floor = result.scene_plan.rooms[0].elements[0]
    assert (floor.name, floor.element_kind, floor.object_type) == ("suelo", "floor", None)
    assert [(prop.name, prop.value) for prop in floor.properties] == [("material", "madera"), ("color", "#C8A27A")]
    assert (floor.source.file, floor.source.line, floor.source.column) == ("principal.lumi", 3, 9)
    assert all(prop.source.line == 3 and prop.source.column > 9 for prop in floor.properties)
    assert floor.position is floor.rotation is None
    assert asdict(program) == original


@pytest.mark.parametrize("properties,expected", [
    ('material "madera">> color "#C8A27A">>', {"material": "madera", "color": "#C8A27A"}),
    ('color "azul">> material "metal">>', {"material": "metal", "color": "azul"}),
    ('material "madera">>', {"material": "madera", "color": "#e2e8f0"}),
    ('color "rojo">>', {"material": "standard", "color": "rojo"}),
    ('', {"material": "standard", "color": "#e2e8f0"}),
])
def test_reuses_existing_exchange_floor_and_visual_defaults(properties, expected):
    result = compile_floor(f"piso suelo {{ {properties} }}")
    assert result.status is CompilationStatus.COMPLETED
    assert result.limitations == ()
    room = scene_plan_dto(result.scene_plan)["rooms"][0]
    assert room["floor"] == expected
    assert room["dimensions"] == [8, 6, 3]
    assert room["calculatedArea"] == 48
    assert room["calculatedVolume"] == 144


@pytest.mark.parametrize("properties", ['color 42>>', 'material falso>>', 'color nulo>>'])
def test_reuses_spatial_property_validation_before_publishing_scene(properties):
    result = compile_floor(f"piso suelo {{ {properties} }}")
    assert result.status is CompilationStatus.FAILED
    assert result.scene_plan is None
    assert result.diagnostics[0].code == "SPA_INVALID_PROPERTY"
    assert result.diagnostics[0].file == "principal.lumi"
    assert result.diagnostics[0].line == 3


@pytest.mark.parametrize("body", [
    'piso suelo { color "ro" + "jo">> }',
    'piso primero {} piso segundo {}',
    'piso suelo {} pared pared1 { color "blanco">> }',
    'piso suelo {} puerta entrada {}',
    'piso suelo {} silla asiento {}',
])
def test_unresolved_floor_expressions_and_spatial_data_never_publish_partial_scene(body):
    result = compile_floor(body)
    assert result.status is CompilationStatus.INCOMPLETE
    assert result.scene_plan is None
    assert result.limitations


def test_two_rooms_keep_independent_floor_styles_and_invalid_recompile_drops_scene():
    compiler = CompilerService()
    result = compiler.compile(
        'principal { habitacion primera(3,4,2) { piso suelo { color "rojo">> } } '
        'habitacion segunda(7,6,3) { piso suelo { material "madera">> } } }', "principal.lumi",
    )
    rooms = scene_plan_dto(result.scene_plan)["rooms"]
    assert rooms[0]["floor"]["color"] == "rojo"
    assert rooms[1]["floor"]["material"] == "madera"
    failed = compiler.compile(source('piso suelo { color 42>> }'), "principal.lumi")
    assert failed.scene_plan is None


def test_adapter_rejects_unhandled_elements_instead_of_silently_discarding_them():
    scene = compile_floor('piso suelo {}').scene_plan
    room = scene.rooms[0]
    wall = replace(room.elements[0], element_kind="wall")
    with pytest.raises(ValueError):
        scene_plan_dto(replace(scene, rooms=(replace(room, elements=(wall,)),)))


def test_worker_protocol_delivers_floor_without_changing_shared_contract():
    response = RequestDispatcher().dispatch({
        "protocolVersion": "1.0.0", "requestId": "floor", "operation": "analyze",
        "entryFile": "principal.lumi", "files": {"principal.lumi": source('piso suelo { material "madera">> color "#C8A27A">> }')},
    })
    assert response["status"] == "completed"
    assert response["result"]["capabilities"]["scenePlan"] is True
    assert response["result"]["capabilities"]["debugTrace"] is False
    assert response["result"]["scenePlan"]["rooms"][0]["floor"] == {"material": "madera", "color": "#C8A27A"}
