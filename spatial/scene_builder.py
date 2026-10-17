"""Resolve direct rooms and literal floor properties without executing Lumi."""

from dataclasses import dataclass
from math import isfinite

from lumi_language.ast_nodes import (
    FloorNode, LiteralNode, MainNode, ProgramNode, RoomNode,
    SpatialPropertyNode, UnaryExpressionNode,
)
from lumi_language.diagnostics import Diagnostic, DiagnosticCategory

from .scene_plan import RoomPlan, ScenePlan, SourceLocation, SpatialElement, SpatialNumber, SpatialProperty
from .spatial_validator import SpatialValidator


@dataclass(frozen=True, slots=True)
class SceneBuildResult:
    scene_plan: ScenePlan | None
    diagnostics: tuple[Diagnostic, ...]
    resolved_room_ids: frozenset[int]


class SceneBuilder:
    def build(self, program: ProgramNode) -> SceneBuildResult:
        declarations: list[RoomNode] = []
        for statement in program.statements:
            if isinstance(statement, RoomNode):
                declarations.append(statement)
            elif isinstance(statement, MainNode) and all(isinstance(node, RoomNode) for node in statement.body):
                declarations.extend(statement.body)
            else:
                return SceneBuildResult(None, (), frozenset())
        rooms: list[RoomPlan] = []
        resolved: set[int] = set()
        for node in declarations:
            elements = self._floor_elements(node)
            if elements is None:
                continue
            dimensions = [self._literal(value) for value in (node.width, node.length, node.height)]
            if any(value is None for value in dimensions):
                continue
            width, length, height = dimensions
            assert width is not None and length is not None and height is not None
            rooms.append(RoomPlan(node.name, width, length, height, elements, self._location(node)))
            resolved.add(id(node))
        if not rooms:
            return SceneBuildResult(None, (), frozenset())
        scene = ScenePlan(tuple(rooms), self._location(program))
        diagnostics = SpatialValidator().validate(scene).diagnostics
        if not diagnostics:
            diagnostics = tuple(error for room in rooms for error in self._validate_metrics(room))
        return SceneBuildResult(None if diagnostics else scene, diagnostics, frozenset(resolved))

    def _floor_elements(self, room: RoomNode) -> tuple[SpatialElement, ...] | None:
        if not room.body:
            return ()
        if len(room.body) != 1 or not isinstance(room.body[0], FloorNode):
            return None
        floor = room.body[0]
        if any(not isinstance(prop.value, LiteralNode) for prop in floor.properties):
            return None
        properties = tuple(
            SpatialProperty(prop.name, prop.value.value, self._location(prop))
            for prop in floor.properties
        )
        return (SpatialElement(floor.name, "floor", None, properties, None, None, self._location(floor)),)

    @staticmethod
    def _validate_metrics(room: RoomPlan) -> tuple[Diagnostic, ...]:
        width, length, height = room.width.value, room.length.value, room.height.value
        try:
            if all(isfinite(value) for value in (width, length, height, width * length, width * length * height)):
                return ()
        except OverflowError:
            pass
        source = room.width.source
        return (Diagnostic(
            category=DiagnosticCategory.SPATIAL, code="SPA_INVALID_DIMENSION",
            file=source.file, line=source.line, column=source.column,
            description="Las dimensiones no permiten representar la habitación, su área y su volumen con números finitos.",
            suggestion="Utilice dimensiones numéricas de menor magnitud.",
        ),)

    @staticmethod
    def _location(node: ProgramNode | RoomNode | FloorNode | SpatialPropertyNode | LiteralNode | UnaryExpressionNode) -> SourceLocation:
        return SourceLocation(node.file, node.line, node.column)

    def _literal(self, node: object) -> SpatialNumber | None:
        if isinstance(node, LiteralNode):
            return SpatialNumber(node.value, self._location(node))
        if isinstance(node, UnaryExpressionNode) and node.operator == "-" and isinstance(node.operand, LiteralNode):
            value = node.operand.value
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                return SpatialNumber(-value, self._location(node))
        return None
