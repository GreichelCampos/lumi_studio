"""Static type and constant-value checks for Lumi spatial syntax."""

from collections.abc import Callable
from contextlib import contextmanager, nullcontext
from typing import Any

from spatial.spatial_rules import (
    PropertyRuleViolation,
    SpatialElementState,
    SpatialOperation,
    SpatialTransitionViolation,
    apply_element_operation,
    allowed_properties_for,
    dimension_diagnostic,
    multiple_floors_diagnostic,
    property_diagnostic,
    property_expected_type,
    validate_dimension_value,
    validate_room_start,
    validate_vector_component_value,
    vector_diagnostic,
)

from .constant_evaluator import Known, evaluate_numeric_constant
from .diagnostics import Diagnostic, DiagnosticCategory
from .spatial_abstract_state import (
    AbstractPresence,
    AbstractElementState,
    LoopCardinality,
    SpatialAbstractState,
    TransferClassification,
    apply_operation as apply_abstract_operation,
    declare as declare_abstract_element,
    declare_presence,
    join_presence_states,
)
from .spatial_function_effects import (
    AlternativeEffects,
    ConditionalEffects,
    EffectSequence,
    RepeatedEffects,
    RoomEffects,
    SpatialEffect,
    SpatialEffectKind,
)
from .symbol_table import DataType


NUMERIC_TYPES = frozenset({DataType.INTEGER, DataType.DECIMAL})
SPATIAL_NODE_TYPES = frozenset({
    "RoomNode", "SpatialObjectDeclarationNode", "FloorNode", "WallNode",
    "DoorNode", "WindowNode", "PlaceObjectNode", "MoveObjectNode",
    "RotateObjectNode",
})
ELEMENT_KINDS = {
    "SpatialObjectDeclarationNode": "object",
    "FloorNode": "floor",
    "WallNode": "wall",
    "DoorNode": "door",
    "WindowNode": "window",
}


class SpatialSemanticAnalyzer:
    """Analyze spatial nodes through the general semantic infrastructure."""

    def __init__(
        self,
        *,
        infer_expression: Callable[[dict[str, Any]], DataType | None],
        analyze_block: Callable[[list[dict[str, Any]], str], None],
        add_diagnostic: Callable[..., None],
        append_spatial_diagnostic: Callable[
            [Diagnostic, dict[str, Any], tuple], None
        ],
        diagnostic_count: Callable[[], int],
    ) -> None:
        self._infer_expression = infer_expression
        self._analyze_block = analyze_block
        self._add_diagnostic = add_diagnostic
        self._append_spatial_diagnostic = append_spatial_diagnostic
        self._diagnostic_count = diagnostic_count
        self._linear_suspensions = 0
        self._abstract_branch_depth = 0
        self._route_diagnostic_collectors: list[list[tuple]] = []
        self._transition_diagnostic_suspensions = 0
        self._active_room: str | None = None
        self._elements: dict[str, SpatialElementState] = {}
        self._abstract_state = SpatialAbstractState()
        self._analysis_complete = True

    @contextmanager
    def suspend_linear_analysis(self):
        """Keep expression checks while ignoring uncertain spatial effects."""

        self._linear_suspensions += 1
        try:
            yield
        finally:
            self._linear_suspensions -= 1

    @property
    def _linear_analysis_enabled(self) -> bool:
        return self._linear_suspensions == 0

    @property
    def in_abstract_branch(self) -> bool:
        """Whether resource checks must avoid cross-branch accumulation."""

        return self._abstract_branch_depth > 0

    @contextmanager
    def _abstract_branch(self):
        self._abstract_branch_depth += 1
        try:
            yield
        finally:
            self._abstract_branch_depth -= 1

    @contextmanager
    def _collect_route_diagnostics(self):
        """Defer cumulative failures until all alternative routes are known."""

        collector: list[tuple] = []
        self._route_diagnostic_collectors.append(collector)
        try:
            with self._abstract_branch():
                yield collector
        finally:
            self._route_diagnostic_collectors.pop()

    @contextmanager
    def _suppress_transition_diagnostics(self):
        self._transition_diagnostic_suspensions += 1
        try:
            yield
        finally:
            self._transition_diagnostic_suspensions -= 1

    def handles(self, node_type: str) -> bool:
        return node_type in SPATIAL_NODE_TYPES

    @property
    def analysis_complete(self) -> bool:
        """Whether spatial transfer analysis reached a determinate result."""

        return self._analysis_complete and self._abstract_state.analysis_complete

    def analyze_if(
        self,
        node: dict[str, Any],
        analyze_block: Callable[[list[dict[str, Any]], str], None],
    ) -> None:
        """Analyze mutually exclusive if branches from the same input state."""

        if not self._linear_analysis_enabled:
            with self.suspend_linear_analysis():
                analyze_block(node.get("then_body", []), "if")
                analyze_block(node.get("else_body", []), "else")
            return
        initial = self._abstract_state.copy()
        finals = []
        route_diagnostics = []
        for body, scope in (
            (node.get("then_body", []), "if"),
            (node.get("else_body", []), "else"),
        ):
            self._abstract_state = initial.copy()
            with self._collect_route_diagnostics() as diagnostics:
                analyze_block(body, scope)
            finals.append(self._abstract_state)
            route_diagnostics.append(diagnostics)
        self._abstract_state = SpatialAbstractState.join(*finals)
        self._emit_common_route_diagnostics(route_diagnostics)

    def analyze_switch(
        self,
        node: dict[str, Any],
        analyze_case_value: Callable[[dict[str, Any]], None],
        analyze_case_body: Callable[[dict[str, Any]], None],
        analyze_block: Callable[[list[dict[str, Any]], str], None],
    ) -> None:
        """Analyze every switch route independently and join its final state."""

        if not self._linear_analysis_enabled:
            with self.suspend_linear_analysis():
                for case in node.get("cases", []):
                    analyze_case_value(case)
                    analyze_case_body(case)
                analyze_block(node.get("default_body", []), "default")
            return
        finals = []
        route_diagnostics = []
        cases = node.get("cases", [])
        prefix = self._abstract_state.copy()
        for index, case in enumerate(cases):
            self._abstract_state = prefix.copy()
            if index == 0:
                analyze_case_value(case)
            else:
                with self._suppress_transition_diagnostics():
                    analyze_case_value(case)
            prefix = self._abstract_state.copy()
            with self._collect_route_diagnostics() as diagnostics:
                analyze_case_body(case)
            finals.append(self._abstract_state)
            route_diagnostics.append(diagnostics)
        default_body = node.get("default_body", [])
        self._abstract_state = prefix.copy()
        if default_body:
            with self._collect_route_diagnostics() as diagnostics:
                analyze_block(default_body, "default")
            route_diagnostics.append(diagnostics)
        else:
            route_diagnostics.append([])
        finals.append(self._abstract_state)
        self._abstract_state = SpatialAbstractState.join(*finals)
        self._emit_common_route_diagnostics(route_diagnostics)

    def _emit_common_route_diagnostics(
        self, routes: list[list[tuple]],
    ) -> None:
        """Emit only cumulative failures justified on every alternative."""

        if not routes:
            return
        if any(not route for route in routes):
            if any(route for route in routes):
                self._analysis_complete = False
            return
        common_keys = {record[0] for record in routes[0]}
        for route in routes[1:]:
            common_keys.intersection_update(record[0] for record in route)
        if any(
            record[0] not in common_keys
            for route in routes
            for record in route
        ):
            self._analysis_complete = False
        if not common_keys:
            return
        for route in routes:
            for record in route:
                if record[0] in common_keys:
                    self._emit_transition_record(record)

    def _emit_transition_record(self, record: tuple) -> None:
        if self._transition_diagnostic_suspensions:
            self._analysis_complete = False
            return
        if self._route_diagnostic_collectors:
            self._route_diagnostic_collectors[-1].append(record)
            return
        _, diagnostic, node, cause = record
        self._append_spatial_diagnostic(diagnostic, node, cause)

    def analyze_loop(
        self,
        cardinality: LoopCardinality,
        analyze_iteration: Callable[[], None],
    ) -> None:
        """Apply a loop transfer without executing or unrolling runtime counts."""

        if not self._linear_analysis_enabled:
            with self.suspend_linear_analysis():
                analyze_iteration()
            return

        if cardinality is LoopCardinality.ZERO:
            with self.suspend_linear_analysis():
                analyze_iteration()
            return

        if cardinality is LoopCardinality.EXACTLY_ONE:
            with self._abstract_branch():
                analyze_iteration()
            return

        if cardinality is LoopCardinality.AT_LEAST_TWO_KNOWN:
            # Two passes expose duplicate declaration/placement errors. Further
            # passes are bounded by the finite lifecycle lattice, not the count.
            self._iterate_to_fixed_point(
                analyze_iteration, include_zero=False,
                minimum_iterations=2, suppress_diagnostics=False,
            )
            return

        self._iterate_to_fixed_point(
            analyze_iteration, include_zero=True,
            minimum_iterations=1, suppress_diagnostics=True,
        )

    def _iterate_to_fixed_point(
        self,
        analyze_iteration: Callable[[], None],
        *,
        include_zero: bool,
        minimum_iterations: int,
        suppress_diagnostics: bool,
    ) -> None:
        initial = self._abstract_state.copy()
        accumulated = initial.copy() if include_zero else None
        # Element lifecycle height is small; eight passes also covers nested
        # branch joins while remaining independent of literal loop magnitude.
        stabilized = False
        for iteration in range(8):
            before = self._abstract_state.copy()
            diagnostic_context = (
                self._suppress_transition_diagnostics()
                if suppress_diagnostics
                else nullcontext()
            )
            with self._abstract_branch(), diagnostic_context:
                analyze_iteration()
            if accumulated is not None:
                self._abstract_state = SpatialAbstractState.join(
                    accumulated, self._abstract_state,
                )
                accumulated = self._abstract_state.copy()
            if (
                iteration + 1 >= minimum_iterations
                and self._abstract_state == before
            ):
                stabilized = True
                break
        if not stabilized:
            self._abstract_state.widen_to_unknown()

    def analyze(self, node: dict[str, Any]) -> None:
        node_type = node["node"]
        if node_type == "RoomNode":
            self._analyze_room(node)
        elif node_type in ELEMENT_KINDS:
            self._analyze_properties(node, ELEMENT_KINDS[node_type])
            self._declare_element(node)
            self._declare_architectural_resource(node)
        elif node_type in {"PlaceObjectNode", "MoveObjectNode"}:
            self._analyze_vector(
                node["position"], node["object_name"], "posición",
            )
            operation = (
                SpatialOperation.PLACE
                if node_type == "PlaceObjectNode"
                else SpatialOperation.MOVE
            )
            self._apply_operation(node, operation)
        elif node_type == "RotateObjectNode":
            self._analyze_vector(
                node["rotation"], node["object_name"], "rotación",
            )
            self._apply_operation(node, SpatialOperation.ROTATE)

    def apply_function_effects(
        self,
        effects: EffectSequence,
        bindings: dict[str, dict[str, Any] | None],
        apply_call: Callable[
            [SpatialEffect, dict[str, dict[str, Any] | None]], bool
        ],
    ) -> None:
        """Apply a non-recursive summary without rechecking its expressions."""

        if not self._linear_analysis_enabled:
            return
        self._apply_effect_sequence(effects, bindings, apply_call)

    def apply_unknown_function_effects(self) -> None:
        """Conservatively forget facts an unsupported call may modify."""

        if self._linear_analysis_enabled:
            self._analysis_complete = False
            self._abstract_state.mark_unknown_effects(self._active_room)

    def executable_pending_calls(
        self,
        effects: EffectSequence,
        bindings: dict[str, dict[str, Any] | None],
    ) -> tuple[SpatialEffect, ...]:
        """Return calls that may execute after substituting known arguments."""

        result: list[SpatialEffect] = []

        def visit(effect) -> None:
            if isinstance(effect, SpatialEffect):
                if effect.kind is SpatialEffectKind.PENDING_CALL:
                    result.append(effect)
                return
            if isinstance(effect, EffectSequence):
                for item in effect.effects:
                    visit(item)
                return
            if isinstance(effect, ConditionalEffects):
                condition = self._substitute(effect.condition, bindings)
                if (
                    condition.get("node") == "LiteralNode"
                    and condition.get("literal_kind") == "booleano"
                ):
                    visit(
                        effect.then_effects
                        if condition.get("value") is True
                        else effect.else_effects
                    )
                    return
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

        visit(effects)
        return tuple(result)

    def analyze_recursive_transfer(
        self,
        apply_iteration: Callable[[], None],
        *,
        recursion_required: bool,
    ) -> None:
        """Reach a bounded contextual fixed point for one recursive SCC."""

        if not self._linear_analysis_enabled:
            return
        if recursion_required:
            self._iterate_to_fixed_point(
                apply_iteration,
                include_zero=False,
                minimum_iterations=2,
                suppress_diagnostics=False,
            )
            return
        # The external invocation occurs once. Further recursive invocations
        # are optional because every cycle-closing edge is conditional.
        apply_iteration()
        self._iterate_to_fixed_point(
            apply_iteration,
            include_zero=True,
            minimum_iterations=1,
            suppress_diagnostics=True,
        )

    def _apply_effect_sequence(
        self,
        sequence: EffectSequence,
        bindings: dict[str, dict[str, Any] | None],
        apply_call: Callable[
            [SpatialEffect, dict[str, dict[str, Any] | None]], bool
        ],
    ) -> bool:
        for effect in sequence.effects:
            if isinstance(effect, SpatialEffect):
                if effect.kind is SpatialEffectKind.PENDING_CALL:
                    if not apply_call(effect, bindings):
                        return False
                else:
                    self._apply_effect_leaf(effect, bindings)
                continue
            if isinstance(effect, EffectSequence):
                if not self._apply_effect_sequence(effect, bindings, apply_call):
                    return False
                continue
            if isinstance(effect, RoomEffects):
                if not self._apply_room_effect(effect, bindings, apply_call):
                    return False
                continue
            if isinstance(effect, ConditionalEffects):
                condition = self._substitute(effect.condition, bindings)
                if (
                    condition.get("node") == "LiteralNode"
                    and condition.get("literal_kind") == "booleano"
                ):
                    selected = (
                        effect.then_effects
                        if condition.get("value") is True
                        else effect.else_effects
                    )
                    if not self._apply_effect_sequence(
                        selected, bindings, apply_call,
                    ):
                        return False
                    continue
                if not self._apply_effect_alternatives(
                    (effect.then_effects, effect.else_effects),
                    bindings, apply_call,
                ):
                    return False
                continue
            if isinstance(effect, AlternativeEffects):
                if not self._apply_effect_alternatives(
                    (*effect.branches, effect.default_effects),
                    bindings, apply_call,
                ):
                    return False
                continue
            if isinstance(effect, RepeatedEffects):
                if not self._apply_effect_sequence(
                    effect.initial_effects, bindings, apply_call,
                ):
                    return False

                iteration_continues = True

                def apply_iteration():
                    nonlocal iteration_continues
                    if not self._apply_effect_sequence(
                        effect.body, bindings, apply_call,
                    ):
                        iteration_continues = False
                        return
                    if not self._apply_effect_sequence(
                        effect.iteration_effects, bindings, apply_call,
                    ):
                        iteration_continues = False

                self.analyze_loop(
                    self._summary_loop_cardinality(effect, bindings),
                    apply_iteration,
                )
                if not iteration_continues:
                    return False
        return True

    def _summary_loop_cardinality(
        self,
        effect: RepeatedEffects,
        bindings: dict[str, dict[str, Any] | None],
    ) -> LoopCardinality:
        if effect.loop_kind == "RepeatNode" and effect.control:
            count = self._substitute(effect.control[-1], bindings)
            result = evaluate_numeric_constant(count)
            if not isinstance(result, Known) or not isinstance(result.value, int):
                return LoopCardinality.UNKNOWN
            if result.value <= 0:
                return LoopCardinality.ZERO
            if result.value == 1:
                return LoopCardinality.EXACTLY_ONE
            return LoopCardinality.AT_LEAST_TWO_KNOWN
        if effect.loop_kind == "WhileNode" and effect.control:
            condition = self._substitute(effect.control[0], bindings)
            if (
                condition.get("node") == "LiteralNode"
                and condition.get("literal_kind") == "booleano"
                and condition.get("value") is False
            ):
                return LoopCardinality.ZERO
            return LoopCardinality.ZERO_OR_MORE
        if effect.loop_kind == "ForNode" and len(effect.control) == 3:
            initializer, condition, update = (
                self._substitute(item, bindings) for item in effect.control
            )
            return self._for_effect_cardinality(initializer, condition, update)
        return LoopCardinality.UNKNOWN

    @staticmethod
    def _for_effect_cardinality(
        initializer: dict[str, Any],
        condition: dict[str, Any],
        update: dict[str, Any],
    ) -> LoopCardinality:
        name = initializer.get("name")
        if not name or update.get("name") != name:
            return LoopCardinality.UNKNOWN
        initial = evaluate_numeric_constant(initializer.get("value", {}))
        if not isinstance(initial, Known) or not isinstance(initial.value, int):
            return LoopCardinality.UNKNOWN
        if condition.get("node") != "BinaryExpressionNode":
            return LoopCardinality.UNKNOWN
        left = condition.get("left", {})
        bound = evaluate_numeric_constant(condition.get("right", {}))
        if (
            left.get("node") != "IdentifierNode"
            or left.get("name") != name
            or not isinstance(bound, Known)
            or not isinstance(bound.value, int)
        ):
            return LoopCardinality.UNKNOWN
        update_value = update.get("value", {})
        update_left = update_value.get("left", {})
        operator = update_value.get("operator")
        step_value = evaluate_numeric_constant(update_value.get("right", {}))
        if (
            update_value.get("node") != "BinaryExpressionNode"
            or update_left.get("node") != "IdentifierNode"
            or update_left.get("name") != name
            or operator not in {"+", "-"}
            or not isinstance(step_value, Known)
            or not isinstance(step_value.value, int)
        ):
            return LoopCardinality.UNKNOWN
        step = step_value.value if operator == "+" else -step_value.value
        if step == 0:
            return LoopCardinality.UNKNOWN
        predicates = {
            "<": lambda value: value < bound.value,
            "<=": lambda value: value <= bound.value,
            ">": lambda value: value > bound.value,
            ">=": lambda value: value >= bound.value,
        }
        predicate = predicates.get(condition.get("operator"))
        if predicate is None or not predicate(initial.value):
            return (
                LoopCardinality.UNKNOWN
                if predicate is None else LoopCardinality.ZERO
            )
        if not predicate(initial.value + step):
            return LoopCardinality.EXACTLY_ONE
        return LoopCardinality.AT_LEAST_TWO_KNOWN

    def _apply_effect_alternatives(
        self,
        alternatives: tuple[EffectSequence, ...],
        bindings: dict[str, dict[str, Any] | None],
        apply_call: Callable[
            [SpatialEffect, dict[str, dict[str, Any] | None]], bool
        ],
    ) -> bool:
        initial = self._abstract_state.copy()
        finals = []
        route_diagnostics = []
        continuations = []
        for alternative in alternatives:
            self._abstract_state = initial.copy()
            with self._collect_route_diagnostics() as diagnostics:
                continuations.append(
                    self._apply_effect_sequence(alternative, bindings, apply_call)
                )
            finals.append(self._abstract_state)
            route_diagnostics.append(diagnostics)
        self._abstract_state = SpatialAbstractState.join(*finals)
        self._emit_common_route_diagnostics(route_diagnostics)
        return all(continuations)

    def _apply_room_effect(
        self,
        effect: RoomEffects,
        bindings: dict[str, dict[str, Any] | None],
        apply_call: Callable[
            [SpatialEffect, dict[str, dict[str, Any] | None]], bool
        ],
    ) -> bool:
        node = self._substitute(effect.declaration.source_node, bindings)
        room_name = node["name"]
        if self._active_room is not None:
            return True
        initial = self._abstract_state.copy()
        transfer = declare_presence(self._abstract_state.room_states(room_name))
        if transfer.confirmed_duplicate:
            self._report_transition(
                SpatialTransitionViolation.DUPLICATE_ROOM,
                node,
                room_name=room_name,
            )
            return True
        self._abstract_state.set_room_states(room_name, transfer.states)
        previous_room = self._active_room
        previous_elements = self._elements
        self._active_room = room_name
        self._elements = {}
        try:
            continues = self._apply_effect_sequence(
                effect.body, bindings, apply_call,
            )
        finally:
            self._active_room = previous_room
            self._elements = previous_elements
        if transfer.classification is TransferClassification.POSSIBLE_ERROR:
            self._abstract_state = SpatialAbstractState.join(
                initial, self._abstract_state,
            )
        return continues

    def _apply_effect_leaf(
        self,
        effect: SpatialEffect,
        bindings: dict[str, dict[str, Any] | None],
    ) -> None:
        node = self._substitute(effect.source_node, bindings)
        if self._active_room is None:
            self._report_transition(
                SpatialTransitionViolation.NO_ACTIVE_ROOM,
                node,
                element_name=node.get("name") or node.get("object_name"),
            )
            return
        if effect.kind in {
            SpatialEffectKind.DECLARE_ELEMENT,
            SpatialEffectKind.DECLARE_FLOOR,
            SpatialEffectKind.DECLARE_WALL,
            SpatialEffectKind.DECLARE_DOOR,
            SpatialEffectKind.DECLARE_WINDOW,
        }:
            self._declare_element(node)
            if (
                effect.kind is SpatialEffectKind.DECLARE_WALL
                and not self._known_orientation(node)
            ):
                possible = frozenset({AbstractPresence.PRESENT})
                for orientation in ("norte", "sur", "este", "oeste"):
                    self._abstract_state.set_wall_states(
                        self._active_room,
                        orientation,
                        join_presence_states(
                            self._abstract_state.wall_states(
                                self._active_room, orientation,
                            ),
                            possible,
                        ),
                    )
                return
            self._declare_architectural_resource(node)
            return
        operation = {
            SpatialEffectKind.PLACE: SpatialOperation.PLACE,
            SpatialEffectKind.MOVE: SpatialOperation.MOVE,
            SpatialEffectKind.ROTATE: SpatialOperation.ROTATE,
        }.get(effect.kind)
        if operation is not None:
            self._apply_operation(node, operation)

    @staticmethod
    def _known_orientation(node: dict[str, Any]) -> bool:
        for item in node.get("properties", []):
            if item.get("name") != "orientacion":
                continue
            value = item.get("value", {})
            return (
                value.get("node") == "LiteralNode"
                and value.get("value") in {"norte", "sur", "este", "oeste"}
            )
        return False

    def _substitute(
        self,
        value: Any,
        bindings: dict[str, dict[str, Any] | None],
    ) -> Any:
        if isinstance(value, dict):
            if value.get("node") == "IdentifierNode" and value.get("name") in bindings:
                replacement = bindings[value["name"]]
                return value if replacement is None else replacement
            return {key: self._substitute(item, bindings) for key, item in value.items()}
        if isinstance(value, list):
            return [self._substitute(item, bindings) for item in value]
        if isinstance(value, tuple):
            return tuple(self._substitute(item, bindings) for item in value)
        return value

    def _analyze_room(self, node: dict[str, Any]) -> None:
        dimensions = (
            ("ancho", node["width"]),
            ("largo", node["length"]),
            ("alto", node["height"]),
        )
        for dimension_name, dimension in dimensions:
            dimension_type, inference_failed = self._infer_once(dimension)
            if inference_failed:
                continue
            if dimension_type not in NUMERIC_TYPES:
                self._add_diagnostic(
                    dimension,
                    "SEM_SPATIAL_DIMENSION_NOT_NUMERIC",
                    "Las dimensiones de una habitacion deben ser numericas.",
                    "Utilice una expresion de tipo entero o decimal.",
                    cause=(dimension_type, "spatial-dimension"),
                )
                continue

            constant = evaluate_numeric_constant(dimension)
            if isinstance(constant, Known):
                violation = validate_dimension_value(constant.value)
                if violation is not None:
                    diagnostic = dimension_diagnostic(
                        room_name=node["name"],
                        dimension_name=dimension_name,
                        violation=violation,
                        **self._location(dimension),
                    )
                    self._append_spatial_diagnostic(
                        diagnostic, dimension,
                        (dimension_name, violation, "constant-dimension"),
                    )

        if not self._linear_analysis_enabled:
            self._analyze_block(node.get("body", []), "room")
            return

        violation = validate_room_start(
            room_active=self._active_room is not None,
            room_exists=False,
        )
        if violation is SpatialTransitionViolation.ROOM_ALREADY_ACTIVE:
            with self.suspend_linear_analysis():
                self._analyze_block(node.get("body", []), "room")
            return

        initial = self._abstract_state.copy()
        room_transfer = declare_presence(
            self._abstract_state.room_states(node["name"])
        )
        if room_transfer.confirmed_duplicate:
            self._report_transition(
                SpatialTransitionViolation.DUPLICATE_ROOM,
                node,
                room_name=node["name"],
            )
            with self.suspend_linear_analysis():
                self._analyze_block(node.get("body", []), "room")
            return
        self._abstract_state.set_room_states(node["name"], room_transfer.states)
        self._active_room = node["name"]
        self._elements = {}
        try:
            self._analyze_block(node.get("body", []), "room")
        finally:
            self._active_room = None
            self._elements = {}
        if room_transfer.classification is TransferClassification.POSSIBLE_ERROR:
            self._abstract_state = SpatialAbstractState.join(
                initial, self._abstract_state,
            )

    def _declare_architectural_resource(self, node: dict[str, Any]) -> None:
        if not self._linear_analysis_enabled or self._active_room is None:
            return
        node_type = node["node"]
        if node_type == "FloorNode":
            transfer = declare_presence(
                self._abstract_state.floor_states(self._active_room)
            )
            if transfer.confirmed_duplicate:
                diagnostic = multiple_floors_diagnostic(
                    room_name=self._active_room, **self._location(node),
                )
                self._emit_transition_record((
                    ("multiple-floors", self._active_room),
                    diagnostic,
                    node,
                    (self._active_room, "abstract-multiple-floors"),
                ))
                return
            self._abstract_state.set_floor_states(
                self._active_room, transfer.states,
            )
            return
        if node_type != "WallNode":
            return
        orientation_property = next(
            (
                item for item in node.get("properties", [])
                if item.get("name") == "orientacion"
            ),
            None,
        )
        if orientation_property is None:
            return
        value = orientation_property.get("value", {})
        orientation = value.get("value") if value.get("node") == "LiteralNode" else None
        if orientation not in {"norte", "sur", "este", "oeste"}:
            return
        transfer = declare_presence(
            self._abstract_state.wall_states(self._active_room, orientation)
        )
        if transfer.confirmed_duplicate:
            diagnostic = Diagnostic(
                category=DiagnosticCategory.SEMANTIC,
                code="SEM_DUPLICATE_WALL_ORIENTATION",
                description=(
                    f"La habitaciÃ³n '{self._active_room}' ya tiene una pared "
                    f"explÃ­cita para la orientaciÃ³n '{orientation}'."
                ),
                suggestion=(
                    "Conserve como mÃ¡ximo una pared explÃ­cita por orientaciÃ³n."
                ),
                **self._location(orientation_property),
            )
            self._emit_transition_record((
                ("duplicate-wall", self._active_room, orientation),
                diagnostic,
                orientation_property,
                (self._active_room, orientation, "abstract-wall"),
            ))
            return
        self._abstract_state.set_wall_states(
            self._active_room, orientation, transfer.states,
        )

    @staticmethod
    def _element_identity(node: dict[str, Any], name_key: str) -> tuple[str, bool]:
        name = node[name_key]
        index = node.get("object_index")
        if index is None:
            return name, True
        constant = evaluate_numeric_constant(index)
        if isinstance(constant, Known) and type(constant.value) is int and constant.value >= 0:
            return f"{name}[{constant.value}]", True
        # The interpreter resolves dynamic or invalid indices at execution.
        return f"{name}[]", False

    def _declare_element(self, node: dict[str, Any]) -> None:
        if not self._linear_analysis_enabled or self._active_room is None:
            return
        name, known = self._element_identity(node, "name")
        if not known:
            self._abstract_state.set_states(
                self._active_room, name, frozenset({AbstractElementState.TOP}),
            )
            return
        abstract = declare_abstract_element(
            self._abstract_state.states_for(self._active_room, name)
        )
        if abstract.classification in {
            TransferClassification.POSSIBLE_ERROR,
            TransferClassification.UNKNOWN,
        }:
            self._analysis_complete = False
        if abstract.confirmed_reason is not None:
            self._report_transition(
                abstract.confirmed_reason, node, room_name=self._active_room,
                element_name=name,
            )
            return
        self._abstract_state.set_states(self._active_room, name, abstract.states)
        # Retain this compatibility mirror without making it authoritative.
        if abstract.states == frozenset({AbstractElementState.DECLARED_UNPLACED}):
            self._elements[name] = SpatialElementState()

    def _apply_operation(
        self, node: dict[str, Any], operation: SpatialOperation,
    ) -> None:
        if not self._linear_analysis_enabled:
            return
        name, known = self._element_identity(node, "object_name")
        if self._active_room is not None:
            if not known:
                self._abstract_state.set_states(
                    self._active_room, name, frozenset({AbstractElementState.TOP}),
                )
                return
            abstract = apply_abstract_operation(
                self._abstract_state.states_for(self._active_room, name), operation,
            )
            if abstract.classification in {
                TransferClassification.POSSIBLE_ERROR,
                TransferClassification.UNKNOWN,
            }:
                self._analysis_complete = False
            if abstract.confirmed_reason is not None:
                self._report_transition(
                    abstract.confirmed_reason, node, room_name=self._active_room,
                    element_name=name,
                )
                return
            self._abstract_state.set_states(
                self._active_room, name, abstract.states,
            )
            # Abstract state is authoritative after a control-flow join.
            concrete_states = abstract.states
            if concrete_states == frozenset({AbstractElementState.DECLARED_UNPLACED}):
                self._elements[name] = SpatialElementState(placed=False)
            elif concrete_states == frozenset({AbstractElementState.DECLARED_PLACED}):
                self._elements[name] = SpatialElementState(placed=True)
            return
        next_state, violation = apply_element_operation(
            room_active=self._active_room is not None,
            element_state=self._elements.get(name),
            operation=operation,
        )
        if violation is not None:
            self._report_transition(
                violation, node, room_name=self._active_room,
                element_name=name,
            )
            return
        assert next_state is not None
        self._elements[name] = next_state

    def _report_transition(
        self,
        violation: SpatialTransitionViolation,
        node: dict[str, Any],
        *,
        room_name: str | None = None,
        element_name: str | None = None,
    ) -> None:
        details = {
            SpatialTransitionViolation.DUPLICATE_ROOM: (
                "SPA_DUPLICATE_ROOM",
                f"La habitación '{room_name}' ya fue declarada.",
                "Utilice un nombre diferente para cada habitación.",
            ),
            SpatialTransitionViolation.DUPLICATE_ELEMENT: (
                "SPA_DUPLICATE_ELEMENT",
                f"El elemento '{element_name}' ya está declarado en la "
                f"habitación '{room_name}'.",
                "Utilice un nombre diferente dentro de la habitación.",
            ),
            SpatialTransitionViolation.ELEMENT_NOT_FOUND: (
                "SPA_ELEMENT_NOT_FOUND",
                f"El elemento '{element_name}' no está declarado en la "
                f"habitación '{room_name}'.",
                "Declare el elemento antes de utilizarlo.",
            ),
            SpatialTransitionViolation.ELEMENT_ALREADY_PLACED: (
                "SPA_ELEMENT_ALREADY_PLACED",
                f"El elemento '{element_name}' ya tiene una posición inicial.",
                "Utilice 'mover' para reemplazar su posición.",
            ),
            SpatialTransitionViolation.ELEMENT_NOT_PLACED: (
                "SPA_ELEMENT_NOT_PLACED",
                f"El elemento '{element_name}' debe colocarse antes de moverlo.",
                "Coloque el elemento antes de moverlo.",
            ),
            SpatialTransitionViolation.NO_ACTIVE_ROOM: (
                "SPA_OPERATION_OUTSIDE_ROOM",
                "La operación espacial requiere una habitación activa.",
                "Mueva la operación al cuerpo de una habitación.",
            ),
        }
        code, description, suggestion = details[violation]
        diagnostic = Diagnostic(
            category=DiagnosticCategory.SPATIAL,
            code=code,
            description=description,
            suggestion=suggestion,
            **self._location(node),
        )
        self._emit_transition_record((
            (violation, room_name, element_name),
            diagnostic,
            node,
            (violation, room_name, element_name, "linear-transition"),
        ))

    def _analyze_vector(
        self, vector: dict[str, Any], element_name: str, vector_name: str,
    ) -> None:
        for component_name in ("x", "y", "z"):
            component = vector[component_name]
            component_type, inference_failed = self._infer_once(component)
            if inference_failed:
                continue
            if component_type not in NUMERIC_TYPES:
                if component_type is not None:
                    self._add_diagnostic(
                        component,
                        "SEM_VECTOR_COMPONENT_NOT_NUMERIC",
                        "Los componentes de un vector deben ser numéricos.",
                        "Utilice valores de tipo entero o decimal.",
                        cause=(component_type,),
                    )
                continue

            constant = evaluate_numeric_constant(component)
            if not isinstance(constant, Known):
                continue
            violation = validate_vector_component_value(constant.value)
            if violation is None:
                continue
            diagnostic = vector_diagnostic(
                element_name=element_name,
                vector_name=vector_name,
                component_name=component_name,
                violation=violation,
                **self._location(component),
            )
            self._append_spatial_diagnostic(
                diagnostic, component,
                (element_name, vector_name, component_name, violation),
            )

    def _analyze_properties(
        self, node: dict[str, Any], element_kind: str,
    ) -> None:
        seen: set[str] = set()
        for property_node in node.get("properties", []):
            name = property_node["name"]
            if name in seen:
                diagnostic = property_diagnostic(
                    element_name=node["name"],
                    element_kind=element_kind,
                    property_name=name,
                    violation=PropertyRuleViolation.DUPLICATE,
                    **self._location(property_node),
                )
                self._append_spatial_diagnostic(
                    diagnostic, property_node,
                    (node["name"], name, "duplicate-property"),
                )
                continue
            seen.add(name)

            if name not in allowed_properties_for(element_kind):
                diagnostic = property_diagnostic(
                    element_name=node["name"],
                    element_kind=element_kind,
                    property_name=name,
                    violation=PropertyRuleViolation.NOT_ALLOWED,
                    **self._location(property_node),
                )
                self._append_spatial_diagnostic(
                    diagnostic, property_node,
                    (node["name"], name, "property-not-allowed"),
                )
                continue

            value = property_node["value"]
            value_type, inference_failed = self._infer_once(value)
            if inference_failed:
                continue
            expected_family = property_expected_type(name)
            if expected_family == "text":
                expected = "texto"
                compatible = value_type is DataType.STRING
            elif expected_family == "numeric":
                expected = "entero o decimal"
                compatible = value_type in NUMERIC_TYPES
            else:
                continue
            if not compatible:
                self._add_diagnostic(
                    value,
                    "SEM_SPATIAL_PROPERTY_TYPE_MISMATCH",
                    (
                        f"La propiedad espacial '{name}' requiere un valor "
                        f"de tipo {expected}."
                    ),
                    "Utilice una expresion compatible con la propiedad.",
                    cause=(name, value_type, "spatial-property"),
                )

    def _infer_once(
        self, expression: dict[str, Any],
    ) -> tuple[DataType | None, bool]:
        before = self._diagnostic_count()
        expression_type = self._infer_expression(expression)
        return (
            expression_type,
            expression_type is None or self._diagnostic_count() > before,
        )

    @staticmethod
    def _location(node: dict[str, Any]) -> dict[str, str | int]:
        return {
            "file": node.get("file", "<desconocido>"),
            "line": node.get("line", 1),
            "column": node.get("column", 1),
        }
