"""Build resolved Lumi scene plans from already evaluated spatial values."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from .scene_plan import (
    RoomPlan,
    ScenePlan,
    SourceLocation,
    SpatialElement,
    SpatialNumber,
    SpatialProperty,
    Vector3,
)


class ScenePlanBuilderErrorReason(str, Enum):
    """Internal failure reasons awaiting future Lumi diagnostic mappings."""

    ROOM_ALREADY_ACTIVE = "room_already_active"
    NO_ACTIVE_ROOM = "no_active_room"
    DUPLICATE_ROOM = "duplicate_room"
    DUPLICATE_ELEMENT = "duplicate_element"
    ELEMENT_NOT_FOUND = "element_not_found"
    ELEMENT_ALREADY_PLACED = "element_already_placed"
    ELEMENT_NOT_PLACED = "element_not_placed"
    ACTIVE_ROOM_NOT_FINALIZED = "active_room_not_finalized"


class ScenePlanBuilderError(Exception):
    """A controlled scene construction error with source context."""

    def __init__(
        self,
        reason: ScenePlanBuilderErrorReason,
        message: str,
        source: SourceLocation,
        *,
        room_name: str | None = None,
        element_name: str | None = None,
    ) -> None:
        super().__init__(message)
        self.reason = reason
        self.source = source
        self.room_name = room_name
        self.element_name = element_name


@dataclass(slots=True)
class _ElementDraft:
    name: str
    element_kind: str
    object_type: str | None
    properties: tuple[SpatialProperty, ...]
    position: Vector3 | None
    rotation: Vector3 | None
    source: SourceLocation

    def freeze(self) -> SpatialElement:
        return SpatialElement(
            name=self.name,
            element_kind=self.element_kind,
            object_type=self.object_type,
            properties=self.properties,
            position=self.position,
            rotation=self.rotation,
            source=self.source,
        )


@dataclass(slots=True)
class _RoomDraft:
    name: str
    width: SpatialNumber
    length: SpatialNumber
    height: SpatialNumber
    source: SourceLocation
    elements: list[_ElementDraft]
    elements_by_name: dict[str, _ElementDraft]

    def freeze(self) -> RoomPlan:
        return RoomPlan(
            name=self.name,
            width=self.width,
            length=self.length,
            height=self.height,
            elements=tuple(element.freeze() for element in self.elements),
            source=self.source,
        )


class ScenePlanBuilder:
    """Accumulate resolved spatial operations into an immutable scene plan.

    The builder deliberately does not evaluate AST expressions or validate
    dimensions, vectors, properties, geometry, or renderer-specific data.
    """

    def __init__(self, source: SourceLocation) -> None:
        self._source = source
        self._rooms: list[RoomPlan] = []
        self._room_names: set[str] = set()
        self._active_room: _RoomDraft | None = None

    def begin_room(
        self,
        *,
        name: str,
        width: SpatialNumber,
        length: SpatialNumber,
        height: SpatialNumber,
        source: SourceLocation,
    ) -> None:
        """Open one room using values already resolved by the caller."""

        if self._active_room is not None:
            raise ScenePlanBuilderError(
                ScenePlanBuilderErrorReason.ROOM_ALREADY_ACTIVE,
                (
                    f"No se puede abrir la habitación '{name}' mientras "
                    f"'{self._active_room.name}' está activa."
                ),
                source,
                room_name=name,
            )
        if name in self._room_names:
            raise ScenePlanBuilderError(
                ScenePlanBuilderErrorReason.DUPLICATE_ROOM,
                f"La habitación '{name}' ya fue construida.",
                source,
                room_name=name,
            )
        self._active_room = _RoomDraft(
            name=name,
            width=width,
            length=length,
            height=height,
            source=source,
            elements=[],
            elements_by_name={},
        )

    def end_room(self) -> RoomPlan:
        """Finalize the active room and append it to the scene in order."""

        room = self._require_active_room(self._source)
        finalized = room.freeze()
        self._rooms.append(finalized)
        self._room_names.add(room.name)
        self._active_room = None
        return finalized

    def declare_element(
        self,
        *,
        name: str,
        element_kind: str,
        object_type: str | None,
        properties: tuple[SpatialProperty, ...],
        source: SourceLocation,
    ) -> None:
        """Declare one uniquely named element in the active room."""

        room = self._require_active_room(source)
        if name in room.elements_by_name:
            raise ScenePlanBuilderError(
                ScenePlanBuilderErrorReason.DUPLICATE_ELEMENT,
                (
                    f"El elemento '{name}' ya está declarado en la "
                    f"habitación '{room.name}'."
                ),
                source,
                room_name=room.name,
                element_name=name,
            )
        element = _ElementDraft(
            name=name,
            element_kind=element_kind,
            object_type=object_type,
            properties=properties,
            position=None,
            rotation=None,
            source=source,
        )
        room.elements.append(element)
        room.elements_by_name[name] = element

    def place_element(
        self,
        *,
        name: str,
        position: Vector3,
        source: SourceLocation | None = None,
    ) -> None:
        """Assign an element's initial absolute position."""

        operation_source = source or position.source
        element = self._resolve_element(name, operation_source)
        if element.position is not None:
            raise ScenePlanBuilderError(
                ScenePlanBuilderErrorReason.ELEMENT_ALREADY_PLACED,
                f"El elemento '{name}' ya tiene una posición inicial.",
                operation_source,
                room_name=self._active_room_name(),
                element_name=name,
            )
        element.position = position

    def move_element(
        self,
        *,
        name: str,
        position: Vector3,
        source: SourceLocation | None = None,
    ) -> None:
        """Replace an already placed element's absolute position."""

        operation_source = source or position.source
        element = self._resolve_element(name, operation_source)
        if element.position is None:
            raise ScenePlanBuilderError(
                ScenePlanBuilderErrorReason.ELEMENT_NOT_PLACED,
                f"El elemento '{name}' debe colocarse antes de moverlo.",
                operation_source,
                room_name=self._active_room_name(),
                element_name=name,
            )
        element.position = position

    def rotate_element(
        self,
        *,
        name: str,
        rotation: Vector3,
        source: SourceLocation | None = None,
    ) -> None:
        """Replace an element's absolute rotation, whether placed or not."""

        operation_source = source or rotation.source
        element = self._resolve_element(name, operation_source)
        element.rotation = rotation

    def build(self) -> ScenePlan:
        """Return an immutable snapshot after every room has been finalized."""

        if self._active_room is not None:
            raise ScenePlanBuilderError(
                ScenePlanBuilderErrorReason.ACTIVE_ROOM_NOT_FINALIZED,
                (
                    f"La habitación '{self._active_room.name}' debe cerrarse "
                    "antes de construir la escena."
                ),
                self._active_room.source,
                room_name=self._active_room.name,
            )
        return ScenePlan(rooms=tuple(self._rooms), source=self._source)

    def _require_active_room(self, source: SourceLocation) -> _RoomDraft:
        if self._active_room is None:
            raise ScenePlanBuilderError(
                ScenePlanBuilderErrorReason.NO_ACTIVE_ROOM,
                "La operación espacial requiere una habitación activa.",
                source,
            )
        return self._active_room

    def _resolve_element(
        self,
        name: str,
        source: SourceLocation,
    ) -> _ElementDraft:
        room = self._require_active_room(source)
        element = room.elements_by_name.get(name)
        if element is None:
            raise ScenePlanBuilderError(
                ScenePlanBuilderErrorReason.ELEMENT_NOT_FOUND,
                (
                    f"El elemento '{name}' no está declarado en la "
                    f"habitación '{room.name}'."
                ),
                source,
                room_name=room.name,
                element_name=name,
            )
        return element

    def _active_room_name(self) -> str | None:
        return self._active_room.name if self._active_room is not None else None
