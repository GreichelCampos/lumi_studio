"""Conservative abstract state for static spatial control-flow analysis."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Mapping

from spatial.spatial_rules import SpatialOperation, SpatialTransitionViolation


class AbstractElementState(str, Enum):
    """Possible lifecycle states of one element in one room."""

    ABSENT = "absent"
    DECLARED_UNPLACED = "declared_unplaced"
    DECLARED_PLACED = "declared_placed"
    TOP = "top"


class AbstractPresence(str, Enum):
    """Presence of an architectural resource on the represented routes."""

    ABSENT = "absent"
    PRESENT = "present"
    TOP = "top"


CONCRETE_STATES = frozenset({
    AbstractElementState.ABSENT,
    AbstractElementState.DECLARED_UNPLACED,
    AbstractElementState.DECLARED_PLACED,
})
ElementStates = frozenset[AbstractElementState]
PresenceStates = frozenset[AbstractPresence]

PRESENCE_STATES = frozenset({
    AbstractPresence.ABSENT,
    AbstractPresence.PRESENT,
})


class TransferClassification(str, Enum):
    VALID = "valid"
    CONFIRMED_ERROR = "confirmed_error"
    POSSIBLE_ERROR = "possible_error"
    UNKNOWN = "unknown"


class LoopCardinality(str, Enum):
    """Statically justified iteration-count classes."""

    ZERO = "zero"
    EXACTLY_ONE = "exactly_one"
    AT_LEAST_TWO_KNOWN = "at_least_two_known"
    ZERO_OR_MORE = "zero_or_more"
    UNKNOWN = "unknown"


@dataclass(frozen=True, slots=True)
class TransferResult:
    states: ElementStates
    classification: TransferClassification
    reasons: frozenset[SpatialTransitionViolation] = frozenset()

    @property
    def confirmed_reason(self) -> SpatialTransitionViolation | None:
        if (
            self.classification is TransferClassification.CONFIRMED_ERROR
            and len(self.reasons) == 1
        ):
            return next(iter(self.reasons))
        return None


@dataclass(frozen=True, slots=True)
class PresenceTransferResult:
    states: PresenceStates
    classification: TransferClassification

    @property
    def confirmed_duplicate(self) -> bool:
        return self.classification is TransferClassification.CONFIRMED_ERROR


def _expand(states: ElementStates) -> ElementStates:
    if AbstractElementState.TOP in states:
        return CONCRETE_STATES
    return states or frozenset({AbstractElementState.ABSENT})


def join_element_states(*alternatives: ElementStates) -> ElementStates:
    """Join possible states, using TOP as the canonical full uncertainty."""

    joined = frozenset().union(*(_expand(item) for item in alternatives))
    if joined == CONCRETE_STATES:
        return frozenset({AbstractElementState.TOP})
    return joined


def _expand_presence(states: PresenceStates) -> PresenceStates:
    if AbstractPresence.TOP in states:
        return PRESENCE_STATES
    return states or frozenset({AbstractPresence.ABSENT})


def join_presence_states(*alternatives: PresenceStates) -> PresenceStates:
    """Join architectural presence, preserving possible versus unknown."""

    if any(AbstractPresence.TOP in item for item in alternatives):
        return frozenset({AbstractPresence.TOP})
    return frozenset().union(*(_expand_presence(item) for item in alternatives))


def declare_presence(states: PresenceStates) -> PresenceTransferResult:
    """Declare a unique resource without reporting merely possible duplicates."""

    expanded = _expand_presence(states)
    unknown = AbstractPresence.TOP in states
    successes = int(AbstractPresence.ABSENT in expanded)
    failures = int(AbstractPresence.PRESENT in expanded)
    if unknown:
        classification = TransferClassification.UNKNOWN
    elif failures == 0:
        classification = TransferClassification.VALID
    elif successes:
        classification = TransferClassification.POSSIBLE_ERROR
    else:
        classification = TransferClassification.CONFIRMED_ERROR
    return PresenceTransferResult(
        frozenset({AbstractPresence.TOP if unknown else AbstractPresence.PRESENT}),
        classification,
    )


def _classify(
    successes: int,
    failures: int,
    reasons: set[SpatialTransitionViolation],
    *,
    unknown: bool = False,
) -> TransferClassification:
    if unknown:
        return TransferClassification.UNKNOWN
    if failures == 0:
        return TransferClassification.VALID
    if successes:
        return TransferClassification.POSSIBLE_ERROR
    if len(reasons) == 1:
        return TransferClassification.CONFIRMED_ERROR
    return TransferClassification.UNKNOWN


def declare(states: ElementStates) -> TransferResult:
    next_states: set[AbstractElementState] = set()
    reasons: set[SpatialTransitionViolation] = set()
    successes = failures = 0
    unknown = AbstractElementState.TOP in states
    for state in _expand(states):
        if state is AbstractElementState.ABSENT:
            next_states.add(AbstractElementState.DECLARED_UNPLACED)
            successes += 1
        else:
            next_states.add(state)
            reasons.add(SpatialTransitionViolation.DUPLICATE_ELEMENT)
            failures += 1
    return TransferResult(
        join_element_states(frozenset(next_states)),
        _classify(successes, failures, reasons, unknown=unknown),
        frozenset(reasons),
    )


def apply_operation(
    states: ElementStates, operation: SpatialOperation,
) -> TransferResult:
    next_states: set[AbstractElementState] = set()
    reasons: set[SpatialTransitionViolation] = set()
    successes = failures = 0
    unknown = AbstractElementState.TOP in states
    for state in _expand(states):
        next_state = state
        reason = None
        if state is AbstractElementState.ABSENT:
            reason = SpatialTransitionViolation.ELEMENT_NOT_FOUND
        elif operation is SpatialOperation.PLACE:
            if state is AbstractElementState.DECLARED_PLACED:
                reason = SpatialTransitionViolation.ELEMENT_ALREADY_PLACED
            else:
                next_state = AbstractElementState.DECLARED_PLACED
        elif (
            operation is SpatialOperation.MOVE
            and state is AbstractElementState.DECLARED_UNPLACED
        ):
            reason = SpatialTransitionViolation.ELEMENT_NOT_PLACED

        next_states.add(next_state)
        if reason is None:
            successes += 1
        else:
            failures += 1
            reasons.add(reason)
    return TransferResult(
        join_element_states(frozenset(next_states)),
        _classify(successes, failures, reasons, unknown=unknown),
        frozenset(reasons),
    )


@dataclass(slots=True)
class SpatialAbstractState:
    """Architectural resources and room-isolated element lifecycle state."""

    rooms: dict[str, dict[str, ElementStates]] = field(default_factory=dict)
    room_presence: dict[str, PresenceStates] = field(default_factory=dict)
    floor_presence: dict[str, PresenceStates] = field(default_factory=dict)
    wall_presence: dict[str, dict[str, PresenceStates]] = field(default_factory=dict)
    unknown_global_effects: bool = False
    unknown_rooms: set[str] = field(default_factory=set)

    @property
    def analysis_complete(self) -> bool:
        """Whether every tracked spatial fact has one known abstract value."""

        if self.unknown_global_effects or self.unknown_rooms:
            return False
        element_states = (
            states
            for elements in self.rooms.values()
            for states in elements.values()
        )
        presence_states = (
            *self.room_presence.values(),
            *self.floor_presence.values(),
            *(
                states
                for walls in self.wall_presence.values()
                for states in walls.values()
            ),
        )
        return all(
            len(states) == 1 and AbstractElementState.TOP not in states
            for states in element_states
        ) and all(
            len(states) == 1 and AbstractPresence.TOP not in states
            for states in presence_states
        )

    def copy(self) -> "SpatialAbstractState":
        return SpatialAbstractState(
            rooms={room: dict(elements) for room, elements in self.rooms.items()},
            room_presence=dict(self.room_presence),
            floor_presence=dict(self.floor_presence),
            wall_presence={
                room: dict(walls) for room, walls in self.wall_presence.items()
            },
            unknown_global_effects=self.unknown_global_effects,
            unknown_rooms=set(self.unknown_rooms),
        )

    def states_for(self, room: str, name: str) -> ElementStates:
        if self.unknown_global_effects or room in self.unknown_rooms:
            return frozenset({AbstractElementState.TOP})
        elements = self.rooms.get(room, {})
        base, bracket, _ = name.partition("[")
        if bracket and f"{base}[]" in elements:
            return join_element_states(
                elements.get(name, frozenset({AbstractElementState.ABSENT})),
                elements[f"{base}[]"],
            )
        return elements.get(name, frozenset({AbstractElementState.ABSENT}))

    def set_states(self, room: str, name: str, states: ElementStates) -> None:
        self.rooms.setdefault(room, {})[name] = states

    def room_states(self, room: str) -> PresenceStates:
        if self.unknown_global_effects:
            return frozenset({AbstractPresence.TOP})
        return self.room_presence.get(
            room, frozenset({AbstractPresence.ABSENT}),
        )

    def set_room_states(self, room: str, states: PresenceStates) -> None:
        self.room_presence[room] = states

    def floor_states(self, room: str) -> PresenceStates:
        if self.unknown_global_effects or room in self.unknown_rooms:
            return frozenset({AbstractPresence.TOP})
        return self.floor_presence.get(
            room, frozenset({AbstractPresence.ABSENT}),
        )

    def set_floor_states(self, room: str, states: PresenceStates) -> None:
        self.floor_presence[room] = states

    def wall_states(self, room: str, orientation: str) -> PresenceStates:
        if self.unknown_global_effects or room in self.unknown_rooms:
            return frozenset({AbstractPresence.TOP})
        return self.wall_presence.get(room, {}).get(
            orientation, frozenset({AbstractPresence.ABSENT}),
        )

    def set_wall_states(
        self, room: str, orientation: str, states: PresenceStates,
    ) -> None:
        self.wall_presence.setdefault(room, {})[orientation] = states

    @classmethod
    def join(cls, *alternatives: "SpatialAbstractState") -> "SpatialAbstractState":
        result = cls(
            unknown_global_effects=any(
                item.unknown_global_effects for item in alternatives
            ),
            unknown_rooms=set().union(*(
                item.unknown_rooms for item in alternatives
            )),
        )
        rooms = set().union(*(item.rooms for item in alternatives))
        for room in rooms:
            names = set().union(*(
                item.rooms.get(room, {}) for item in alternatives
            ))
            for name in names:
                result.set_states(room, name, join_element_states(*(
                    item.states_for(room, name) for item in alternatives
                )))
        room_names = set().union(*(item.room_presence for item in alternatives))
        for room in room_names:
            result.set_room_states(room, join_presence_states(*(
                item.room_states(room) for item in alternatives
            )))
        floor_rooms = set().union(*(item.floor_presence for item in alternatives))
        for room in floor_rooms:
            result.set_floor_states(room, join_presence_states(*(
                item.floor_states(room) for item in alternatives
            )))
        wall_rooms = set().union(*(item.wall_presence for item in alternatives))
        for room in wall_rooms:
            orientations = set().union(*(
                item.wall_presence.get(room, {}) for item in alternatives
            ))
            for orientation in orientations:
                result.set_wall_states(room, orientation, join_presence_states(*(
                    item.wall_states(room, orientation) for item in alternatives
                )))
        return result

    def widen_to_unknown(self) -> None:
        """Explicitly forget non-stabilized facts after the transfer bound."""

        element_top = frozenset({AbstractElementState.TOP})
        presence_top = frozenset({AbstractPresence.TOP})
        for elements in self.rooms.values():
            for name in elements:
                elements[name] = element_top
        for room in self.room_presence:
            self.room_presence[room] = presence_top
        for room in self.floor_presence:
            self.floor_presence[room] = presence_top
        for walls in self.wall_presence.values():
            for orientation in walls:
                walls[orientation] = presence_top

    def mark_unknown_effects(self, room: str | None) -> None:
        """Forget facts that an unsupported call could have modified."""

        element_top = frozenset({AbstractElementState.TOP})
        presence_top = frozenset({AbstractPresence.TOP})
        if room is None:
            self.unknown_global_effects = True
            self.widen_to_unknown()
            return
        self.unknown_rooms.add(room)
        for name in self.rooms.get(room, {}):
            self.rooms[room][name] = element_top
        if room in self.floor_presence:
            self.floor_presence[room] = presence_top
        for orientation in self.wall_presence.get(room, {}):
            self.wall_presence[room][orientation] = presence_top

    def room_elements(self, room: str) -> Mapping[str, ElementStates]:
        return self.rooms.get(room, {})
