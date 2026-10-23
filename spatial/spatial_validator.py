"""Spatial validation for resolved Lumi scene plans."""

from dataclasses import dataclass
from math import isfinite

from lumi_language.diagnostics import Diagnostic, DiagnosticCategory

from .scene_plan import (
    RoomPlan,
    ScenePlan,
    SpatialElement,
    SpatialNumber,
    Vector3,
)


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
        return SpatialValidationResult(diagnostics=tuple(diagnostics))

    def _validate_room_dimensions(self, room: RoomPlan) -> list[Diagnostic]:
        diagnostics = []
        dimensions = (
            ("ancho", room.width),
            ("largo", room.length),
            ("alto", room.height),
        )
        for dimension_name, dimension in dimensions:
            diagnostic = self._validate_dimension(
                room.name,
                dimension_name,
                dimension,
            )
            if diagnostic is not None:
                diagnostics.append(diagnostic)
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
            source = element.source
            diagnostics.append(
                Diagnostic(
                    category=DiagnosticCategory.SPATIAL,
                    code="SPA_MULTIPLE_FLOORS",
                    file=source.file,
                    line=source.line,
                    column=source.column,
                    description=(
                        f"La habitación '{room.name}' contiene más de un piso."
                    ),
                    suggestion=(
                        "Conserve como máximo una declaración de piso "
                        "por habitación."
                    ),
                )
            )
        return diagnostics

    @staticmethod
    def _validate_dimension(
        room_name: str,
        dimension_name: str,
        dimension: SpatialNumber,
    ) -> Diagnostic | None:
        value = dimension.value
        source = dimension.source

        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return Diagnostic(
                category=DiagnosticCategory.SPATIAL,
                code="SPA_INVALID_DIMENSION",
                file=source.file,
                line=source.line,
                column=source.column,
                description=(
                    f"La dimensión '{dimension_name}' de la habitación "
                    f"'{room_name}' debe ser numérica."
                ),
                suggestion="Utilice un valor de tipo entero o decimal.",
            )

        if isinstance(value, float) and not isfinite(value):
            return Diagnostic(
                category=DiagnosticCategory.SPATIAL,
                code="SPA_INVALID_DIMENSION",
                file=source.file,
                line=source.line,
                column=source.column,
                description=(
                    f"La dimensión '{dimension_name}' de la habitación "
                    f"'{room_name}' debe ser un número finito."
                ),
                suggestion="Utilice un valor que no sea infinito ni NaN.",
            )

        if value <= 0:
            return Diagnostic(
                category=DiagnosticCategory.SPATIAL,
                code="SPA_INVALID_DIMENSION",
                file=source.file,
                line=source.line,
                column=source.column,
                description=(
                    f"La dimensión '{dimension_name}' de la habitación "
                    f"'{room_name}' debe ser mayor que cero."
                ),
                suggestion="Utilice un valor numérico positivo.",
            )

        return None

    def _validate_element_vectors(
        self,
        element: SpatialElement,
    ) -> list[Diagnostic]:
        diagnostics = []
        vectors = (
            ("posición", element.position),
            ("rotación", element.rotation),
        )
        for vector_name, vector in vectors:
            if vector is not None:
                diagnostics.extend(
                    self._validate_vector(element.name, vector_name, vector)
                )
        return diagnostics

    def _validate_vector(
        self,
        element_name: str,
        vector_name: str,
        vector: Vector3,
    ) -> list[Diagnostic]:
        diagnostics = []
        for component_name, component in (
            ("x", vector.x),
            ("y", vector.y),
            ("z", vector.z),
        ):
            diagnostic = self._validate_vector_component(
                element_name,
                vector_name,
                component_name,
                component,
            )
            if diagnostic is not None:
                diagnostics.append(diagnostic)
        return diagnostics

    @staticmethod
    def _validate_vector_component(
        element_name: str,
        vector_name: str,
        component_name: str,
        component: SpatialNumber,
    ) -> Diagnostic | None:
        value = component.value
        source = component.source

        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return Diagnostic(
                category=DiagnosticCategory.SPATIAL,
                code="SPA_INVALID_VECTOR",
                file=source.file,
                line=source.line,
                column=source.column,
                description=(
                    f"El componente '{component_name}' de la {vector_name} "
                    f"del elemento '{element_name}' debe ser numérico."
                ),
                suggestion="Utilice un valor de tipo entero o decimal.",
            )

        if isinstance(value, float) and not isfinite(value):
            return Diagnostic(
                category=DiagnosticCategory.SPATIAL,
                code="SPA_INVALID_VECTOR",
                file=source.file,
                line=source.line,
                column=source.column,
                description=(
                    f"El componente '{component_name}' de la {vector_name} "
                    f"del elemento '{element_name}' debe ser un número finito."
                ),
                suggestion="Utilice un valor que no sea infinito ni NaN.",
            )

        return None


    def _validate_element_properties(
        self,
        element: SpatialElement,
    ) -> list[Diagnostic]:
        diagnostics = []
        seen_properties: set[str] = set()

        for spatial_property in element.properties:
            property_name = spatial_property.name
            source = spatial_property.source

            if property_name in seen_properties:
                diagnostics.append(
                    Diagnostic(
                        category=DiagnosticCategory.SPATIAL,
                        code="SPA_INVALID_PROPERTY",
                        file=source.file,
                        line=source.line,
                        column=source.column,
                        description=(
                            f"La propiedad '{property_name}' del elemento "
                            f"'{element.name}' está duplicada."
                        ),
                        suggestion=(
                            "Conserve una sola declaración de la propiedad."
                        ),
                    )
                )
                continue

            seen_properties.add(property_name)
            if property_name not in {"color", "material"}:
                diagnostics.append(
                    Diagnostic(
                        category=DiagnosticCategory.SPATIAL,
                        code="SPA_INVALID_PROPERTY",
                        file=source.file,
                        line=source.line,
                        column=source.column,
                        description=(
                            f"La propiedad '{property_name}' del elemento "
                            f"'{element.name}' no está permitida."
                        ),
                        suggestion="Utilice la propiedad 'color' o 'material'.",
                    )
                )
                continue

            if not isinstance(spatial_property.value, str):
                diagnostics.append(
                    Diagnostic(
                        category=DiagnosticCategory.SPATIAL,
                        code="SPA_INVALID_PROPERTY",
                        file=source.file,
                        line=source.line,
                        column=source.column,
                        description=(
                            f"La propiedad '{property_name}' del elemento "
                            f"'{element.name}' debe contener un valor de texto."
                        ),
                        suggestion="Utilice un valor de texto.",
                    )
                )

        return diagnostics
