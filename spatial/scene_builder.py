"""Resolve direct, empty rooms with literal dimensions without executing Lumi."""

from dataclasses import dataclass
from math import isfinite

from lumi_language.ast_nodes import LiteralNode, MainNode, ProgramNode, RoomNode, UnaryExpressionNode
from lumi_language.diagnostics import Diagnostic, DiagnosticCategory

from .scene_plan import RoomPlan, ScenePlan, SourceLocation, SpatialNumber
from .spatial_validator import SpatialValidator


@dataclass(frozen=True, slots=True)
class SceneBuildResult:
    scene_plan: ScenePlan | None
    diagnostics: tuple[Diagnostic, ...]
    resolved_room_ids: frozenset[int]


class SceneBuilder:
    def build(self, program: ProgramNode) -> SceneBuildResult:
        for statement in program.statements:
            if not isinstance(statement, MainNode):
                return SceneBuildResult(None, (), frozenset())
            if any(not isinstance(node, RoomNode) for node in statement.body):
                return SceneBuildResult(None, (), frozenset())
        rooms: list[RoomPlan] = []
        resolved: set[int] = set()
        for statement in program.statements:
            for node in statement.body:
                if not isinstance(node, RoomNode) or node.body:
                    continue
                dimensions = [self._literal(value) for value in (node.width, node.length, node.height)]
                if any(value is None for value in dimensions):
                    continue
                width, length, height = dimensions
                assert width is not None and length is not None and height is not None
                rooms.append(RoomPlan(node.name, width, length, height, (), self._location(node)))
                resolved.add(id(node))
        if not rooms:
            return SceneBuildResult(None, (), frozenset())
        scene = ScenePlan(tuple(rooms), self._location(program))
        diagnostics = SpatialValidator().validate(scene).diagnostics
        if not diagnostics:
            diagnostics = tuple(error for room in rooms for error in self._validate_metrics(room))
        return SceneBuildResult(None if diagnostics else scene, diagnostics, frozenset(resolved))

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
    def _location(node: ProgramNode | RoomNode | LiteralNode | UnaryExpressionNode) -> SourceLocation:
        return SourceLocation(node.file, node.line, node.column)

    def _literal(self, node: object) -> SpatialNumber | None:
        if isinstance(node, LiteralNode):
            return SpatialNumber(node.value, self._location(node))
        if isinstance(node, UnaryExpressionNode) and node.operator == "-" and isinstance(node.operand, LiteralNode):
            value = node.operand.value
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                return SpatialNumber(-value, self._location(node))
        return None
