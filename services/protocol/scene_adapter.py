"""Adapt resolved empty rooms to the IDE exchange model; styles are visual defaults."""

from typing import TypedDict

from spatial.scene_plan import RoomPlan, ScenePlan


class FloorDTO(TypedDict):
    material: str
    color: str


class WallDTO(TypedDict):
    color: str


class RoomDTO(TypedDict):
    id: str
    name: str
    dimensions: list[int | float]
    floor: FloorDTO
    walls: dict[str, WallDTO]
    doors: list[dict[str, object]]
    windows: list[dict[str, object]]
    objects: list[dict[str, object]]
    calculatedArea: int | float
    calculatedVolume: int | float


class ScenePlanDTO(TypedDict):
    version: str
    rooms: list[RoomDTO]


def _room_dto(room: RoomPlan) -> RoomDTO:
    if room.elements:
        raise ValueError("El adaptador de habitaciones vacías no admite elementos espaciales.")
    width, length, height = room.width.value, room.length.value, room.height.value
    return {
        "id": f"{room.source.file}:{room.source.line}:{room.source.column}",
        "name": room.name, "dimensions": [width, length, height],
        "floor": {"material": "standard", "color": "#e2e8f0"},
        "walls": {side: {"color": "#f1f5f9"} for side in ("north", "south", "east", "west")},
        "doors": [], "windows": [], "objects": [],
        "calculatedArea": width * length, "calculatedVolume": width * length * height,
    }


def scene_plan_dto(scene: ScenePlan) -> ScenePlanDTO:
    return {"version": "1.0.0", "rooms": [_room_dto(room) for room in scene.rooms]}
