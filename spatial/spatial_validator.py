"""Spatial validation for resolved Lumi scene plans."""

from dataclasses import dataclass
from math import isfinite

from lumi_language.diagnostics import Diagnostic, DiagnosticCategory

from .furniture_catalog import furniture_dimensions
from .geometry import (
    AxisAlignedBounds,
    GeometryNormalizationError,
    NormalizedSpatialGeometry,
    OrientedBox,
    Point3,
    box_from_floor_pivot,
    box_within_bounds,
    boxes_intersect,
    normalize_spatial_geometry,
)
from .scene_plan import (
    RoomPlan,
    ScenePlan,
    SpatialElement,
    SpatialNumber,
    Vector3,
)
from .spatial_rules import (
    PropertyRuleViolation,
    dimension_diagnostic,
    multiple_floors_diagnostic,
    property_diagnostic,
    validate_dimension_value,
    validate_property_value,
    validate_vector_component_value,
    vector_diagnostic,
)


@dataclass(frozen=True, slots=True)
class _OpeningGeometry:
    element: SpatialElement
    geometry: NormalizedSpatialGeometry
    orientation: str
    width: float
    height: float
    offset: float
    elevation: float


@dataclass(frozen=True, slots=True)
class SpatialValidationResult:
    """Diagnostics produced while validating a resolved scene plan."""

    diagnostics: tuple[Diagnostic, ...]

    @property
    def succeeded(self) -> bool:
        """Return whether spatial validation completed without diagnostics."""

        return not self.diagnostics


class SpatialValidator:
    """Validate resolved spatial values without mutating the scene plan."""

    def validate(self, scene_plan: ScenePlan) -> SpatialValidationResult:
        """Validate every room in a scene plan and accumulate diagnostics."""

        diagnostics: list[Diagnostic] = []
        for room in scene_plan.rooms:
            diagnostics.extend(self._validate_room_dimensions(room))
            diagnostics.extend(self._validate_room_floor_count(room))
            for element in room.elements:
                diagnostics.extend(self._validate_element_vectors(element))
                diagnostics.extend(self._validate_element_properties(element))
            diagnostics.extend(self._validate_resolved_geometry(room))
        return SpatialValidationResult(diagnostics=tuple(diagnostics))

    @staticmethod
    def _validate_room_dimensions(room: RoomPlan) -> list[Diagnostic]:
        diagnostics = []
        for dimension_name, dimension in (
            ("ancho", room.width),
            ("largo", room.length),
            ("alto", room.height),
        ):
            violation = validate_dimension_value(dimension.value)
            if violation is not None:
                diagnostics.append(dimension_diagnostic(
                    room_name=room.name,
                    dimension_name=dimension_name,
                    violation=violation,
                    **_source_fields(dimension),
                ))
        return diagnostics

    @staticmethod
    def _validate_room_floor_count(room: RoomPlan) -> list[Diagnostic]:
        diagnostics = []
        floor_found = False
        for element in room.elements:
            if element.element_kind != "floor":
                continue
            if not floor_found:
                floor_found = True
                continue
            diagnostics.append(multiple_floors_diagnostic(
                room_name=room.name,
                **_source_fields(element),
            ))
        return diagnostics

    def _validate_element_vectors(
        self, element: SpatialElement,
    ) -> list[Diagnostic]:
        diagnostics = []
        for vector_name, vector in (
            ("posición", element.position),
            ("rotación", element.rotation),
        ):
            if vector is not None:
                diagnostics.extend(
                    self._validate_vector(element.name, vector_name, vector)
                )
        return diagnostics

    @staticmethod
    def _validate_vector(
        element_name: str, vector_name: str, vector: Vector3,
    ) -> list[Diagnostic]:
        diagnostics = []
        for component_name, component in (
            ("x", vector.x), ("y", vector.y), ("z", vector.z),
        ):
            violation = validate_vector_component_value(component.value)
            if violation is not None:
                diagnostics.append(vector_diagnostic(
                    element_name=element_name,
                    vector_name=vector_name,
                    component_name=component_name,
                    violation=violation,
                    **_source_fields(component),
                ))
        return diagnostics

    def _validate_element_properties(
        self,
        element: SpatialElement,
    ) -> list[Diagnostic]:
        diagnostics = []
        seen_properties: set[str] = set()
        for spatial_property in element.properties:
            property_name = spatial_property.name
            if property_name in seen_properties:
                violation = PropertyRuleViolation.DUPLICATE
            else:
                seen_properties.add(property_name)
                violation = validate_property_value(
                    element.element_kind,
                    property_name,
                    spatial_property.value,
                )
            if violation is not None:
                diagnostics.append(property_diagnostic(
                    element_name=element.name,
                    element_kind=element.element_kind,
                    property_name=property_name,
                    violation=violation,
                    **_source_fields(spatial_property),
                ))
        if not diagnostics and element.element_kind in {"wall", "door", "window"}:
            diagnostics.extend(self._validate_geometry_properties(element))
        return diagnostics

    @staticmethod
    def _diagnostic(
        code: str,
        source,
        description: str,
        suggestion: str,
    ) -> Diagnostic:
        return Diagnostic(
            category=DiagnosticCategory.SPATIAL,
            code=code,
            file=source.file,
            line=source.line,
            column=source.column,
            description=description,
            suggestion=suggestion,
        )

    def _validate_geometry_properties(
        self,
        element: SpatialElement,
    ) -> list[Diagnostic]:
        try:
            geometry = normalize_spatial_geometry(
                element.element_kind,
                element.properties,
            )
        except GeometryNormalizationError as error:
            return [
                self._diagnostic(
                    "SPA_INVALID_PROPERTY",
                    error.source,
                    str(error),
                    "Corrija la propiedad geométrica indicada.",
                )
            ]

        if (
            geometry.orientation is not None
            and geometry.orientation.value not in {"norte", "sur", "este", "oeste"}
        ):
            return [
                self._diagnostic(
                    "SPA_INVALID_PROPERTY",
                    geometry.orientation.source,
                    (
                        f"La orientación '{geometry.orientation.value}' del elemento "
                        f"'{element.name}' no es válida."
                    ),
                    "Utilice 'norte', 'sur', 'este' u 'oeste'.",
                )
            ]
        return []

    @staticmethod
    def _valid_room_geometry(room: RoomPlan) -> bool:
        for value in (room.width.value, room.length.value, room.height.value):
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                return False
            try:
                converted = float(value)
            except OverflowError:
                return False
            if not isfinite(converted) or value <= 0:
                return False
        return True

    @staticmethod
    def _vector_values(vector: Vector3 | None) -> tuple[float, float, float] | None:
        if vector is None:
            return None
        values = (vector.x.value, vector.y.value, vector.z.value)
        if not all(
            not isinstance(value, bool)
            and isinstance(value, (int, float))
            and (not isinstance(value, float) or isfinite(value))
            for value in values
        ):
            return None
        converted = []
        for value in values:
            try:
                number = float(value)
            except OverflowError:
                return None
            if not isfinite(number):
                return None
            converted.append(number)
        return tuple(converted)

    @staticmethod
    def _normalized_geometry(
        element: SpatialElement,
    ) -> NormalizedSpatialGeometry | None:
        try:
            return normalize_spatial_geometry(element.element_kind, element.properties)
        except GeometryNormalizationError:
            return None

    def _validate_resolved_geometry(self, room: RoomPlan) -> list[Diagnostic]:
        if not self._valid_room_geometry(room):
            return []

        diagnostics: list[Diagnostic] = []
        openings: list[_OpeningGeometry] = []
        for element in room.elements:
            if element.element_kind not in {"door", "window"}:
                continue
            geometry = self._normalized_geometry(element)
            if geometry is None:
                continue
            element_diagnostics, opening = self._validate_opening(room, element, geometry)
            diagnostics.extend(element_diagnostics)
            if opening is not None:
                openings.append(opening)

        diagnostics.extend(self._validate_opening_overlaps(openings))
        object_boxes = self._object_boxes(room)
        diagnostics.extend(self._validate_object_bounds(room, object_boxes))
        diagnostics.extend(self._validate_object_collisions(object_boxes))
        diagnostics.extend(self._validate_blocked_doors(room, openings, object_boxes))
        return diagnostics

    def _validate_opening(
        self,
        room: RoomPlan,
        element: SpatialElement,
        geometry: NormalizedSpatialGeometry,
    ) -> tuple[list[Diagnostic], _OpeningGeometry | None]:
        diagnostics: list[Diagnostic] = []
        numeric_properties = [geometry.width, geometry.height, geometry.offset]
        if element.element_kind == "window":
            numeric_properties.append(geometry.elevation)
        for spatial_property in numeric_properties:
            if spatial_property is None:
                continue
            if spatial_property.name in {"ancho", "alto"} and spatial_property.value <= 0:
                diagnostics.append(
                    self._diagnostic(
                        "SPA_INVALID_PROPERTY",
                        spatial_property.source,
                        (
                            f"La propiedad '{spatial_property.name}' del elemento "
                            f"'{element.name}' debe ser mayor que cero."
                        ),
                        "Utilice una dimensión positiva.",
                    )
                )

        required = [geometry.orientation, geometry.width, geometry.height, geometry.offset]
        if element.element_kind == "window":
            required.append(geometry.elevation)
        if diagnostics or any(item is None for item in required):
            return diagnostics, None

        orientation = geometry.orientation.value
        if orientation not in {"norte", "sur", "este", "oeste"}:
            return diagnostics, None
        width = float(geometry.width.value)
        height = float(geometry.height.value)
        offset = float(geometry.offset.value)
        elevation = float(geometry.elevation.value) if geometry.elevation else 0.0
        span = (
            float(room.width.value)
            if orientation in {"norte", "sur"}
            else float(room.length.value)
        )
        horizontal_valid = offset >= 0 and offset + width <= span
        vertical_valid = elevation >= 0 and elevation + height <= room.height.value
        if not horizontal_valid or not vertical_valid:
            source = geometry.offset.source if not horizontal_valid else (
                geometry.elevation.source if geometry.elevation else geometry.height.source
            )
            diagnostics.append(
                self._diagnostic(
                    "SPA_OBJECT_OUT_OF_BOUNDS",
                    source,
                    (
                        f"La abertura '{element.name}' excede los límites de la "
                        f"pared '{orientation}' de la habitación '{room.name}'."
                    ),
                    "Ajuste el desplazamiento, la elevación o las dimensiones.",
                )
            )
            return diagnostics, None
        return diagnostics, _OpeningGeometry(
            element,
            geometry,
            orientation,
            width,
            height,
            offset,
            elevation,
        )

    def _validate_opening_overlaps(
        self,
        openings: list[_OpeningGeometry],
    ) -> list[Diagnostic]:
        diagnostics: list[Diagnostic] = []
        for index, current in enumerate(openings):
            for previous in openings[:index]:
                horizontal_overlap = (
                    current.orientation == previous.orientation
                    and current.offset < previous.offset + previous.width
                    and previous.offset < current.offset + current.width
                )
                vertical_overlap = (
                    current.elevation < previous.elevation + previous.height
                    and previous.elevation < current.elevation + current.height
                )
                if horizontal_overlap and vertical_overlap:
                    diagnostics.append(
                        self._diagnostic(
                            "SPA_OBJECT_COLLISION",
                            current.element.source,
                            (
                                f"La abertura '{current.element.name}' se superpone "
                                f"con '{previous.element.name}' en la pared "
                                f"'{current.orientation}'."
                            ),
                            "Separe las aberturas de la pared.",
                        )
                    )
        return diagnostics

    def _object_boxes(
        self,
        room: RoomPlan,
    ) -> list[tuple[SpatialElement, OrientedBox]]:
        result: list[tuple[SpatialElement, OrientedBox]] = []
        for element in room.elements:
            if element.element_kind != "object":
                continue
            position = self._vector_values(element.position)
            if position is None:
                continue
            rotation = self._vector_values(element.rotation) or (0.0, 0.0, 0.0)
            width, height, depth = furniture_dimensions(element.object_type)
            result.append(
                (
                    element,
                    box_from_floor_pivot(
                        Point3(*position),
                        Point3(width, height, depth),
                        Point3(*rotation),
                    ),
                )
            )
        return result

    def _validate_object_bounds(
        self,
        room: RoomPlan,
        object_boxes: list[tuple[SpatialElement, OrientedBox]],
    ) -> list[Diagnostic]:
        bounds = AxisAlignedBounds(
            Point3(-room.width.value / 2, 0.0, -room.length.value / 2),
            Point3(room.width.value / 2, room.height.value, room.length.value / 2),
        )
        return [
            self._diagnostic(
                "SPA_OBJECT_OUT_OF_BOUNDS",
                element.position.source,
                (
                    f"El objeto '{element.name}' está fuera de los límites de la "
                    f"habitación '{room.name}'."
                ),
                "Mueva el objeto completamente dentro de la habitación.",
            )
            for element, box in object_boxes
            if not box_within_bounds(box, bounds)
        ]

    def _validate_object_collisions(
        self,
        object_boxes: list[tuple[SpatialElement, OrientedBox]],
    ) -> list[Diagnostic]:
        diagnostics: list[Diagnostic] = []
        for index, (current_element, current_box) in enumerate(object_boxes):
            for previous_element, previous_box in object_boxes[:index]:
                if boxes_intersect(
                    previous_box,
                    current_box,
                    touching_counts=False,
                ):
                    diagnostics.append(
                        self._diagnostic(
                            "SPA_OBJECT_COLLISION",
                            current_element.position.source,
                            (
                                f"El objeto '{current_element.name}' colisiona con "
                                f"'{previous_element.name}'."
                            ),
                            "Separe físicamente los objetos.",
                        )
                    )
        return diagnostics

    @staticmethod
    def _door_clearance_box(room: RoomPlan, door: _OpeningGeometry) -> OrientedBox:
        span = room.width.value if door.orientation in {"norte", "sur"} else room.length.value
        along = -span / 2 + door.offset + door.width / 2
        half_depth = 0.4
        if door.orientation == "norte":
            center = Point3(along, room.height.value / 2, -room.length.value / 2 + half_depth)
            dimensions = Point3(door.width, room.height.value, 0.8)
        elif door.orientation == "sur":
            center = Point3(along, room.height.value / 2, room.length.value / 2 - half_depth)
            dimensions = Point3(door.width, room.height.value, 0.8)
        elif door.orientation == "este":
            center = Point3(room.width.value / 2 - half_depth, room.height.value / 2, along)
            dimensions = Point3(0.8, room.height.value, door.width)
        else:
            center = Point3(-room.width.value / 2 + half_depth, room.height.value / 2, along)
            dimensions = Point3(0.8, room.height.value, door.width)
        return OrientedBox(center, Point3(dimensions.x / 2, dimensions.y / 2, dimensions.z / 2))

    def _validate_blocked_doors(
        self,
        room: RoomPlan,
        openings: list[_OpeningGeometry],
        object_boxes: list[tuple[SpatialElement, OrientedBox]],
    ) -> list[Diagnostic]:
        diagnostics: list[Diagnostic] = []
        for door in openings:
            if door.element.element_kind != "door":
                continue
            clearance = self._door_clearance_box(room, door)
            for element, object_box in object_boxes:
                if boxes_intersect(clearance, object_box, touching_counts=False):
                    diagnostics.append(
                        self._diagnostic(
                            "SPA_BLOCKED_DOOR",
                            element.position.source,
                            (
                                f"El objeto '{element.name}' bloquea la zona libre "
                                f"de 0,80 m de la puerta '{door.element.name}'."
                            ),
                            "Mueva el objeto fuera de la zona de paso.",
                        )
                    )
        return diagnostics
def _source_fields(value: SpatialNumber | SpatialElement | object) -> dict:
    source = value.source
    return {"file": source.file, "line": source.line, "column": source.column}
