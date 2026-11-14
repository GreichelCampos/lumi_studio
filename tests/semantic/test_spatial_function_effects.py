"""Structural summaries for spatial operations declared inside functions."""

from lumi_language.semantic_analyzer import SemanticAnalyzer
from lumi_language.spatial_function_effects import (
    ConditionalEffects,
    EffectCertainty,
    EffectSequence,
    RepeatedEffects,
    RoomEffects,
    RequiredResourceKind,
    SpatialEffect,
    SpatialEffectKind,
)


def node(kind, line=1, **values):
    return {"node": kind, "file": "efectos.lumi", "line": line, "column": 3, **values}


def literal(value, line=1):
    literal_kind = "boolean" if isinstance(value, bool) else "integer"
    return node("LiteralNode", line, value=value, literal_kind=literal_kind)


def identifier(name, line=1):
    return node("IdentifierNode", line, name=name)


def vector(x=0, y=0, z=0, line=1):
    return node("VectorNode", line, x=x if isinstance(x, dict) else literal(x, line),
                y=y if isinstance(y, dict) else literal(y, line),
                z=z if isinstance(z, dict) else literal(z, line))


def function(name="crear", body=None, parameters=None, line=1):
    return node("FunctionDeclarationNode", line, name=name,
                parameters=parameters or [], return_type="vacio", body=body or [])


def program(*statements):
    return node("ProgramNode", statements=list(statements))


def summarize(declaration, *other):
    analyzer = SemanticAnalyzer()
    analyzer.analyze(program(declaration, *other))
    summaries = list(analyzer._function_effect_summaries.values())
    return analyzer, next(item for item in summaries if item.name == declaration["name"])


def leaves(sequence):
    result = []
    for item in sequence.effects:
        if isinstance(item, SpatialEffect):
            result.append(item)
        elif isinstance(item, RoomEffects):
            result.append(item.declaration)
    return result


def test_empty_function_has_an_empty_ordered_summary():
    _, summary = summarize(function())

    assert summary.effects == EffectSequence()


def test_function_without_spatial_operations_has_no_effects():
    declaration = function(body=[node("ShowNode", expression=literal(1))])

    _, summary = summarize(declaration)

    assert summary.effects.effects == ()


def test_room_declaration_is_recorded_without_applying_it():
    room = node("RoomNode", 4, name="sala", width=literal(5), length=literal(4),
                height=literal(3), body=[])
    analyzer, summary = summarize(function(body=[room]))

    assert leaves(summary.effects)[0].kind is SpatialEffectKind.DECLARE_ROOM
    assert analyzer.spatial_analyzer._abstract_state.room_presence == {}


def test_element_declaration_and_placement_preserve_order_and_resources():
    chair = node("SpatialObjectDeclarationNode", 5, object_type="silla",
                 name="asiento", properties=[])
    place = node("PlaceObjectNode", 6, object_name="asiento", position=vector(line=6))
    room = node("RoomNode", 4, name="sala", width=literal(5), length=literal(4),
                height=literal(3), body=[chair, place])
    _, summary = summarize(function(body=[room]))
    room_effect = summary.effects.effects[0]
    assert isinstance(room_effect, RoomEffects)
    room_body = room_effect.body

    assert isinstance(room_body, EffectSequence)
    assert [item.kind for item in leaves(room_body)] == [
        SpatialEffectKind.DECLARE_ELEMENT, SpatialEffectKind.PLACE,
    ]
    assert leaves(room_body)[1].required_resources[0].kind is RequiredResourceKind.ELEMENT


def test_move_and_rotate_require_an_already_placed_element():
    move = node("MoveObjectNode", 7, object_name="mesa", position=vector(line=7))
    rotate = node("RotateObjectNode", 8, object_name="mesa", rotation=vector(line=8))
    _, summary = summarize(function(body=[move, rotate]))

    assert [item.kind for item in leaves(summary.effects)] == [
        SpatialEffectKind.MOVE, SpatialEffectKind.ROTATE,
    ]
    assert all(
        RequiredResourceKind.PLACED_ELEMENT in {resource.kind for resource in item.required_resources}
        for item in leaves(summary.effects)
    )


def test_floor_and_walls_are_distinct_ordered_effects():
    floor = node("FloorNode", 3, name="suelo", properties=[])
    wall = node("WallNode", 4, name="norte", properties=[])
    _, summary = summarize(function(body=[floor, wall]))

    assert [item.kind for item in leaves(summary.effects)] == [
        SpatialEffectKind.DECLARE_FLOOR, SpatialEffectKind.DECLARE_WALL,
    ]


def test_doors_and_windows_retain_wall_preconditions():
    door = node("DoorNode", 3, name="entrada", properties=[])
    window = node("WindowNode", 4, name="luz", properties=[])
    _, summary = summarize(function(body=[door, window]))

    assert [item.kind for item in leaves(summary.effects)] == [
        SpatialEffectKind.DECLARE_DOOR, SpatialEffectKind.DECLARE_WINDOW,
    ]
    assert all(
        RequiredResourceKind.WALL in {resource.kind for resource in item.required_resources}
        for item in leaves(summary.effects)
    )


def test_conditions_preserve_branches_and_mark_leaf_effects_possible():
    conditional = node("IfNode", 9, condition=literal(True),
                       then_body=[node("FloorNode", 10, name="a", properties=[])],
                       else_body=[node("FloorNode", 11, name="b", properties=[])])
    _, summary = summarize(function(body=[conditional]))
    effect = summary.effects.effects[0]

    assert isinstance(effect, ConditionalEffects)
    assert leaves(effect.then_effects)[0].certainty is EffectCertainty.POSSIBLE
    assert leaves(effect.else_effects)[0].source_node["name"] == "b"


def test_loops_preserve_control_body_and_repeatability():
    loop = node("RepeatNode", 12, count=literal(3),
                body=[node("RotateObjectNode", 13, object_name="mesa", rotation=vector())])
    _, summary = summarize(function(body=[loop]))
    effect = summary.effects.effects[0]

    assert isinstance(effect, RepeatedEffects)
    assert effect.loop_kind == "RepeatNode"
    assert effect.initial_effects.effects == ()
    assert leaves(effect.body)[0].certainty is EffectCertainty.POSSIBLE


def test_spatial_parameter_dependencies_are_explicit():
    parameter = node("ParameterNode", name="x", data_type="decimal")
    place = node("PlaceObjectNode", object_name="mesa",
                 position=vector(x=identifier("x")))
    _, summary = summarize(function(body=[place], parameters=[parameter]))

    assert leaves(summary.effects)[0].parameter_dependencies == frozenset({"x"})


def test_function_call_is_a_pending_dependency_not_an_applied_effect():
    call = node("FunctionCallNode", 6, name="auxiliar", arguments=[])
    helper = function("auxiliar")
    _, summary = summarize(function(body=[call]), helper)

    assert leaves(summary.effects)[0].kind is SpatialEffectKind.PENDING_CALL
    assert leaves(summary.effects)[0].name == "auxiliar"


def test_call_inside_spatial_expression_precedes_the_dependent_operation():
    call = node("FunctionCallNode", 6, name="coordenada", arguments=[])
    helper = function("coordenada")
    place = node("PlaceObjectNode", 6, object_name="mesa", position=vector(x=call))
    _, summary = summarize(function(body=[place]), helper)

    assert [item.kind for item in leaves(summary.effects)] == [
        SpatialEffectKind.PENDING_CALL, SpatialEffectKind.PLACE,
    ]


def test_uncalled_function_does_not_change_global_spatial_state():
    room = node("RoomNode", name="fantasma", width=literal(1), length=literal(1),
                height=literal(1), body=[])
    analyzer, _ = summarize(function(body=[room]))

    state = analyzer.spatial_analyzer._abstract_state
    assert state.rooms == {}
    assert state.room_presence == {}
    assert state.floor_presence == {}
    assert state.wall_presence == {}


def test_same_function_name_in_different_lexical_scopes_has_distinct_summaries():
    nested = function("repetida", [node("FloorNode", name="interior", properties=[])], line=3)
    outer = function("contenedora", [nested])
    top = function("repetida", [node("FloorNode", name="exterior", properties=[])], line=8)
    analyzer = SemanticAnalyzer()
    analyzer.analyze(program(outer, top))
    repeated = [item for item in analyzer._function_effect_summaries.values()
                if item.name == "repetida"]

    assert len(repeated) == 2
    assert len({item.scope_id for item in repeated}) == 2
    assert len({item.declaration_id for item in repeated}) == 2


def test_locations_and_original_normalized_node_identity_are_preserved():
    operation = node("RotateObjectNode", 27, object_name="mesa", rotation=vector(line=27))
    _, summary = summarize(function(body=[operation], line=20))
    effect = leaves(summary.effects)[0]

    assert (effect.location.file, effect.location.line, effect.location.column) == (
        "efectos.lumi", 27, 3,
    )
    assert effect.source_node is summary.source_node["body"][0]


def test_extraction_does_not_mutate_the_input_summary_tree_or_scene_state():
    declaration = function(body=[node("FloorNode", name="suelo", properties=[])])
    analyzer, summary = summarize(declaration)

    assert summary.source_node["body"][0]["name"] == "suelo"
    assert analyzer.spatial_analyzer._active_room is None
    assert analyzer.spatial_analyzer._elements == {}


def test_model_can_represent_unknown_effects_without_collapsing_order():
    unknown = SpatialEffect(
        kind=SpatialEffectKind.UNKNOWN,
        certainty=EffectCertainty.UNKNOWN,
        location=leaves(summarize(function(body=[
            node("FloorNode", name="suelo", properties=[]),
        ]))[1].effects)[0].location,
        source_node=node("FutureSpatialNode"),
    )

    assert unknown.kind is SpatialEffectKind.UNKNOWN
    assert unknown.certainty is EffectCertainty.UNKNOWN
