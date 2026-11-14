"""Pure spatial value rules and shared diagnostic construction."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from math import isfinite

from lumi_language.diagnostics import Diagnostic, DiagnosticCategory


class NumericRuleViolation(str, Enum):
    """Reasons why a value does not satisfy a spatial numeric rule."""

    NOT_NUMERIC = "not_numeric"
    NOT_FINITE = "not_finite"
    NOT_POSITIVE = "not_positive"


class PropertyRuleViolation(str, Enum):
    """Reasons why a spatial property is invalid for an element."""

    NOT_ALLOWED = "not_allowed"
    WRONG_TYPE = "wrong_type"
    DUPLICATE = "duplicate"


class SpatialOperation(str, Enum):
    """Operations whose preconditions affect an element's spatial state."""

    PLACE = "place"
    MOVE = "move"
    ROTATE = "rotate"


class SpatialTransitionViolation(str, Enum):
    """Pure failure reasons shared by static and concrete spatial state."""

    ROOM_ALREADY_ACTIVE = "room_already_active"
    NO_ACTIVE_ROOM = "no_active_room"
    DUPLICATE_ROOM = "duplicate_room"
    DUPLICATE_ELEMENT = "duplicate_element"
    ELEMENT_NOT_FOUND = "element_not_found"
    ELEMENT_ALREADY_PLACED = "element_already_placed"
    ELEMENT_NOT_PLACED = "element_not_placed"


@dataclass(frozen=True, slots=True)
class SpatialElementState:
    """Minimal concrete/abstract state needed by linear spatial rules."""

    placed: bool = False


def validate_room_start(
    *, room_active: bool, room_exists: bool,
) -> SpatialTransitionViolation | None:
    """Validate opening a room without depending on a builder or an AST."""

    if room_active:
        return SpatialTransitionViolation.ROOM_ALREADY_ACTIVE
    if room_exists:
        return SpatialTransitionViolation.DUPLICATE_ROOM
    return None


def validate_element_declaration(
    *, room_active: bool, element_exists: bool,
) -> SpatialTransitionViolation | None:
    """Validate declaring one element in the current room."""

    if not room_active:
        return SpatialTransitionViolation.NO_ACTIVE_ROOM
    if element_exists:
        return SpatialTransitionViolation.DUPLICATE_ELEMENT
    return None


def apply_element_operation(
    *,
    room_active: bool,
    element_state: SpatialElementState | None,
    operation: SpatialOperation,
) -> tuple[SpatialElementState | None, SpatialTransitionViolation | None]:
    """Apply one operation to immutable state and return its failure reason."""

    if not room_active:
        return element_state, SpatialTransitionViolation.NO_ACTIVE_ROOM
    if element_state is None:
        return None, SpatialTransitionViolation.ELEMENT_NOT_FOUND
    if operation is SpatialOperation.PLACE:
        if element_state.placed:
            return element_state, SpatialTransitionViolation.ELEMENT_ALREADY_PLACED
        return SpatialElementState(placed=True), None
    if operation is SpatialOperation.MOVE and not element_state.placed:
        return element_state, SpatialTransitionViolation.ELEMENT_NOT_PLACED
    return element_state, None


TEXT_PROPERTY_NAMES = frozenset({"color", "material", "orientacion"})
NUMERIC_PROPERTY_NAMES = frozenset({
    "ancho", "alto", "desplazamiento", "elevacion",
})

ALLOWED_PROPERTIES = {
    "object": frozenset({"color", "material"}),
    "floor": frozenset({"color", "material"}),
    "wall": frozenset({"orientacion", "color", "material"}),
    "door": frozenset({
        "orientacion", "ancho", "alto", "desplazamiento",
        "color", "material",
    }),
    "window": frozenset({
        "orientacion", "ancho", "alto", "desplazamiento", "elevacion",
        "color", "material",
    }),
}


def is_spatial_number(value: object) -> bool:
    """Return whether value is a Lumi number, explicitly excluding booleans."""

    return not isinstance(value, bool) and isinstance(value, (int, float))


def validate_dimension_value(value: object) -> NumericRuleViolation | None:
    """Validate the resolved value of a room dimension."""

    if not is_spatial_number(value):
        return NumericRuleViolation.NOT_NUMERIC
    if isinstance(value, float) and not isfinite(value):
        return NumericRuleViolation.NOT_FINITE
    if value <= 0:
        return NumericRuleViolation.NOT_POSITIVE
    return None


def validate_vector_component_value(
    value: object,
) -> NumericRuleViolation | None:
    """Validate one resolved position or rotation component."""

    if not is_spatial_number(value):
        return NumericRuleViolation.NOT_NUMERIC
    if isinstance(value, float) and not isfinite(value):
        return NumericRuleViolation.NOT_FINITE
    return None


def allowed_properties_for(element_kind: str) -> frozenset[str]:
    """Return the language property catalog for an element kind."""

    return ALLOWED_PROPERTIES.get(element_kind, frozenset())


def property_expected_type(property_name: str) -> str | None:
    """Return the language-level value family required by a property."""

    if property_name in TEXT_PROPERTY_NAMES:
        return "text"
    if property_name in NUMERIC_PROPERTY_NAMES:
        return "numeric"
    return None


def validate_property_value(
    element_kind: str,
    property_name: str,
    value: object,
) -> PropertyRuleViolation | None:
    """Validate one resolved property without inspecting an AST or scene."""

    if property_name not in allowed_properties_for(element_kind):
        return PropertyRuleViolation.NOT_ALLOWED

    expected = property_expected_type(property_name)
    if expected == "text" and not isinstance(value, str):
        return PropertyRuleViolation.WRONG_TYPE
    if expected == "numeric" and not is_spatial_number(value):
        return PropertyRuleViolation.WRONG_TYPE
    return None


def dimension_diagnostic(
    *,
    room_name: str,
    dimension_name: str,
    violation: NumericRuleViolation,
    file: str,
    line: int,
    column: int,
) -> Diagnostic:
    """Build the shared diagnostic for an invalid room dimension."""

    if violation is NumericRuleViolation.NOT_NUMERIC:
        requirement = "debe ser numérica."
        suggestion = "Utilice un valor de tipo entero o decimal."
    elif violation is NumericRuleViolation.NOT_FINITE:
        requirement = "debe ser un número finito."
        suggestion = "Utilice un valor que no sea infinito ni NaN."
    else:
        requirement = "debe ser mayor que cero."
        suggestion = "Utilice un valor numérico positivo."
    return Diagnostic(
        category=DiagnosticCategory.SPATIAL,
        code="SPA_INVALID_DIMENSION",
        file=file,
        line=line,
        column=column,
        description=(
            f"La dimensión '{dimension_name}' de la habitación "
            f"'{room_name}' {requirement}"
        ),
        suggestion=suggestion,
    )


def vector_diagnostic(
    *,
    element_name: str,
    vector_name: str,
    component_name: str,
    violation: NumericRuleViolation,
    file: str,
    line: int,
    column: int,
) -> Diagnostic:
    """Build the shared diagnostic for an invalid vector component."""

    if violation is NumericRuleViolation.NOT_FINITE:
        requirement = "debe ser un número finito."
        suggestion = "Utilice un valor que no sea infinito ni NaN."
    else:
        requirement = "debe ser numérico."
        suggestion = "Utilice un valor de tipo entero o decimal."
    return Diagnostic(
        category=DiagnosticCategory.SPATIAL,
        code="SPA_INVALID_VECTOR",
        file=file,
        line=line,
        column=column,
        description=(
            f"El componente '{component_name}' de la {vector_name} "
            f"del elemento '{element_name}' {requirement}"
        ),
        suggestion=suggestion,
    )


def property_diagnostic(
    *,
    element_name: str,
    element_kind: str,
    property_name: str,
    violation: PropertyRuleViolation,
    file: str,
    line: int,
    column: int,
) -> Diagnostic:
    """Build the shared diagnostic for an invalid spatial property."""

    if violation is PropertyRuleViolation.DUPLICATE:
        description = (
            f"La propiedad '{property_name}' del elemento "
            f"'{element_name}' está duplicada."
        )
        suggestion = "Conserve una sola declaración de la propiedad."
    elif violation is PropertyRuleViolation.NOT_ALLOWED:
        allowed = sorted(allowed_properties_for(element_kind))
        description = (
            f"La propiedad '{property_name}' del elemento "
            f"'{element_name}' no está permitida."
        )
        if allowed:
            names = "', '".join(allowed)
            suggestion = f"Utilice una de las propiedades permitidas: '{names}'."
        else:
            suggestion = "Elimine la propiedad no permitida."
    else:
        expected = property_expected_type(property_name)
        if expected == "numeric":
            requirement = "un valor numérico"
            suggestion = "Utilice un valor de tipo entero o decimal."
        else:
            requirement = "un valor de texto"
            suggestion = "Utilice un valor de texto."
        description = (
            f"La propiedad '{property_name}' del elemento "
            f"'{element_name}' debe contener {requirement}."
        )
    return Diagnostic(
        category=DiagnosticCategory.SPATIAL,
        code="SPA_INVALID_PROPERTY",
        file=file,
        line=line,
        column=column,
        description=description,
        suggestion=suggestion,
    )


def multiple_floors_diagnostic(
    *, room_name: str, file: str, line: int, column: int,
) -> Diagnostic:
    """Build the shared diagnostic for a repeated room floor."""

    return Diagnostic(
        category=DiagnosticCategory.SPATIAL,
        code="SPA_MULTIPLE_FLOORS",
        file=file,
        line=line,
        column=column,
        description=f"La habitación '{room_name}' contiene más de un piso.",
        suggestion=(
            "Conserve como máximo una declaración de piso por habitación."
        ),
    )
