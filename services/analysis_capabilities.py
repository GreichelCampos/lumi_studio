"""Identify known analysis gaps without interpreting or validating AST nodes."""

from dataclasses import fields, is_dataclass
from typing import Iterable

from lumi_language.ast_nodes import (
    DoorNode,
    FloorNode,
    MoveObjectNode,
    PlaceObjectNode,
    ProgramNode,
    RoomNode,
    RotateObjectNode,
    SpatialObjectDeclarationNode,
    WallNode,
    WindowNode,
)

from .results import AnalysisLimitation


SPATIAL_NODE_TYPES = (
    RoomNode, SpatialObjectDeclarationNode, FloorNode, WallNode, DoorNode,
    WindowNode, PlaceObjectNode, MoveObjectNode, RotateObjectNode,
)


def analysis_limitations(
    programs: Iterable[ProgramNode],
    *, resolved_room_ids: frozenset[int] = frozenset(),
) -> tuple[AnalysisLimitation, ...]:
    """Flag spatial syntax even in uncalled functions or unselected branches.

    Resolved room identities refer to AST instances, not exported scene IDs.
    This only inspects node types. It does not evaluate expressions, follow
    control flow, resolve imports, or determine spatial correctness.
    """
    pending: list[object] = list(programs)
    while pending:
        value = pending.pop()
        if isinstance(value, SPATIAL_NODE_TYPES):
            if isinstance(value, RoomNode) and id(value) in resolved_room_ids:
                continue
            return (AnalysisLimitation.SPATIAL_SEMANTICS_UNAVAILABLE,)
        if is_dataclass(value) and not isinstance(value, type):
            pending.extend(getattr(value, item.name) for item in fields(value))
        elif isinstance(value, (list, tuple)):
            pending.extend(value)
    return ()
