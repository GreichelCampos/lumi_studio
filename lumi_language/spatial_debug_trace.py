"""Immutable internal contracts for spatial execution traces."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypeAlias

from spatial.scene_plan import ScenePlan, SourceLocation


SpatialTraceEvent: TypeAlias = Literal[
    "start",
    "room_create",
    "declaration",
    "place_object",
    "move_object",
    "rotate_object",
    "end",
]
SpatialTraceValue: TypeAlias = str | int | float | bool | None


@dataclass(frozen=True, slots=True)
class SpatialTraceStep:
    """One successfully observed spatial event and its immutable scene state."""

    index: int
    event_type: SpatialTraceEvent
    description: str
    source: SourceLocation
    scene_snapshot: ScenePlan
    room_name: str | None = None
    element_name: str | None = None
    spatial_state: tuple[tuple[str, SpatialTraceValue], ...] = ()


@dataclass(frozen=True, slots=True)
class SpatialDebugTrace:
    """Trace outcome for one interpreter execution.

    An unavailable trace never exposes a partial prefix as if it were complete.
    The interpreter can therefore continue normally after reaching the limit
    while consumers can distinguish that execution from a complete trace.
    """

    steps: tuple[SpatialTraceStep, ...] = ()
    complete: bool = True
    unavailable_reason: str | None = None

    @classmethod
    def unavailable(cls, reason: str) -> SpatialDebugTrace:
        return cls(steps=(), complete=False, unavailable_reason=reason)


class SpatialTraceRecorder:
    """Mutable execution-local collector that only publishes immutable data."""

    def __init__(self, max_steps: int) -> None:
        if max_steps <= 0:
            raise ValueError("max_steps must be positive")
        self._max_steps = max_steps
        self._steps: list[SpatialTraceStep] = []
        self._unavailable_reason: str | None = None

    def record(
        self,
        *,
        event_type: SpatialTraceEvent,
        description: str,
        source: SourceLocation,
        scene_snapshot: ScenePlan,
        room_name: str | None = None,
        element_name: str | None = None,
        spatial_state: tuple[tuple[str, SpatialTraceValue], ...] = (),
    ) -> None:
        if self._unavailable_reason is not None:
            return
        if len(self._steps) >= self._max_steps:
            self._steps.clear()
            self._unavailable_reason = "step_limit_exceeded"
            return
        self._steps.append(
            SpatialTraceStep(
                index=len(self._steps),
                event_type=event_type,
                description=description,
                source=source,
                scene_snapshot=scene_snapshot,
                room_name=room_name,
                element_name=element_name,
                spatial_state=spatial_state,
            )
        )

    def finish(self) -> SpatialDebugTrace:
        if self._unavailable_reason is not None:
            return SpatialDebugTrace.unavailable(self._unavailable_reason)
        return SpatialDebugTrace(steps=tuple(self._steps))
