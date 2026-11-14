from lumi_language.spatial_abstract_state import (
    AbstractElementState as State,
    AbstractPresence as Presence,
    SpatialAbstractState,
    TransferClassification as Classification,
    apply_operation,
    declare,
    declare_presence,
    join_element_states,
    join_presence_states,
)
from spatial.spatial_rules import SpatialOperation, SpatialTransitionViolation


ABSENT = frozenset({State.ABSENT})
UNPLACED = frozenset({State.DECLARED_UNPLACED})
PLACED = frozenset({State.DECLARED_PLACED})


def test_missing_name_means_absent_and_rooms_are_isolated():
    state = SpatialAbstractState()
    state.set_states("sala", "item", PLACED)

    assert state.states_for("sala", "item") == PLACED
    assert state.states_for("oficina", "item") == ABSENT
    assert state.states_for("sala", "otro") == ABSENT


def test_join_includes_absent_for_names_missing_on_one_route():
    left = SpatialAbstractState()
    left.set_states("sala", "item", UNPLACED)

    joined = SpatialAbstractState.join(left, SpatialAbstractState())

    assert joined.states_for("sala", "item") == frozenset({
        State.ABSENT, State.DECLARED_UNPLACED,
    })


def test_transfers_classify_valid_confirmed_possible_and_unknown():
    valid = declare(ABSENT)
    confirmed = apply_operation(UNPLACED, SpatialOperation.MOVE)
    possible = apply_operation(
        frozenset({State.DECLARED_UNPLACED, State.DECLARED_PLACED}),
        SpatialOperation.MOVE,
    )
    unknown = apply_operation(frozenset({State.TOP}), SpatialOperation.PLACE)

    assert valid.classification is Classification.VALID
    assert confirmed.classification is Classification.CONFIRMED_ERROR
    assert confirmed.confirmed_reason is SpatialTransitionViolation.ELEMENT_NOT_PLACED
    assert possible.classification is Classification.POSSIBLE_ERROR
    assert possible.confirmed_reason is None
    assert unknown.classification is Classification.UNKNOWN


def test_full_union_is_canonical_top():
    assert join_element_states(ABSENT, UNPLACED, PLACED) == frozenset({State.TOP})


def test_architectural_presence_is_room_isolated_and_joins_optional_routes():
    left = SpatialAbstractState()
    left.set_room_states("sala", frozenset({Presence.PRESENT}))
    left.set_floor_states("sala", frozenset({Presence.PRESENT}))
    left.set_wall_states("sala", "norte", frozenset({Presence.PRESENT}))

    joined = SpatialAbstractState.join(left, SpatialAbstractState())

    possible = frozenset({Presence.ABSENT, Presence.PRESENT})
    assert joined.room_states("sala") == possible
    assert joined.floor_states("sala") == possible
    assert joined.wall_states("sala", "norte") == possible
    assert joined.floor_states("oficina") == frozenset({Presence.ABSENT})


def test_architectural_declaration_distinguishes_confirmed_and_possible_duplicate():
    present = frozenset({Presence.PRESENT})
    possible = frozenset({Presence.ABSENT, Presence.PRESENT})

    assert declare_presence(present).classification is Classification.CONFIRMED_ERROR
    assert declare_presence(possible).classification is Classification.POSSIBLE_ERROR
    assert join_presence_states(present, possible) == possible


def test_widening_marks_non_stabilized_architectural_facts_unknown():
    state = SpatialAbstractState()
    state.set_room_states("sala", frozenset({Presence.PRESENT}))
    state.set_floor_states("sala", frozenset({Presence.PRESENT}))
    state.set_wall_states("sala", "norte", frozenset({Presence.PRESENT}))

    state.widen_to_unknown()

    unknown = frozenset({Presence.TOP})
    assert state.room_states("sala") == unknown
    assert state.floor_states("sala") == unknown
    assert state.wall_states("sala", "norte") == unknown
