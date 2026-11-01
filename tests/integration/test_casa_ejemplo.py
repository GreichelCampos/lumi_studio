import json
from pathlib import Path

from services.execution_service import ExecutionService
from services.protocol.dispatcher import RequestDispatcher


EXAMPLE_DIR = Path(__file__).parents[2] / "examples" / "CasaEjemplo"


def load_sources() -> dict[str, str]:
    return {
        path.name: path.read_text(encoding="utf-8")
        for path in sorted(EXAMPLE_DIR.glob("*.lumi"))
    }


def execute_example():
    sources = load_sources()
    return ExecutionService().execute_source(
        sources["principal.lumi"],
        "principal.lumi",
        sources=sources,
    )


def room_named(scene_plan, name):
    return next(room for room in scene_plan.rooms if room.name == name)


def element_named(room, name):
    return next(element for element in room.elements if element.name == name)


def vector_values(vector):
    if vector is None:
        return None
    return (vector.x.value, vector.y.value, vector.z.value)


def test_casa_ejemplo_executes_without_diagnostics():
    result = execute_example()

    assert result.succeeded
    assert result.diagnostics == ()
    assert result.output == ("Area de sala:", "30.0")
    assert result.scene_plan is not None


def test_casa_ejemplo_builds_expected_rooms_and_final_furniture_state():
    result = execute_example()
    scene_plan = result.scene_plan

    assert scene_plan is not None
    assert tuple(room.name for room in scene_plan.rooms) == ("sala", "estudio")

    sala = room_named(scene_plan, "sala")
    assert (sala.width.value, sala.length.value, sala.height.value) == (
        6.0,
        5.0,
        3.0,
    )
    assert tuple(element.name for element in sala.elements) == (
        "suelo",
        "mesa_centro",
        "silla_lectura",
        "planta_ventana",
    )
    assert vector_values(element_named(sala, "mesa_centro").position) == (
        1.5,
        0,
        0.5,
    )
    assert vector_values(element_named(sala, "mesa_centro").rotation) == (
        0,
        90,
        0,
    )
    assert vector_values(element_named(sala, "silla_lectura").position) == (
        0,
        0,
        -1,
    )
    assert vector_values(element_named(sala, "planta_ventana").rotation) == (
        0,
        90,
        0,
    )

    estudio = room_named(scene_plan, "estudio")
    assert (estudio.width.value, estudio.length.value, estudio.height.value) == (
        4,
        3,
        2.6,
    )
    assert tuple(element.name for element in estudio.elements) == (
        "piso_estudio",
        "escritorio1",
    )
    assert vector_values(element_named(estudio, "escritorio1").position) == (
        0,
        0,
        0,
    )
    assert vector_values(element_named(estudio, "escritorio1").rotation) == (
        0,
        90,
        0,
    )


def test_casa_ejemplo_preserves_source_files_and_resolved_properties():
    scene_plan = execute_example().scene_plan

    assert scene_plan is not None
    sala = room_named(scene_plan, "sala")
    mesa = element_named(sala, "mesa_centro")
    properties = {item.name: item for item in mesa.properties}

    assert sala.source.file == "principal.lumi"
    assert mesa.source.file == "principal.lumi"
    assert properties["material"].value == "madera"
    assert properties["color"].value == "#8b5a2b"
    assert properties["material"].source.file == "principal.lumi"
    assert mesa.position is not None
    assert mesa.position.source.file == "muebles.lumi"
    assert mesa.rotation is not None
    assert mesa.rotation.source.file == "muebles.lumi"


def test_casa_ejemplo_protocol_serializes_real_scene_plan():
    sources = load_sources()
    response = RequestDispatcher().dispatch(
        {
            "protocolVersion": "1.0.0",
            "requestId": "l038-casa-ejemplo",
            "operation": "execute",
            "entryFile": "principal.lumi",
            "files": sources,
        }
    )

    assert response["status"] == "completed"
    assert response["result"]["output"] == ["Area de sala:", "30.0"]
    assert response["result"]["diagnostics"] == []
    assert response["result"]["capabilities"]["scenePlan"] is True

    scene_plan = response["result"]["scenePlan"]
    assert scene_plan["version"] == "1.0.0"
    assert [room["name"] for room in scene_plan["rooms"]] == [
        "sala",
        "estudio",
    ]
    assert scene_plan["rooms"][0]["dimensions"] == [6.0, 5.0, 3.0]
    assert scene_plan["rooms"][1]["dimensions"] == [4, 3, 2.6]

    sala_objects = {
        item["name"]: item for item in scene_plan["rooms"][0]["objects"]
    }
    assert sala_objects["mesa_centro"]["placed"] is True
    assert sala_objects["mesa_centro"]["position"] == [1.5, 0, 0.5]
    assert sala_objects["mesa_centro"]["rotation"] == [0, 90, 0]
    assert sala_objects["silla_lectura"]["position"] == [0, 0, -1]
    assert json.loads(json.dumps(response, ensure_ascii=False)) == response
