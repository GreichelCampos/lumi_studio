"""Adapt validated runtime ScenePlan values to the IDE wire contract."""

from math import isfinite
from typing import NotRequired, TypedDict

from spatial.furniture_catalog import furniture_dimensions
from spatial.geometry import normalize_spatial_geometry
from spatial.scene_plan import RoomPlan, ScenePlan, SourceLocation, SpatialElement


class SceneAdapterError(ValueError):
    """A validated scene cannot be represented by the current IDE DTO."""


class SourceReferenceDTO(TypedDict):
    file: str
    line: int
    column: int


class FloorDTO(TypedDict):
    material: str
    color: str


class WallDTO(TypedDict):
    color: str
    material: str


class DoorDTO(TypedDict):
    id: str
    wall: str
    position: int | float
    width: int | float
    height: int | float
    sourceRef: SourceReferenceDTO


class SpatialObjectDTO(TypedDict):
    id: str
    type: str
    name: str
    placed: bool
    position: NotRequired[list[int | float]]
    rotation: list[int | float]
    dimensions: list[int | float]
    color: NotRequired[str]
    material: NotRequired[str]
    sourceRef: SourceReferenceDTO
    roomId: str


class RoomDTO(TypedDict):
    id: str
    name: str
    dimensions: list[int | float]
    floor: FloorDTO
    walls: dict[str, WallDTO]
    doors: list[DoorDTO]
    windows: list[dict[str, object]]
    objects: list[SpatialObjectDTO]
    calculatedArea: int | float
    calculatedVolume: int | float


class ScenePlanDTO(TypedDict):
    version: str
    rooms: list[RoomDTO]


def _source_reference(source: SourceLocation) -> SourceReferenceDTO:
    return {"file": source.file, "line": source.line, "column": source.column}


def _identifier(prefix: str, source: SourceLocation, name: str) -> str:
    return f"{prefix}:{source.file}:{source.line}:{source.column}:{name}"


def _properties(element: SpatialElement) -> dict[str, object]:
    return {item.name: item.value for item in element.properties}


def _wire_number(value: int | float, field: str) -> int | float:
    try:
        representable = isfinite(float(value))
    except OverflowError:
        representable = False
    if not representable:
        raise SceneAdapterError(
            f"El valor de '{field}' no puede representarse como número JSON finito."
        )
    return value


def _vector(vector) -> list[int | float]:
    return [
        _wire_number(vector.x.value, "vector.x"),
        _wire_number(vector.y.value, "vector.y"),
        _wire_number(vector.z.value, "vector.z"),
    ]


def _object_dto(element: SpatialElement, room_id: str) -> SpatialObjectDTO:
    object_type = element.object_type or element.name
    properties = _properties(element)
    result: SpatialObjectDTO = {
        "id": _identifier("element", element.source, element.name),
        "type": object_type,
        "name": element.name,
        "placed": element.position is not None,
        "rotation": _vector(element.rotation) if element.rotation else [0, 0, 0],
        "dimensions": list(furniture_dimensions(object_type)),
        "sourceRef": _source_reference(element.source),
        "roomId": room_id,
    }
    if element.position is not None:
        result["position"] = _vector(element.position)
    if "color" in properties:
        result["color"] = properties["color"]
    if "material" in properties:
        result["material"] = properties["material"]
    return result


_WALL_KEYS = {
    "norte": "north",
    "sur": "south",
    "este": "east",
    "oeste": "west",
}


def _required_geometry_property(element: SpatialElement, field: str):
    geometry = normalize_spatial_geometry(element.element_kind, element.properties)
    value = getattr(geometry, field)
    if value is None:
        raise SceneAdapterError(
            f"El elemento '{element.name}' no define la geometría '{field}' "
            "requerida por el DTO del IDE."
        )
    return value


def _wall_dto(element: SpatialElement) -> tuple[str, WallDTO]:
    orientation = _required_geometry_property(element, "orientation").value
    wall_key = _WALL_KEYS.get(orientation)
    if wall_key is None:
        raise SceneAdapterError(
            f"La orientación '{orientation}' de '{element.name}' no es publicable."
        )
    properties = _properties(element)
    return wall_key, {
        "color": properties.get("color", "#f1f5f9"),
        "material": properties.get("material", "standard"),
    }


def _door_dto(element: SpatialElement, room: RoomPlan) -> DoorDTO:
    orientation = _required_geometry_property(element, "orientation").value
    width = _wire_number(
        _required_geometry_property(element, "width").value,
        f"{element.name}.ancho",
    )
    height = _wire_number(
        _required_geometry_property(element, "height").value,
        f"{element.name}.alto",
    )
    offset = _wire_number(
        _required_geometry_property(element, "offset").value,
        f"{element.name}.desplazamiento",
    )
    span = room.width.value if orientation in {"norte", "sur"} else room.length.value
    centered_position = _wire_number(
        -span / 2 + offset + width / 2,
        f"{element.name}.position",
    )
    return {
        "id": _identifier("element", element.source, element.name),
        "wall": orientation,
        "position": centered_position,
        "width": width,
        "height": height,
        "sourceRef": _source_reference(element.source),
    }


def _room_dto(room: RoomPlan) -> RoomDTO:
    room_id = _identifier("room", room.source, room.name)
    floor: FloorDTO = {"material": "standard", "color": "#e2e8f0"}
    objects: list[SpatialObjectDTO] = []
    doors: list[DoorDTO] = []
    neutral_wall: WallDTO = {"color": "#f1f5f9", "material": "standard"}
    walls = {
        side: dict(neutral_wall)
        for side in ("north", "south", "east", "west")
    }
    declared_walls: set[str] = set()
    floor_count = 0
    for element in room.elements:
        if element.element_kind == "floor":
            floor_count += 1
            if floor_count > 1:
                raise SceneAdapterError(
                    f"La habitación '{room.name}' contiene más de un piso y el "
                    "DTO del IDE admite solamente uno."
                )
            properties = _properties(element)
            floor["material"] = properties.get("material", floor["material"])
            floor["color"] = properties.get("color", floor["color"])
        elif element.element_kind == "object":
            objects.append(_object_dto(element, room_id))
        elif element.element_kind == "wall":
            wall_key, wall = _wall_dto(element)
            if wall_key in declared_walls:
                raise SceneAdapterError(
                    f"La habitación '{room.name}' contiene más de una pared "
                    f"declarada para la cara '{wall_key}'."
                )
            declared_walls.add(wall_key)
            walls[wall_key] = wall
        elif element.element_kind == "door":
            doors.append(_door_dto(element, room))
        elif element.element_kind == "window":
            raise SceneAdapterError(
                f"La ventana '{element.name}' no puede publicarse porque el "
                "contrato local WindowModel aún no admite 'elevation'."
            )
        else:
            raise SceneAdapterError(
                f"El tipo espacial '{element.element_kind}' no puede publicarse."
            )
    width = _wire_number(room.width.value, f"{room.name}.width")
    length = _wire_number(room.length.value, f"{room.name}.length")
    height = _wire_number(room.height.value, f"{room.name}.height")
    area = _wire_number(width * length, f"{room.name}.calculatedArea")
    volume = _wire_number(width * length * height, f"{room.name}.calculatedVolume")
    return {
        "id": room_id,
        "name": room.name,
        "dimensions": [width, length, height],
        "floor": floor,
        "walls": walls,
        "doors": doors,
        "windows": [],
        "objects": objects,
        "calculatedArea": area,
        "calculatedVolume": volume,
    }


def scene_plan_dto(scene: ScenePlan) -> ScenePlanDTO:
    """Convert a validated runtime scene without evaluating or mutating it."""

    return {"version": "1.0.0", "rooms": [_room_dto(room) for room in scene.rooms]}
