"""Resolved spatial data contracts for Lumi scene plans."""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class SourceLocation:
    """Location of a spatial value or element in Lumi source code."""

    file: str
    line: int
    column: int


@dataclass(frozen=True, slots=True)
class SpatialNumber:
    """A resolved numeric value with its source location."""

    value: int | float
    source: SourceLocation


@dataclass(frozen=True, slots=True)
class Vector3:
    """A resolved three-dimensional vector."""

    x: SpatialNumber
    y: SpatialNumber
    z: SpatialNumber
    source: SourceLocation


@dataclass(frozen=True, slots=True)
class SpatialProperty:
    """A resolved property attached to a spatial element."""

    name: str
    value: object
    source: SourceLocation


@dataclass(frozen=True, slots=True)
class SpatialElement:
    """An object or reserved spatial element in a room."""

    name: str
    element_kind: str
    object_type: str | None
    properties: tuple[SpatialProperty, ...]
    position: Vector3 | None
    rotation: Vector3 | None
    source: SourceLocation


@dataclass(frozen=True, slots=True)
class RoomPlan:
    """A room with resolved dimensions and ordered spatial elements."""

    name: str
    width: SpatialNumber
    length: SpatialNumber
    height: SpatialNumber
    elements: tuple[SpatialElement, ...]
    source: SourceLocation


@dataclass(frozen=True, slots=True)
class ScenePlan:
    """The resolved collection of rooms produced by Lumi compilation."""

    rooms: tuple[RoomPlan, ...]
    source: SourceLocation
