from dataclasses import FrozenInstanceError

import pytest

from spatial.scene_plan import (
    RoomPlan,
    ScenePlan,
    SourceLocation,
    SpatialElement,
    SpatialNumber,
    SpatialProperty,
    Vector3,
)


def location(line: int = 1, column: int = 1) -> SourceLocation:
    return SourceLocation(file="principal.lumi", line=line, column=column)


def room(name: str, line: int = 1) -> RoomPlan:
    return RoomPlan(
        name=name,
        width=SpatialNumber(5, location(line, 18)),
        length=SpatialNumber(4, location(line, 21)),
        height=SpatialNumber(2.7, location(line, 24)),
        elements=(),
        source=location(line),
    )


def test_builds_valid_scene_plan():
    scene = ScenePlan(rooms=(room("sala"),), source=location())

    assert scene.rooms[0].name == "sala"
    assert scene.rooms[0].width.value == 5
    assert scene.rooms[0].height.value == 2.7


def test_preserves_multiple_rooms_in_order():
    scene = ScenePlan(
        rooms=(room("sala", 1), room("cocina", 2)),
        source=location(),
    )

    assert tuple(item.name for item in scene.rooms) == ("sala", "cocina")


def test_element_supports_properties_position_and_rotation():
    position = Vector3(
        x=SpatialNumber(1, location(4, 20)),
        y=SpatialNumber(0, location(4, 23)),
        z=SpatialNumber(2, location(4, 26)),
        source=location(4, 19),
    )
    rotation = Vector3(
        x=SpatialNumber(0, location(5, 18)),
        y=SpatialNumber(90, location(5, 21)),
        z=SpatialNumber(0, location(5, 25)),
        source=location(5, 17),
    )
    element = SpatialElement(
        name="silla1",
        element_kind="object",
        object_type="silla",
        properties=(
            SpatialProperty("color", "rojo", location(3, 9)),
            SpatialProperty("material", "madera", location(3, 25)),
        ),
        position=position,
        rotation=rotation,
        source=location(2, 5),
    )

    assert tuple(prop.name for prop in element.properties) == (
        "color",
        "material",
    )
    assert element.position == position
    assert element.rotation == rotation


def test_preserves_individual_source_locations():
    width_source = location(2, 20)
    vector_source = location(6, 15)
    vector = Vector3(
        x=SpatialNumber(1, location(6, 16)),
        y=SpatialNumber(2, location(6, 19)),
        z=SpatialNumber(3, location(6, 22)),
        source=vector_source,
    )

    assert SpatialNumber(5, width_source).source == width_source
    assert vector.source == vector_source
    assert vector.z.source == location(6, 22)


def test_contracts_are_immutable():
    scene = ScenePlan(rooms=(room("sala"),), source=location())

    with pytest.raises(FrozenInstanceError):
        scene.source = location(9, 9)

    with pytest.raises(FrozenInstanceError):
        scene.rooms[0].name = "cocina"


def test_allows_invalid_fixtures_for_later_validation():
    invalid_room = RoomPlan(
        name="sala",
        width=SpatialNumber(0, location(1, 18)),
        length=SpatialNumber(-4, location(1, 21)),
        height=SpatialNumber(float("inf"), location(1, 24)),
        elements=(),
        source=location(),
    )

    assert invalid_room.width.value == 0
    assert invalid_room.length.value == -4
    assert invalid_room.height.value == float("inf")
