from dataclasses import FrozenInstanceError

import pytest

from spatial.scene_builder import (
    ScenePlanBuilder,
    ScenePlanBuilderError,
    ScenePlanBuilderErrorReason,
)
from spatial.scene_plan import (
    SourceLocation,
    SpatialNumber,
    SpatialProperty,
    Vector3,
)


def location(line: int = 1, column: int = 1) -> SourceLocation:
    return SourceLocation("principal.lumi", line, column)


def number(value: object, line: int, column: int) -> SpatialNumber:
    return SpatialNumber(value, location(line, column))


def vector(x: object, y: object, z: object, line: int) -> Vector3:
    return Vector3(
        number(x, line, 10),
        number(y, line, 13),
        number(z, line, 16),
        location(line, 9),
    )


def builder() -> ScenePlanBuilder:
    return ScenePlanBuilder(location())


def begin_room(
    scene_builder: ScenePlanBuilder,
    name: str = "sala",
    line: int = 1,
) -> None:
    scene_builder.begin_room(
        name=name,
        width=number(5, line, 18),
        length=number(4, line, 21),
        height=number(2.7, line, 24),
        source=location(line),
    )


def declare_object(
    scene_builder: ScenePlanBuilder,
    name: str = "silla1",
    line: int = 2,
) -> None:
    scene_builder.declare_element(
        name=name,
        element_kind="object",
        object_type="silla",
        properties=(),
        source=location(line, 5),
    )


def assert_error(
    raised: pytest.ExceptionInfo[ScenePlanBuilderError],
    reason: ScenePlanBuilderErrorReason,
) -> ScenePlanBuilderError:
    assert raised.value.reason is reason
    return raised.value


def test_builds_empty_scene_plan():
    scene = builder().build()

    assert scene.rooms == ()
    assert scene.source == location()


def test_builds_valid_room_with_dimensions_and_source_locations():
    scene_builder = builder()
    begin_room(scene_builder)

    room = scene_builder.end_room()
    scene = scene_builder.build()

    assert scene.rooms == (room,)
    assert room.name == "sala"
    assert (room.width.value, room.length.value, room.height.value) == (5, 4, 2.7)
    assert room.width.source == location(1, 18)
    assert scene.source == location()


def test_builds_multiple_independent_rooms_in_order():
    scene_builder = builder()
    begin_room(scene_builder, "sala", 1)
    scene_builder.end_room()
    begin_room(scene_builder, "cocina", 5)
    scene_builder.end_room()

    scene = scene_builder.build()

    assert tuple(room.name for room in scene.rooms) == ("sala", "cocina")


def test_rejects_duplicate_rooms_without_changing_finalized_rooms():
    scene_builder = builder()
    begin_room(scene_builder)
    original = scene_builder.end_room()

    with pytest.raises(ScenePlanBuilderError) as raised:
        begin_room(scene_builder)

    error = assert_error(raised, ScenePlanBuilderErrorReason.DUPLICATE_ROOM)
    assert error.source == location()
    assert scene_builder.build().rooms == (original,)


def test_rejects_nested_rooms_and_keeps_outer_room_active():
    scene_builder = builder()
    begin_room(scene_builder, "sala")

    with pytest.raises(ScenePlanBuilderError) as raised:
        begin_room(scene_builder, "cocina", 4)

    assert_error(raised, ScenePlanBuilderErrorReason.ROOM_ALREADY_ACTIVE)
    assert scene_builder.end_room().name == "sala"


def test_declares_generic_object_with_separate_kind_type_and_name():
    scene_builder = builder()
    begin_room(scene_builder)
    declare_object(scene_builder)
    element = scene_builder.end_room().elements[0]

    assert (element.name, element.element_kind, element.object_type) == (
        "silla1",
        "object",
        "silla",
    )


@pytest.mark.parametrize("element_kind", ["floor", "wall", "door", "window"])
def test_declares_reserved_spatial_categories(element_kind):
    scene_builder = builder()
    begin_room(scene_builder)
    scene_builder.declare_element(
        name=f"{element_kind}1",
        element_kind=element_kind,
        object_type=None,
        properties=(),
        source=location(2, 5),
    )

    element = scene_builder.end_room().elements[0]

    assert element.element_kind == element_kind
    assert element.object_type is None


def test_rejects_duplicate_elements_in_same_room_atomically():
    scene_builder = builder()
    begin_room(scene_builder)
    declare_object(scene_builder)

    with pytest.raises(ScenePlanBuilderError) as raised:
        declare_object(scene_builder, line=3)

    assert_error(raised, ScenePlanBuilderErrorReason.DUPLICATE_ELEMENT)
    assert len(scene_builder.end_room().elements) == 1


def test_allows_same_element_name_in_different_rooms():
    scene_builder = builder()
    for room_name, line in (("sala", 1), ("cocina", 5)):
        begin_room(scene_builder, room_name, line)
        declare_object(scene_builder, line=line + 1)
        scene_builder.end_room()

    scene = scene_builder.build()

    assert all(room.elements[0].name == "silla1" for room in scene.rooms)


def test_keeps_unplaced_element_with_optional_vectors():
    scene_builder = builder()
    begin_room(scene_builder)
    declare_object(scene_builder)

    element = scene_builder.end_room().elements[0]

    assert element.position is None
    assert element.rotation is None


def test_places_element_and_preserves_vector_locations():
    scene_builder = builder()
    begin_room(scene_builder)
    declare_object(scene_builder)
    position = vector(1, 0, 2, 3)

    scene_builder.place_element(name="silla1", position=position)
    element = scene_builder.end_room().elements[0]

    assert element.position == position
    assert element.position.source == location(3, 9)
    assert element.position.z.source == location(3, 16)


def test_rejects_second_place_and_preserves_initial_position():
    scene_builder = builder()
    begin_room(scene_builder)
    declare_object(scene_builder)
    first = vector(1, 0, 2, 3)
    scene_builder.place_element(name="silla1", position=first)

    with pytest.raises(ScenePlanBuilderError) as raised:
        scene_builder.place_element(
            name="silla1",
            position=vector(4, 0, 5, 4),
        )

    assert_error(raised, ScenePlanBuilderErrorReason.ELEMENT_ALREADY_PLACED)
    assert scene_builder.end_room().elements[0].position == first


def test_absolute_moves_replace_position_and_last_move_wins():
    scene_builder = builder()
    begin_room(scene_builder)
    declare_object(scene_builder)
    scene_builder.place_element(name="silla1", position=vector(1, 0, 2, 3))
    scene_builder.move_element(name="silla1", position=vector(3, 0, 4, 4))
    last = vector(-1, 0, 8, 5)
    scene_builder.move_element(name="silla1", position=last)

    assert scene_builder.end_room().elements[0].position == last


def test_rejects_move_before_place_without_setting_position():
    scene_builder = builder()
    begin_room(scene_builder)
    declare_object(scene_builder)

    with pytest.raises(ScenePlanBuilderError) as raised:
        scene_builder.move_element(
            name="silla1",
            position=vector(3, 0, 4, 3),
        )

    assert_error(raised, ScenePlanBuilderErrorReason.ELEMENT_NOT_PLACED)
    assert scene_builder.end_room().elements[0].position is None


def test_absolute_rotation_is_allowed_before_place_and_last_value_wins():
    scene_builder = builder()
    begin_room(scene_builder)
    declare_object(scene_builder)
    scene_builder.rotate_element(name="silla1", rotation=vector(0, 45, 0, 3))
    scene_builder.place_element(name="silla1", position=vector(1, 0, 2, 4))
    last = vector(0, 90, 0, 5)
    scene_builder.rotate_element(name="silla1", rotation=last)

    assert scene_builder.end_room().elements[0].rotation == last


@pytest.mark.parametrize("operation", ["place", "move", "rotate"])
def test_operations_reject_undeclared_elements(operation):
    scene_builder = builder()
    begin_room(scene_builder)
    value = vector(1, 2, 3, 3)

    with pytest.raises(ScenePlanBuilderError) as raised:
        getattr(scene_builder, f"{operation}_element")(
            name="fantasma",
            **({"rotation": value} if operation == "rotate" else {"position": value}),
        )

    error = assert_error(raised, ScenePlanBuilderErrorReason.ELEMENT_NOT_FOUND)
    assert error.element_name == "fantasma"
    assert scene_builder.end_room().elements == ()


def test_spatial_operations_require_active_room():
    scene_builder = builder()

    with pytest.raises(ScenePlanBuilderError) as raised:
        declare_object(scene_builder)

    assert_error(raised, ScenePlanBuilderErrorReason.NO_ACTIVE_ROOM)


def test_rejects_build_with_active_room_and_preserves_room():
    scene_builder = builder()
    begin_room(scene_builder)

    with pytest.raises(ScenePlanBuilderError) as raised:
        scene_builder.build()

    error = assert_error(
        raised,
        ScenePlanBuilderErrorReason.ACTIVE_ROOM_NOT_FINALIZED,
    )
    assert error.room_name == "sala"
    scene_builder.end_room()
    assert len(scene_builder.build().rooms) == 1


def test_rejects_end_room_without_active_room():
    scene_builder = builder()

    with pytest.raises(ScenePlanBuilderError) as raised:
        scene_builder.end_room()

    assert_error(raised, ScenePlanBuilderErrorReason.NO_ACTIVE_ROOM)


def test_produced_scene_and_elements_are_immutable():
    scene_builder = builder()
    begin_room(scene_builder)
    declare_object(scene_builder)
    scene_builder.end_room()
    scene = scene_builder.build()

    with pytest.raises(FrozenInstanceError):
        scene.rooms = ()
    with pytest.raises(FrozenInstanceError):
        scene.rooms[0].elements[0].name = "otra"


def test_preserves_properties_dimensions_and_element_source():
    scene_builder = builder()
    begin_room(scene_builder)
    properties = (
        SpatialProperty("color", "rojo", location(2, 20)),
        SpatialProperty("material", "madera", location(2, 36)),
    )
    scene_builder.declare_element(
        name="mesa1",
        element_kind="object",
        object_type="mesa",
        properties=properties,
        source=location(2, 5),
    )

    room = scene_builder.end_room()
    element = room.elements[0]

    assert element.properties == properties
    assert element.source == location(2, 5)
    assert room.width == number(5, 1, 18)


def test_builder_leaves_l026_validation_to_spatial_validator():
    scene_builder = ScenePlanBuilder(location())
    scene_builder.begin_room(
        name="invalida",
        width=number(0, 1, 18),
        length=number(-4, 1, 21),
        height=number(float("inf"), 1, 24),
        source=location(),
    )

    scene_builder.end_room()
    scene = scene_builder.build()

    assert scene.rooms[0].width.value == 0
    assert scene.rooms[0].length.value == -4
    assert scene.rooms[0].height.value == float("inf")
