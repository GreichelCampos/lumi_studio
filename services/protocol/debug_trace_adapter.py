"""Prepare internal spatial traces for a future protocol capability."""

from __future__ import annotations

from dataclasses import dataclass
import json
from typing import Mapping, cast

from lumi_language.spatial_debug_trace import SpatialDebugTrace, SpatialTraceStep

from .models import DebugEventType, DebugStepDTO, MAX_RESPONSE_BYTES
from .scene_adapter import RoomDTO, ScenePlanDTO, scene_plan_dto


@dataclass(frozen=True, slots=True)
class DebugTraceAdaptation:
    """Isolated DTO conversion result, not yet part of public responses."""

    debug_steps: tuple[DebugStepDTO, ...] = ()
    complete: bool = False
    unavailable_reason: str | None = None
    serialized_size_bytes: int = 0

    @property
    def available(self) -> bool:
        return self.complete

    @classmethod
    def unavailable(cls, reason: str) -> DebugTraceAdaptation:
        return cls(unavailable_reason=reason)


def _code_line(step: SpatialTraceStep, sources: Mapping[str, str]) -> str | None:
    source = sources.get(step.source.file)
    if source is None:
        return None
    lines = source.splitlines()
    if not lines and step.source.line == 1:
        return ""
    if 1 <= step.source.line <= len(lines):
        return lines[step.source.line - 1]
    return None


def _room_for_step(step: SpatialTraceStep, scene: ScenePlanDTO) -> RoomDTO | None:
    if step.room_name is None:
        return None
    return next(
        (room for room in scene["rooms"] if room["name"] == step.room_name),
        None,
    )


def _active_element_id(step: SpatialTraceStep, room: RoomDTO | None) -> str | None:
    if room is None or step.element_name is None:
        return None
    for collection_name in ("objects", "doors", "windows"):
        for element in room[collection_name]:
            if element["name"] == step.element_name:
                return element["id"]
    for wall in room["walls"].values():
        if wall.get("name") == step.element_name:
            return wall.get("id")
    return None


def _step_dto(
    step: SpatialTraceStep,
    sources: Mapping[str, str],
) -> DebugStepDTO | None:
    code_line = _code_line(step, sources)
    if code_line is None:
        return None
    snapshot = scene_plan_dto(step.scene_snapshot)
    room = _room_for_step(step, snapshot)
    result: DebugStepDTO = {
        "id": f"step-{step.index}",
        "stepIndex": step.index,
        "eventType": cast(DebugEventType, step.event_type),
        "description": step.description,
        "sourceRef": {
            "file": step.source.file,
            "line": step.source.line,
            "column": step.source.column,
        },
        "lineNumber": step.source.line,
        "codeLine": code_line,
        "actionDescription": step.description,
        "sceneSnapshot": snapshot,
    }
    if room is not None:
        result["roomId"] = room["id"]
    active_object_id = _active_element_id(step, room)
    if active_object_id is not None:
        result["activeObjectId"] = active_object_id
    if step.spatial_state:
        result["spatialState"] = dict(step.spatial_state)
    return result


def adapt_spatial_debug_trace(
    trace: SpatialDebugTrace,
    sources: Mapping[str, str],
    *,
    available_bytes: int = MAX_RESPONSE_BYTES,
) -> DebugTraceAdaptation:
    """Convert a complete trace without publishing or silently truncating it.

    ``available_bytes`` is the byte budget reserved for the future
    ``debugSteps`` member.  Stage 5 must subtract the encoded base response
    before calling this adapter.
    """

    if available_bytes < 0:
        raise ValueError("available_bytes must be non-negative")
    if not trace.complete:
        return DebugTraceAdaptation.unavailable(
            trace.unavailable_reason or "trace_incomplete"
        )
    if not trace.steps:
        return DebugTraceAdaptation.unavailable("trace_empty")

    steps: list[DebugStepDTO] = []
    for step in trace.steps:
        converted = _step_dto(step, sources)
        if converted is None:
            return DebugTraceAdaptation.unavailable(
                f"source_unavailable:{step.source.file}:{step.source.line}"
            )
        steps.append(converted)

    encoded = json.dumps(
        {"debugSteps": steps},
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
    ).encode("utf-8")
    if len(encoded) > available_bytes:
        return DebugTraceAdaptation.unavailable("response_size_exceeded")
    return DebugTraceAdaptation(
        debug_steps=tuple(steps),
        complete=True,
        serialized_size_bytes=len(encoded),
    )
