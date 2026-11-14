"""Structural spatial-effect summaries for declared Lumi functions.

The objects in this module describe syntax; they do not perform spatial
transfers.  Keeping extraction separate from ``SpatialAbstractState`` makes it
impossible for an uncalled function to mutate the caller's abstract scene.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from enum import Enum
from types import MappingProxyType
from typing import Any, Mapping


class EffectCertainty(str, Enum):
    """How strongly an operation is known to occur when a function runs."""

    GUARANTEED = "guaranteed"
    POSSIBLE = "possible"
    UNKNOWN = "unknown"


class SpatialEffectKind(str, Enum):
    DECLARE_ROOM = "declare_room"
    DECLARE_ELEMENT = "declare_element"
    DECLARE_FLOOR = "declare_floor"
    DECLARE_WALL = "declare_wall"
    DECLARE_DOOR = "declare_door"
    DECLARE_WINDOW = "declare_window"
    PLACE = "place"
    MOVE = "move"
    ROTATE = "rotate"
    PENDING_CALL = "pending_call"
    UNKNOWN = "unknown"


class RequiredResourceKind(str, Enum):
    ACTIVE_ROOM = "active_room"
    ELEMENT = "element"
    PLACED_ELEMENT = "placed_element"
    WALL = "wall"


class CallResolution(str, Enum):
    RESOLVED = "resolved"
    UNDECLARED = "undeclared"
    NOT_CALLABLE = "not_callable"


@dataclass(frozen=True, slots=True)
class SourceLocation:
    file: str
    line: int
    column: int


@dataclass(frozen=True, slots=True)
class RequiredResource:
    kind: RequiredResourceKind
    name: str | None = None


@dataclass(frozen=True, slots=True)
class FunctionIdentity:
    """Stable semantic identity of a function declaration for one analysis."""

    name: str
    file: str
    line: int
    column: int
    scope_path: tuple[str, ...]
    source_file: str | None = None
    is_imported: bool = False


@dataclass(frozen=True, slots=True)
class SpatialEffect:
    """One ordered leaf operation and its original normalized AST node."""

    kind: SpatialEffectKind
    certainty: EffectCertainty
    location: SourceLocation
    source_node: dict[str, Any]
    name: str | None = None
    element_kind: str | None = None
    required_resources: tuple[RequiredResource, ...] = ()
    parameter_dependencies: frozenset[str] = frozenset()
    arguments: tuple[dict[str, Any], ...] = ()
    target_function: FunctionIdentity | None = None
    call_resolution: CallResolution | None = None


@dataclass(frozen=True, slots=True)
class EffectSequence:
    effects: tuple["EffectTree", ...] = ()


@dataclass(frozen=True, slots=True)
class ConditionalEffects:
    condition: dict[str, Any]
    then_effects: EffectSequence
    else_effects: EffectSequence
    location: SourceLocation
    parameter_dependencies: frozenset[str] = frozenset()


@dataclass(frozen=True, slots=True)
class AlternativeEffects:
    """Ordered switch alternatives, kept separate rather than flattened."""

    selector: dict[str, Any]
    branches: tuple[EffectSequence, ...]
    default_effects: EffectSequence
    location: SourceLocation
    parameter_dependencies: frozenset[str] = frozenset()


@dataclass(frozen=True, slots=True)
class RoomEffects:
    declaration: SpatialEffect
    body: EffectSequence


@dataclass(frozen=True, slots=True)
class RepeatedEffects:
    loop_kind: str
    control: tuple[dict[str, Any], ...]
    initial_effects: EffectSequence
    body: EffectSequence
    iteration_effects: EffectSequence
    location: SourceLocation
    parameter_dependencies: frozenset[str] = frozenset()


EffectTree = (
    SpatialEffect | EffectSequence | ConditionalEffects | AlternativeEffects
    | RoomEffects | RepeatedEffects
)


@dataclass(frozen=True, slots=True)
class FunctionEffectSummary:
    """Effects belonging to one declaration identity in one lexical scope."""

    name: str
    declaration_id: int
    scope_id: int
    location: SourceLocation
    parameters: tuple[str, ...]
    effects: EffectSequence
    source_node: dict[str, Any]
    function_identity: FunctionIdentity


@dataclass(frozen=True, slots=True)
class FunctionCallDependency:
    source: FunctionIdentity
    target: FunctionIdentity | None
    resolution: CallResolution
    location: SourceLocation
    source_node: dict[str, Any]
    arguments: tuple[dict[str, Any], ...]
    parameter_dependencies: frozenset[str]


@dataclass(frozen=True, slots=True)
class FunctionCallGraph:
    """Ordered outgoing call dependencies for every summarized function."""

    dependencies: Mapping[FunctionIdentity, tuple[FunctionCallDependency, ...]]

    def __post_init__(self) -> None:
        object.__setattr__(self, "dependencies", MappingProxyType(dict(self.dependencies)))


_SPATIAL_KINDS = {
    "RoomNode": SpatialEffectKind.DECLARE_ROOM,
    "SpatialObjectDeclarationNode": SpatialEffectKind.DECLARE_ELEMENT,
    "FloorNode": SpatialEffectKind.DECLARE_FLOOR,
    "WallNode": SpatialEffectKind.DECLARE_WALL,
    "DoorNode": SpatialEffectKind.DECLARE_DOOR,
    "WindowNode": SpatialEffectKind.DECLARE_WINDOW,
    "PlaceObjectNode": SpatialEffectKind.PLACE,
    "MoveObjectNode": SpatialEffectKind.MOVE,
    "RotateObjectNode": SpatialEffectKind.ROTATE,
}


def extract_function_effects(
    declaration: dict[str, Any], *, scope_id: int,
    function_identity: FunctionIdentity,
) -> FunctionEffectSummary:
    """Build a syntax-preserving summary without interpreting any statement."""

    parameters = tuple(item["name"] for item in declaration.get("parameters", []))
    parameter_names = frozenset(parameters)
    return FunctionEffectSummary(
        name=declaration["name"],
        declaration_id=id(declaration),
        scope_id=scope_id,
        location=_location(declaration),
        parameters=parameters,
        effects=_extract_sequence(
            declaration.get("body", []), parameter_names, certainty=EffectCertainty.GUARANTEED,
            room_active=False,
        ),
        source_node=declaration,
        function_identity=function_identity,
    )


def resolve_summary_calls(
    summary: FunctionEffectSummary,
    resolutions: dict[int, tuple[CallResolution, FunctionIdentity | None]],
) -> tuple[FunctionEffectSummary, tuple[FunctionCallDependency, ...]]:
    """Attach semantic call targets while retaining the original tree shape."""

    dependencies: list[FunctionCallDependency] = []

    def resolve_tree(effect: EffectTree) -> EffectTree:
        if isinstance(effect, SpatialEffect):
            if effect.kind is not SpatialEffectKind.PENDING_CALL:
                return effect
            resolution, target = resolutions.get(
                id(effect.source_node), (CallResolution.UNDECLARED, None),
            )
            dependencies.append(FunctionCallDependency(
                source=summary.function_identity,
                target=target,
                resolution=resolution,
                location=effect.location,
                source_node=effect.source_node,
                arguments=effect.arguments,
                parameter_dependencies=effect.parameter_dependencies,
            ))
            return replace(
                effect, target_function=target, call_resolution=resolution,
            )
        if isinstance(effect, EffectSequence):
            return EffectSequence(tuple(resolve_tree(item) for item in effect.effects))
        if isinstance(effect, ConditionalEffects):
            return replace(
                effect,
                then_effects=resolve_tree(effect.then_effects),
                else_effects=resolve_tree(effect.else_effects),
            )
        if isinstance(effect, AlternativeEffects):
            return replace(
                effect,
                branches=tuple(resolve_tree(item) for item in effect.branches),
                default_effects=resolve_tree(effect.default_effects),
            )
        if isinstance(effect, RoomEffects):
            return replace(
                effect,
                declaration=resolve_tree(effect.declaration),
                body=resolve_tree(effect.body),
            )
        if isinstance(effect, RepeatedEffects):
            return replace(
                effect,
                initial_effects=resolve_tree(effect.initial_effects),
                body=resolve_tree(effect.body),
                iteration_effects=resolve_tree(effect.iteration_effects),
            )
        return effect

    return replace(summary, effects=resolve_tree(summary.effects)), tuple(dependencies)


def pending_calls(sequence: EffectSequence) -> tuple[SpatialEffect, ...]:
    """Return pending calls in their structural source order."""

    result: list[SpatialEffect] = []

    def visit(effect: EffectTree) -> None:
        if isinstance(effect, SpatialEffect):
            if effect.kind is SpatialEffectKind.PENDING_CALL:
                result.append(effect)
            return
        if isinstance(effect, EffectSequence):
            for item in effect.effects:
                visit(item)
            return
        if isinstance(effect, ConditionalEffects):
            visit(effect.then_effects)
            visit(effect.else_effects)
            return
        if isinstance(effect, AlternativeEffects):
            for branch in effect.branches:
                visit(branch)
            visit(effect.default_effects)
            return
        if isinstance(effect, RoomEffects):
            visit(effect.body)
            return
        if isinstance(effect, RepeatedEffects):
            visit(effect.initial_effects)
            visit(effect.body)
            visit(effect.iteration_effects)

    visit(sequence)
    return tuple(result)


def _extract_sequence(
    statements: list[dict[str, Any]],
    parameters: frozenset[str],
    *,
    certainty: EffectCertainty,
    room_active: bool,
) -> EffectSequence:
    effects: list[EffectTree] = []
    for node in statements:
        node_type = node.get("node")
        if node_type == "FunctionDeclarationNode":
            continue
        if node_type == "IfNode":
            effects.extend(_pending_calls(node["condition"], parameters, certainty))
            effects.append(ConditionalEffects(
                condition=node["condition"],
                then_effects=_extract_sequence(
                    node.get("then_body", []), parameters,
                    certainty=EffectCertainty.POSSIBLE, room_active=room_active,
                ),
                else_effects=_extract_sequence(
                    node.get("else_body", []), parameters,
                    certainty=EffectCertainty.POSSIBLE, room_active=room_active,
                ),
                location=_location(node),
                parameter_dependencies=_dependencies(node["condition"], parameters),
            ))
            continue
        if node_type == "SwitchNode":
            effects.extend(_pending_calls(node["expression"], parameters, certainty))
            effects.append(AlternativeEffects(
                selector=node["expression"],
                branches=tuple(
                    _extract_sequence(
                        case.get("body", []), parameters,
                        certainty=EffectCertainty.POSSIBLE,
                        room_active=room_active,
                    )
                    for case in node.get("cases", [])
                ),
                default_effects=_extract_sequence(
                    node.get("default_body", []), parameters,
                    certainty=EffectCertainty.POSSIBLE,
                    room_active=room_active,
                ),
                location=_location(node),
                parameter_dependencies=_dependencies(node["expression"], parameters),
            ))
            continue
        if node_type in {"WhileNode", "RepeatNode", "ForNode"}:
            controls = tuple(
                value for key in ("initializer", "condition", "update", "count")
                if isinstance((value := node.get(key)), dict)
            )
            if node_type == "RepeatNode":
                initial_values = (node.get("count"),)
                iteration_values = ()
            elif node_type == "WhileNode":
                initial_values = (node.get("condition"),)
                iteration_values = (node.get("condition"),)
            else:
                initial_values = (
                    node.get("initializer"), node.get("condition"),
                )
                iteration_values = (
                    node.get("update"), node.get("condition"),
                )
            effects.append(RepeatedEffects(
                loop_kind=node_type,
                control=controls,
                initial_effects=EffectSequence(tuple(
                    call
                    for value in initial_values if isinstance(value, dict)
                    for call in _pending_calls(value, parameters, certainty)
                )),
                body=_extract_sequence(
                    node.get("body", []), parameters,
                    certainty=EffectCertainty.POSSIBLE, room_active=room_active,
                ),
                iteration_effects=EffectSequence(tuple(
                    call
                    for value in iteration_values if isinstance(value, dict)
                    for call in _pending_calls(
                        value, parameters, EffectCertainty.POSSIBLE,
                    )
                )),
                location=_location(node),
                parameter_dependencies=_dependencies(controls, parameters),
            ))
            continue
        if node_type == "RoomNode":
            effects.extend(_pending_calls(
                {key: value for key, value in node.items() if key != "body"},
                parameters,
                certainty,
            ))
            effects.append(RoomEffects(
                declaration=_spatial_effect(
                    node, parameters, certainty, room_active,
                ),
                body=_extract_sequence(
                    node.get("body", []), parameters,
                    certainty=certainty, room_active=True,
                ),
            ))
            continue
        if node_type in _SPATIAL_KINDS:
            effects.extend(_pending_calls(node, parameters, certainty))
            effects.append(_spatial_effect(node, parameters, certainty, room_active))
            continue
        effects.extend(_pending_calls(node, parameters, certainty))
    return EffectSequence(tuple(effects))


def _spatial_effect(
    node: dict[str, Any], parameters: frozenset[str],
    certainty: EffectCertainty, room_active: bool,
) -> SpatialEffect:
    node_type = node["node"]
    kind = _SPATIAL_KINDS[node_type]
    name = node.get("name") or node.get("object_name")
    resources: list[RequiredResource] = []
    if node_type != "RoomNode" and not room_active:
        resources.append(RequiredResource(RequiredResourceKind.ACTIVE_ROOM))
    if node_type == "PlaceObjectNode":
        resources.append(RequiredResource(RequiredResourceKind.ELEMENT, name))
    elif node_type in {"MoveObjectNode", "RotateObjectNode"}:
        resources.append(RequiredResource(RequiredResourceKind.PLACED_ELEMENT, name))
    elif node_type in {"DoorNode", "WindowNode"}:
        resources.append(RequiredResource(RequiredResourceKind.WALL))
    return SpatialEffect(
        kind=kind,
        certainty=certainty,
        location=_location(node),
        source_node=node,
        name=name,
        element_kind=node.get("object_type"),
        required_resources=tuple(resources),
        parameter_dependencies=_dependencies(node, parameters),
    )


def _pending_calls(
    value: Any, parameters: frozenset[str], certainty: EffectCertainty,
) -> list[SpatialEffect]:
    calls: list[SpatialEffect] = []
    if isinstance(value, dict):
        if value.get("node") == "FunctionCallNode":
            # Runtime evaluates arguments left-to-right before invoking the
            # outer function. Keep the summary dependency order identical.
            for argument in value.get("arguments", []):
                calls.extend(_pending_calls(argument, parameters, certainty))
            calls.append(SpatialEffect(
                kind=SpatialEffectKind.PENDING_CALL,
                certainty=certainty,
                location=_location(value),
                source_node=value,
                name=value.get("name"),
                parameter_dependencies=_dependencies(value.get("arguments", []), parameters),
                arguments=tuple(value.get("arguments", [])),
            ))
            return calls
        for child in value.values():
            calls.extend(_pending_calls(child, parameters, certainty))
    elif isinstance(value, (list, tuple)):
        for child in value:
            calls.extend(_pending_calls(child, parameters, certainty))
    return calls


def _dependencies(value: Any, parameters: frozenset[str]) -> frozenset[str]:
    found: set[str] = set()
    if isinstance(value, dict):
        if value.get("node") == "IdentifierNode" and value.get("name") in parameters:
            found.add(value["name"])
        for child in value.values():
            found.update(_dependencies(child, parameters))
    elif isinstance(value, (list, tuple)):
        for child in value:
            found.update(_dependencies(child, parameters))
    return frozenset(found)


def _location(node: dict[str, Any]) -> SourceLocation:
    return SourceLocation(node.get("file", "<desconocido>"), node.get("line", 1), node.get("column", 1))
