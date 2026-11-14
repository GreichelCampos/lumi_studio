"""Static type and constant-value checks for Lumi spatial syntax."""

from collections.abc import Callable
from contextlib import contextmanager
from typing import Any

from spatial.spatial_rules import (
    PropertyRuleViolation,
    SpatialElementState,
    SpatialOperation,
    SpatialTransitionViolation,
    apply_element_operation,
    allowed_properties_for,
    dimension_diagnostic,
    multiple_floors_diagnostic,
    property_diagnostic,
    property_expected_type,
    validate_dimension_value,
    validate_element_declaration,
    validate_room_start,
    validate_vector_component_value,
    vector_diagnostic,
)

from .constant_evaluator import Known, evaluate_numeric_constant
from .diagnostics import Diagnostic, DiagnosticCategory
from .symbol_table import DataType


NUMERIC_TYPES = frozenset({DataType.INTEGER, DataType.DECIMAL})
SPATIAL_NODE_TYPES = frozenset({
    "RoomNode", "SpatialObjectDeclarationNode", "FloorNode", "WallNode",
    "DoorNode", "WindowNode", "PlaceObjectNode", "MoveObjectNode",
    "RotateObjectNode",
})
ELEMENT_KINDS = {
    "SpatialObjectDeclarationNode": "object",
    "FloorNode": "floor",
    "WallNode": "wall",
    "DoorNode": "door",
    "WindowNode": "window",
}


class SpatialSemanticAnalyzer:
    """Analyze spatial nodes through the general semantic infrastructure."""

    def __init__(
        self,
        *,
        infer_expression: Callable[[dict[str, Any]], DataType | None],
        analyze_block: Callable[[list[dict[str, Any]], str], None],
        add_diagnostic: Callable[..., None],
        append_spatial_diagnostic: Callable[
            [Diagnostic, dict[str, Any], tuple], None
        ],
        diagnostic_count: Callable[[], int],
    ) -> None:
        self._infer_expression = infer_expression
        self._analyze_block = analyze_block
        self._add_diagnostic = add_diagnostic
        self._append_spatial_diagnostic = append_spatial_diagnostic
        self._diagnostic_count = diagnostic_count
        self._linear_suspensions = 0
        self._room_names: set[str] = set()
        self._active_room: str | None = None
        self._elements: dict[str, SpatialElementState] = {}

    @contextmanager
    def suspend_linear_analysis(self):
        """Keep expression checks while ignoring uncertain spatial effects."""

        self._linear_suspensions += 1
        try:
            yield
        finally:
            self._linear_suspensions -= 1

    @property
    def _linear_analysis_enabled(self) -> bool:
        return self._linear_suspensions == 0

    def handles(self, node_type: str) -> bool:
        return node_type in SPATIAL_NODE_TYPES

    def analyze(self, node: dict[str, Any]) -> None:
        node_type = node["node"]
        if node_type == "RoomNode":
            self._analyze_room(node)
        elif node_type in ELEMENT_KINDS:
            self._analyze_properties(node, ELEMENT_KINDS[node_type])
            self._declare_element(node)
        elif node_type in {"PlaceObjectNode", "MoveObjectNode"}:
            self._analyze_vector(
                node["position"], node["object_name"], "posición",
            )
            operation = (
                SpatialOperation.PLACE
                if node_type == "PlaceObjectNode"
                else SpatialOperation.MOVE
            )
            self._apply_operation(node, operation)
        elif node_type == "RotateObjectNode":
            self._analyze_vector(
                node["rotation"], node["object_name"], "rotación",
            )
            self._apply_operation(node, SpatialOperation.ROTATE)

    def _analyze_room(self, node: dict[str, Any]) -> None:
        dimensions = (
            ("ancho", node["width"]),
            ("largo", node["length"]),
            ("alto", node["height"]),
        )
        for dimension_name, dimension in dimensions:
            dimension_type, inference_failed = self._infer_once(dimension)
            if inference_failed:
                continue
            if dimension_type not in NUMERIC_TYPES:
                self._add_diagnostic(
                    dimension,
                    "SEM_SPATIAL_DIMENSION_NOT_NUMERIC",
                    "Las dimensiones de una habitacion deben ser numericas.",
                    "Utilice una expresion de tipo entero o decimal.",
                    cause=(dimension_type, "spatial-dimension"),
                )
                continue

            constant = evaluate_numeric_constant(dimension)
            if isinstance(constant, Known):
                violation = validate_dimension_value(constant.value)
                if violation is not None:
                    diagnostic = dimension_diagnostic(
                        room_name=node["name"],
                        dimension_name=dimension_name,
                        violation=violation,
                        **self._location(dimension),
                    )
                    self._append_spatial_diagnostic(
                        diagnostic, dimension,
                        (dimension_name, violation, "constant-dimension"),
                    )

        self._analyze_direct_floors(node)
        if not self._linear_analysis_enabled:
            self._analyze_block(node.get("body", []), "room")
            return

        violation = validate_room_start(
            room_active=self._active_room is not None,
            room_exists=node["name"] in self._room_names,
        )
        if violation is SpatialTransitionViolation.DUPLICATE_ROOM:
            self._report_transition(violation, node, room_name=node["name"])
            with self.suspend_linear_analysis():
                self._analyze_block(node.get("body", []), "room")
            return
        if violation is SpatialTransitionViolation.ROOM_ALREADY_ACTIVE:
            with self.suspend_linear_analysis():
                self._analyze_block(node.get("body", []), "room")
            return

        self._room_names.add(node["name"])
        self._active_room = node["name"]
        self._elements = {}
        try:
            self._analyze_block(node.get("body", []), "room")
        finally:
            self._active_room = None
            self._elements = {}

    def _declare_element(self, node: dict[str, Any]) -> None:
        if not self._linear_analysis_enabled or self._active_room is None:
            return
        name = node["name"]
        violation = validate_element_declaration(
            room_active=True,
            element_exists=name in self._elements,
        )
        if violation is not None:
            self._report_transition(
                violation, node, room_name=self._active_room,
                element_name=name,
            )
            return
        self._elements[name] = SpatialElementState()

    def _apply_operation(
        self, node: dict[str, Any], operation: SpatialOperation,
    ) -> None:
        if not self._linear_analysis_enabled:
            return
        name = node["object_name"]
        next_state, violation = apply_element_operation(
            room_active=self._active_room is not None,
            element_state=self._elements.get(name),
            operation=operation,
        )
        if violation is not None:
            self._report_transition(
                violation, node, room_name=self._active_room,
                element_name=name,
            )
            return
        assert next_state is not None
        self._elements[name] = next_state

    def _report_transition(
        self,
        violation: SpatialTransitionViolation,
        node: dict[str, Any],
        *,
        room_name: str | None = None,
        element_name: str | None = None,
    ) -> None:
        details = {
            SpatialTransitionViolation.DUPLICATE_ROOM: (
                "SPA_DUPLICATE_ROOM",
                f"La habitación '{room_name}' ya fue declarada.",
                "Utilice un nombre diferente para cada habitación.",
            ),
            SpatialTransitionViolation.DUPLICATE_ELEMENT: (
                "SPA_DUPLICATE_ELEMENT",
                f"El elemento '{element_name}' ya está declarado en la "
                f"habitación '{room_name}'.",
                "Utilice un nombre diferente dentro de la habitación.",
            ),
            SpatialTransitionViolation.ELEMENT_NOT_FOUND: (
                "SPA_ELEMENT_NOT_FOUND",
                f"El elemento '{element_name}' no está declarado en la "
                f"habitación '{room_name}'.",
                "Declare el elemento antes de utilizarlo.",
            ),
            SpatialTransitionViolation.ELEMENT_ALREADY_PLACED: (
                "SPA_ELEMENT_ALREADY_PLACED",
                f"El elemento '{element_name}' ya tiene una posición inicial.",
                "Utilice 'mover' para reemplazar su posición.",
            ),
            SpatialTransitionViolation.ELEMENT_NOT_PLACED: (
                "SPA_ELEMENT_NOT_PLACED",
                f"El elemento '{element_name}' debe colocarse antes de moverlo.",
                "Coloque el elemento antes de moverlo.",
            ),
            SpatialTransitionViolation.NO_ACTIVE_ROOM: (
                "SPA_OPERATION_OUTSIDE_ROOM",
                "La operación espacial requiere una habitación activa.",
                "Mueva la operación al cuerpo de una habitación.",
            ),
        }
        code, description, suggestion = details[violation]
        diagnostic = Diagnostic(
            category=DiagnosticCategory.SPATIAL,
            code=code,
            description=description,
            suggestion=suggestion,
            **self._location(node),
        )
        self._append_spatial_diagnostic(
            diagnostic, node,
            (violation, room_name, element_name, "linear-transition"),
        )

    def _analyze_direct_floors(self, room: dict[str, Any]) -> None:
        floor_found = False
        for statement in room.get("body", []):
            if statement.get("node") != "FloorNode":
                continue
            if not floor_found:
                floor_found = True
                continue
            diagnostic = multiple_floors_diagnostic(
                room_name=room["name"], **self._location(statement),
            )
            self._append_spatial_diagnostic(
                diagnostic, statement,
                (room["name"], "direct-multiple-floors"),
            )

    def _analyze_vector(
        self, vector: dict[str, Any], element_name: str, vector_name: str,
    ) -> None:
        for component_name in ("x", "y", "z"):
            component = vector[component_name]
            component_type, inference_failed = self._infer_once(component)
            if inference_failed:
                continue
            if component_type not in NUMERIC_TYPES:
                if component_type is not None:
                    self._add_diagnostic(
                        component,
                        "SEM_VECTOR_COMPONENT_NOT_NUMERIC",
                        "Los componentes de un vector deben ser numéricos.",
                        "Utilice valores de tipo entero o decimal.",
                        cause=(component_type,),
                    )
                continue

            constant = evaluate_numeric_constant(component)
            if not isinstance(constant, Known):
                continue
            violation = validate_vector_component_value(constant.value)
            if violation is None:
                continue
            diagnostic = vector_diagnostic(
                element_name=element_name,
                vector_name=vector_name,
                component_name=component_name,
                violation=violation,
                **self._location(component),
            )
            self._append_spatial_diagnostic(
                diagnostic, component,
                (element_name, vector_name, component_name, violation),
            )

    def _analyze_properties(
        self, node: dict[str, Any], element_kind: str,
    ) -> None:
        seen: set[str] = set()
        for property_node in node.get("properties", []):
            name = property_node["name"]
            if name in seen:
                diagnostic = property_diagnostic(
                    element_name=node["name"],
                    element_kind=element_kind,
                    property_name=name,
                    violation=PropertyRuleViolation.DUPLICATE,
                    **self._location(property_node),
                )
                self._append_spatial_diagnostic(
                    diagnostic, property_node,
                    (node["name"], name, "duplicate-property"),
                )
                continue
            seen.add(name)

            if name not in allowed_properties_for(element_kind):
                diagnostic = property_diagnostic(
                    element_name=node["name"],
                    element_kind=element_kind,
                    property_name=name,
                    violation=PropertyRuleViolation.NOT_ALLOWED,
                    **self._location(property_node),
                )
                self._append_spatial_diagnostic(
                    diagnostic, property_node,
                    (node["name"], name, "property-not-allowed"),
                )
                continue

            value = property_node["value"]
            value_type, inference_failed = self._infer_once(value)
            if inference_failed:
                continue
            expected_family = property_expected_type(name)
            if expected_family == "text":
                expected = "texto"
                compatible = value_type is DataType.STRING
            elif expected_family == "numeric":
                expected = "entero o decimal"
                compatible = value_type in NUMERIC_TYPES
            else:
                continue
            if not compatible:
                self._add_diagnostic(
                    value,
                    "SEM_SPATIAL_PROPERTY_TYPE_MISMATCH",
                    (
                        f"La propiedad espacial '{name}' requiere un valor "
                        f"de tipo {expected}."
                    ),
                    "Utilice una expresion compatible con la propiedad.",
                    cause=(name, value_type, "spatial-property"),
                )

    def _infer_once(
        self, expression: dict[str, Any],
    ) -> tuple[DataType | None, bool]:
        before = self._diagnostic_count()
        expression_type = self._infer_expression(expression)
        return expression_type, self._diagnostic_count() > before

    @staticmethod
    def _location(node: dict[str, Any]) -> dict[str, str | int]:
        return {
            "file": node.get("file", "<desconocido>"),
            "line": node.get("line", 1),
            "column": node.get("column", 1),
        }
