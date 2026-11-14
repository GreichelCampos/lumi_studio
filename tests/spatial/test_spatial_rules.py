from spatial.spatial_rules import (
    SpatialElementState,
    SpatialOperation,
    SpatialTransitionViolation,
    apply_element_operation,
    validate_element_declaration,
    validate_room_start,
)


def test_room_rules_distinguish_active_and_duplicate_rooms():
    assert validate_room_start(room_active=False, room_exists=False) is None
    assert validate_room_start(
        room_active=True, room_exists=False,
    ) is SpatialTransitionViolation.ROOM_ALREADY_ACTIVE
    assert validate_room_start(
        room_active=False, room_exists=True,
    ) is SpatialTransitionViolation.DUPLICATE_ROOM


def test_declaration_rules_require_room_and_unique_name():
    assert validate_element_declaration(
        room_active=True, element_exists=False,
    ) is None
    assert validate_element_declaration(
        room_active=False, element_exists=False,
    ) is SpatialTransitionViolation.NO_ACTIVE_ROOM
    assert validate_element_declaration(
        room_active=True, element_exists=True,
    ) is SpatialTransitionViolation.DUPLICATE_ELEMENT


def test_operation_rules_model_placement_without_mutating_input():
    initial = SpatialElementState()
    placed, violation = apply_element_operation(
        room_active=True,
        element_state=initial,
        operation=SpatialOperation.PLACE,
    )

    assert violation is None
    assert initial.placed is False
    assert placed == SpatialElementState(placed=True)
    assert placed is not initial


def test_operation_rules_preserve_rotation_and_absolute_move_state():
    unplaced = SpatialElementState()
    rotated, rotation_error = apply_element_operation(
        room_active=True,
        element_state=unplaced,
        operation=SpatialOperation.ROTATE,
    )
    placed = SpatialElementState(placed=True)
    moved, move_error = apply_element_operation(
        room_active=True,
        element_state=placed,
        operation=SpatialOperation.MOVE,
    )

    assert (rotated, rotation_error) == (unplaced, None)
    assert (moved, move_error) == (placed, None)


def test_operation_rules_return_specific_precondition_failures():
    _, outside = apply_element_operation(
        room_active=False,
        element_state=None,
        operation=SpatialOperation.PLACE,
    )
    _, missing = apply_element_operation(
        room_active=True,
        element_state=None,
        operation=SpatialOperation.ROTATE,
    )
    _, repeated = apply_element_operation(
        room_active=True,
        element_state=SpatialElementState(placed=True),
        operation=SpatialOperation.PLACE,
    )
    _, unplaced = apply_element_operation(
        room_active=True,
        element_state=SpatialElementState(),
        operation=SpatialOperation.MOVE,
    )

    assert outside is SpatialTransitionViolation.NO_ACTIVE_ROOM
    assert missing is SpatialTransitionViolation.ELEMENT_NOT_FOUND
    assert repeated is SpatialTransitionViolation.ELEMENT_ALREADY_PLACED
    assert unplaced is SpatialTransitionViolation.ELEMENT_NOT_PLACED
