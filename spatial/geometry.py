"""Pure normalization and geometry helpers for future spatial validation.

This module does not define language defaults or connect geometry checks to the
runtime validator. Callers must provide every physical dimension explicitly.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from math import cos, isfinite, radians, sin, sqrt
from typing import Iterable

from .scene_plan import SourceLocation, SpatialProperty


class GeometryNormalizationReason(str, Enum):
    """Controlled reasons why a resolved property cannot be normalized."""

    UNKNOWN_PROPERTY = "unknown_property"
    DUPLICATE_PROPERTY = "duplicate_property"
    TYPE_MISMATCH = "type_mismatch"
    NOT_FINITE = "not_finite"
    UNSUPPORTED_ELEMENT_KIND = "unsupported_element_kind"


class GeometryNormalizationError(ValueError):
    """Describe one invalid resolved geometry property without a Diagnostic."""

    def __init__(
        self,
        reason: GeometryNormalizationReason,
        property_name: str,
        source: SourceLocation,
        description: str,
    ) -> None:
        super().__init__(description)
        self.reason = reason
        self.property_name = property_name
        self.source = source


@dataclass(frozen=True, slots=True)
class NormalizedSpatialGeometry:
    """Optional resolved properties, preserving each original source location."""

    orientation: SpatialProperty | None = None
    width: SpatialProperty | None = None
    height: SpatialProperty | None = None
    offset: SpatialProperty | None = None
    elevation: SpatialProperty | None = None
    color: SpatialProperty | None = None
    material: SpatialProperty | None = None


_PROPERTY_FIELDS = {
    "orientacion": "orientation",
    "ancho": "width",
    "alto": "height",
    "desplazamiento": "offset",
    "elevacion": "elevation",
    "color": "color",
    "material": "material",
}
_ALLOWED_PROPERTIES = {
    "wall": frozenset({"orientacion", "color", "material"}),
    "door": frozenset(
        {"orientacion", "ancho", "alto", "desplazamiento", "color", "material"}
    ),
    "window": frozenset(
        {
            "orientacion",
            "ancho",
            "alto",
            "desplazamiento",
            "elevacion",
            "color",
            "material",
        }
    ),
}
_TEXT_PROPERTIES = frozenset({"orientacion", "color", "material"})
_NUMERIC_PROPERTIES = frozenset({"ancho", "alto", "desplazamiento", "elevacion"})


def normalize_spatial_geometry(
    element_kind: str,
    properties: Iterable[SpatialProperty],
) -> NormalizedSpatialGeometry:
    """Normalize only properties that are present; never supply missing values."""

    allowed = _ALLOWED_PROPERTIES.get(element_kind)
    property_list = tuple(properties)
    fallback_source = (
        property_list[0].source
        if property_list
        else SourceLocation(file="<desconocido>", line=1, column=1)
    )
    if allowed is None:
        raise GeometryNormalizationError(
            GeometryNormalizationReason.UNSUPPORTED_ELEMENT_KIND,
            element_kind,
            fallback_source,
            f"El tipo espacial '{element_kind}' no tiene geometría normalizable.",
        )

    normalized: dict[str, SpatialProperty] = {}
    seen: set[str] = set()
    for spatial_property in property_list:
        name = spatial_property.name
        if name in seen:
            raise GeometryNormalizationError(
                GeometryNormalizationReason.DUPLICATE_PROPERTY,
                name,
                spatial_property.source,
                f"La propiedad geométrica '{name}' está duplicada.",
            )
        seen.add(name)
        if name not in allowed:
            raise GeometryNormalizationError(
                GeometryNormalizationReason.UNKNOWN_PROPERTY,
                name,
                spatial_property.source,
                f"La propiedad '{name}' no corresponde a un elemento '{element_kind}'.",
            )

        value = spatial_property.value
        if name in _TEXT_PROPERTIES and not isinstance(value, str):
            raise GeometryNormalizationError(
                GeometryNormalizationReason.TYPE_MISMATCH,
                name,
                spatial_property.source,
                f"La propiedad '{name}' debe contener texto resuelto.",
            )
        if name in _NUMERIC_PROPERTIES:
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise GeometryNormalizationError(
                    GeometryNormalizationReason.TYPE_MISMATCH,
                    name,
                    spatial_property.source,
                    f"La propiedad '{name}' debe contener un número resuelto.",
                )
            if isinstance(value, float) and not isfinite(value):
                raise GeometryNormalizationError(
                    GeometryNormalizationReason.NOT_FINITE,
                    name,
                    spatial_property.source,
                    f"La propiedad '{name}' debe contener un número finito.",
                )
        normalized[_PROPERTY_FIELDS[name]] = spatial_property

    return NormalizedSpatialGeometry(**normalized)


@dataclass(frozen=True, slots=True)
class Point3:
    x: float
    y: float
    z: float


@dataclass(frozen=True, slots=True)
class AxisAlignedBounds:
    minimum: Point3
    maximum: Point3


@dataclass(frozen=True, slots=True)
class OrientedBox:
    """A box defined by its center, half-extents and explicit XYZ rotation."""

    center: Point3
    half_extents: Point3
    rotation_degrees: Point3 = Point3(0.0, 0.0, 0.0)


def _add(left: Point3, right: Point3) -> Point3:
    return Point3(left.x + right.x, left.y + right.y, left.z + right.z)


def _subtract(left: Point3, right: Point3) -> Point3:
    return Point3(left.x - right.x, left.y - right.y, left.z - right.z)


def _scale(vector: Point3, factor: float) -> Point3:
    return Point3(vector.x * factor, vector.y * factor, vector.z * factor)


def _dot(left: Point3, right: Point3) -> float:
    return left.x * right.x + left.y * right.y + left.z * right.z


def _cross(left: Point3, right: Point3) -> Point3:
    return Point3(
        left.y * right.z - left.z * right.y,
        left.z * right.x - left.x * right.z,
        left.x * right.y - left.y * right.x,
    )


def _length(vector: Point3) -> float:
    return sqrt(_dot(vector, vector))


def _normalize(vector: Point3) -> Point3:
    length = _length(vector)
    if length == 0:
        raise ValueError("A separating axis cannot have zero length.")
    return _scale(vector, 1.0 / length)


def box_axes(box: OrientedBox) -> tuple[Point3, Point3, Point3]:
    """Return local box axes after applying explicit X, Y and Z rotations."""

    rx = radians(box.rotation_degrees.x)
    ry = radians(box.rotation_degrees.y)
    rz = radians(box.rotation_degrees.z)
    sx, cx = sin(rx), cos(rx)
    sy, cy = sin(ry), cos(ry)
    sz, cz = sin(rz), cos(rz)
    return (
        Point3(cy * cz, cy * sz, -sy),
        Point3(sx * sy * cz - cx * sz, sx * sy * sz + cx * cz, sx * cy),
        Point3(cx * sy * cz + sx * sz, cx * sy * sz - sx * cz, cx * cy),
    )


def box_vertices(box: OrientedBox) -> tuple[Point3, ...]:
    """Return all eight vertices without assuming a room or object pivot."""

    axes = box_axes(box)
    extents = (box.half_extents.x, box.half_extents.y, box.half_extents.z)
    vertices = []
    for x_sign in (-1.0, 1.0):
        for y_sign in (-1.0, 1.0):
            for z_sign in (-1.0, 1.0):
                vertex = box.center
                for axis, extent, sign in zip(
                    axes, extents, (x_sign, y_sign, z_sign), strict=True
                ):
                    vertex = _add(vertex, _scale(axis, extent * sign))
                vertices.append(vertex)
    return tuple(vertices)


def box_within_bounds(
    box: OrientedBox,
    bounds: AxisAlignedBounds,
    *,
    tolerance: float = 1e-9,
) -> bool:
    """Check every transformed vertex against caller-provided limits."""

    return all(
        bounds.minimum.x - tolerance <= vertex.x <= bounds.maximum.x + tolerance
        and bounds.minimum.y - tolerance <= vertex.y <= bounds.maximum.y + tolerance
        and bounds.minimum.z - tolerance <= vertex.z <= bounds.maximum.z + tolerance
        for vertex in box_vertices(box)
    )


def _projection_radius(box: OrientedBox, axis: Point3) -> float:
    return sum(
        extent * abs(_dot(local_axis, axis))
        for local_axis, extent in zip(
            box_axes(box),
            (box.half_extents.x, box.half_extents.y, box.half_extents.z),
            strict=True,
        )
    )


def boxes_intersect(
    first: OrientedBox,
    second: OrientedBox,
    *,
    touching_counts: bool,
    tolerance: float = 1e-9,
) -> bool:
    """Apply the separating-axis theorem with an explicit touching policy."""

    first_axes = box_axes(first)
    second_axes = box_axes(second)
    candidate_axes = [*first_axes, *second_axes]
    candidate_axes.extend(
        _cross(first_axis, second_axis)
        for first_axis in first_axes
        for second_axis in second_axes
    )
    center_delta = _subtract(second.center, first.center)
    for candidate in candidate_axes:
        if _length(candidate) <= tolerance:
            continue
        axis = _normalize(candidate)
        distance = abs(_dot(center_delta, axis))
        limit = _projection_radius(first, axis) + _projection_radius(second, axis)
        if touching_counts:
            if distance > limit + tolerance:
                return False
        elif distance >= limit - tolerance:
            return False
    return True
