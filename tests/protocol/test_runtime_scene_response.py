from json import dumps, loads

from services.protocol.dispatcher import RequestDispatcher


def request(source: str, request_id: str = "scene") -> dict[str, object]:
    return {
        "protocolVersion": "1.0.0",
        "requestId": request_id,
        "operation": "execute",
        "entryFile": "principal.lumi",
        "files": {"principal.lumi": source},
    }


def test_runtime_scene_reaches_protocol_with_final_object_state():
    source = (
        'decimal destino = 2>> funcion decimal siguiente(decimal valor) { '
        'retornar valor + 1>> } habitacion sala(6, 5, 3) { '
        'piso suelo { material "madera">> color "beige">> } '
        'mesa mesa1 { color "rojo">> } colocar mesa1 [0, 0, 0]>> '
        'si verdadero { mover mesa1 [siguiente(destino), 0, -1]>> } '
        'rotar mesa1 [0, 90, 0]>> }'
    )

    response = RequestDispatcher().dispatch(request(source))

    assert response["status"] == "completed"
    payload = response["result"]
    assert payload["analysisStatus"] == "incomplete"
    assert payload["capabilities"]["scenePlan"] is True
    room = payload["scenePlan"]["rooms"][0]
    assert room["floor"] == {"material": "madera", "color": "beige"}
    assert room["calculatedArea"] == 30
    assert room["calculatedVolume"] == 90
    item = room["objects"][0]
    assert item["type"] == "mesa"
    assert item["placed"] is True
    assert item["position"] == [3, 0, -1]
    assert item["rotation"] == [0, 90, 0]
    assert item["dimensions"] == [1.2, 0.5, 0.8]
    assert item["color"] == "rojo"
    assert item["sourceRef"]["file"] == "principal.lumi"


def test_unplaced_object_is_published_without_artificial_position():
    source = (
        'habitacion sala(5, 4, 3) { silla silla1 { '
        'color "azul">> material "madera">> } }'
    )

    response = RequestDispatcher().dispatch(request(source))

    assert response["status"] == "completed"
    item = response["result"]["scenePlan"]["rooms"][0]["objects"][0]
    assert item["placed"] is False
    assert "position" not in item
    assert item["name"] == "silla1"
    assert item["type"] == "silla"
    assert item["color"] == "azul"
    assert item["material"] == "madera"
    assert item["sourceRef"]["file"] == "principal.lumi"
    assert item["sourceRef"]["line"] == 1
    assert item["sourceRef"]["column"] == 28
    encoded_item = loads(dumps(item))
    assert encoded_item["placed"] is False
    assert "position" not in encoded_item


def test_room_can_publish_placed_and_unplaced_objects_together():
    source = (
        "habitacion sala(5, 4, 3) { silla pendiente { } mesa ubicada { } "
        "colocar ubicada [1, 0, -2]>> }"
    )

    response = RequestDispatcher().dispatch(request(source))

    assert response["status"] == "completed"
    objects = response["result"]["scenePlan"]["rooms"][0]["objects"]
    assert objects[0]["placed"] is False
    assert "position" not in objects[0]
    assert objects[1]["placed"] is True
    assert objects[1]["position"] == [1, 0, -2]


def test_second_floor_produces_spatial_diagnostic_instead_of_adapter_error():
    source = (
        "habitacion sala(5, 4, 3) { "
        "piso suelo1 { } piso suelo2 { } }"
    )

    response = RequestDispatcher().dispatch(request(source))

    assert response["status"] == "failed"
    diagnostic = response["result"]["diagnostics"][0]
    assert diagnostic["category"] == "SPATIAL"
    assert diagnostic["code"] == "SPA_MULTIPLE_FLOORS"
    assert diagnostic["file"] == "principal.lumi"
    assert diagnostic["line"] == 1
    assert diagnostic["column"] == 44
    assert "más de un piso" in diagnostic["description"]
    assert response["result"]["capabilities"]["scenePlan"] is False
    assert "scenePlan" not in response["result"]


def test_each_room_can_have_its_own_floor():
    source = (
        "habitacion sala(5, 4, 3) { piso sala_piso { } } "
        "habitacion cocina(3, 2, 2) { piso cocina_piso { } }"
    )

    response = RequestDispatcher().dispatch(request(source))

    assert response["status"] == "completed"
    assert len(response["result"]["scenePlan"]["rooms"]) == 2


def test_scene_ids_are_deterministic_across_equivalent_executions():
    source = (
        "habitacion sala(5, 4, 3) { mesa mesa1 { } "
        "colocar mesa1 [0, 0, 0]>> }"
    )
    first = RequestDispatcher().dispatch(request(source, "first"))
    second = RequestDispatcher().dispatch(request(source, "second"))

    first_room = first["result"]["scenePlan"]["rooms"][0]
    second_room = second["result"]["scenePlan"]["rooms"][0]
    assert first_room["id"] == second_room["id"]
    assert first_room["objects"][0]["id"] == second_room["objects"][0]["id"]


def test_invalid_spatial_scene_is_not_published():
    response = RequestDispatcher().dispatch(
        request("habitacion sala(0, 4, 3) { }")
    )

    assert response["status"] == "failed"
    assert response["result"]["diagnostics"][0]["code"] == "SPA_INVALID_DIMENSION"
    assert response["result"]["capabilities"]["scenePlan"] is False
    assert "scenePlan" not in response["result"]


def test_runtime_failure_is_not_published_as_a_scene():
    response = RequestDispatcher().dispatch(
        request("habitacion sala(5, 4, 3) { mostrar(1 / 0)>> }")
    )

    assert response["status"] == "failed"
    assert response["result"]["diagnostics"][0]["code"] == "RUN_DIVISION_BY_ZERO"
    assert response["result"]["capabilities"]["scenePlan"] is False
    assert "scenePlan" not in response["result"]


def test_non_spatial_program_keeps_protocol_compatible_without_empty_scene():
    response = RequestDispatcher().dispatch(request("mostrar(42)>>"))

    assert response["status"] == "completed"
    assert response["result"]["output"] == ["42"]
    assert response["result"]["capabilities"]["scenePlan"] is False
    assert "scenePlan" not in response["result"]


def test_unrepresentable_wall_returns_controlled_serialization_error():
    response = RequestDispatcher().dispatch(
        request("habitacion sala(5, 4, 3) { pared norte { } }")
    )

    assert response["status"] == "error"
    assert response["error"]["kind"] == "infrastructure"
    assert response["error"]["code"] == "SERIALIZATION_ERROR"
    assert "geometría requerida" in response["error"]["message"]


def test_unrepresentable_numeric_magnitude_is_a_controlled_serialization_error():
    response = RequestDispatcher().dispatch(
        request(f"habitacion sala({10**1000}, 4, 3) {{ }}")
    )

    assert response["status"] == "error"
    assert response["error"]["code"] == "SERIALIZATION_ERROR"
    assert "JSON finito" in response["error"]["message"]
