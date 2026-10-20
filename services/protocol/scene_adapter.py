"""Adapt validated runtime ScenePlan values to the IDE wire contract."""

from math import isfinite
from typing import TypedDict

from spatial.scene_plan import RoomPlan, ScenePlan, SourceLocation, SpatialElement


# Presentation-only geometry already used by the IDE. These values are not
# language semantics and are never written back to ScenePlan.
FURNITURE_DIMENSIONS: dict[str, tuple[float, float, float]] = {
    "sofa": (2.0, 0.85, 0.9),
    "mesa": (1.2, 0.5, 0.8),
    "silla": (0.55, 0.85, 0.55),
    "planta": (0.6, 1.2, 0.6),
    "cama": (2.0, 0.75, 1.6),
    "escritorio": (1.4, 0.75, 0.8),
    "lampara": (0.45, 1.5, 0.45),
    "estanteria": (1.0, 1.8, 0.4),
    "armario": (1.2, 2.0, 0.6),
    "cuadro": (1.0, 0.8, 0.05),
    "alfombra": (2.0, 0.02, 1.5),
}
GENERIC_FURNITURE_DIMENSIONS = (1.0, 1.0, 1.0)


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


class SpatialObjectDTO(TypedDict, total=False):
    id: str
    type: str
    name: str
    position: list[int | float]
    rotation: list[int | float]
    dimensions: list[int | float]
    color: str
    material: str
    sourceRef: SourceReferenceDTO
    roomId: str


class RoomDTO(TypedDict):
    id: str
    name: str
    dimensions: list[int | float]
    floor: FloorDTO
    walls: dict[str, WallDTO]
    doors: list[dict[str, object]]
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


def _properties(element: SpatialElement) -> dict[str, str]:
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
    if element.position is None:
        raise SceneAdapterError(
            f"El objeto '{element.name}' debe colocarse antes de publicarse en el IDE."
        )
    object_type = element.object_type or element.name
    properties = _properties(element)
    result: SpatialObjectDTO = {
        "id": _identifier("element", element.source, element.name),
        "type": object_type,
        "name": element.name,
        "position": _vector(element.position),
        "rotation": _vector(element.rotation) if element.rotation else [0, 0, 0],
        "dimensions": list(
            FURNITURE_DIMENSIONS.get(
                object_type.lower(), GENERIC_FURNITURE_DIMENSIONS
            )
        ),
        "sourceRef": _source_reference(element.source),
        "roomId": room_id,
    }
    if "color" in properties:
        result["color"] = properties["color"]
    if "material" in properties:
        result["material"] = properties["material"]
    return result


def _room_dto(room: RoomPlan) -> RoomDTO:
    room_id = _identifier("room", room.source, room.name)
    floor: FloorDTO = {"material": "standard", "color": "#e2e8f0"}
    objects: list[SpatialObjectDTO] = []
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
        elif element.element_kind in {"wall", "door", "window"}:
            raise SceneAdapterError(
                f"El elemento '{element.name}' de tipo '{element.element_kind}' "
                "no contiene todavía la geometría requerida por el IDE."
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
    neutral_wall: WallDTO = {"color": "#f1f5f9", "material": "standard"}
    return {
        "id": room_id,
        "name": room.name,
        "dimensions": [width, length, height],
        "floor": floor,
        "walls": {
            side: dict(neutral_wall)
            for side in ("north", "south", "east", "west")
        },
        "doors": [],
        "windows": [],
        "objects": objects,
        "calculatedArea": area,
        "calculatedVolume": volume,
    }


def scene_plan_dto(scene: ScenePlan) -> ScenePlanDTO:
    """Convert a validated runtime scene without evaluating or mutating it."""

    return {"version": "1.0.0", "rooms": [_room_dto(room) for room in scene.rooms]}
