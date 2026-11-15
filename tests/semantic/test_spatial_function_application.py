"""Application of non-recursive spatial function effects at call sites."""

from lumi_language.semantic_analyzer import SemanticAnalyzer
from lumi_language.spatial_abstract_state import (
    AbstractElementState,
    AbstractPresence,
)


def node(kind, line=1, **values):
    return {"node": kind, "file": "aplicacion.lumi", "line": line,
            "column": 4, **values}


def literal(value, line=1):
    if isinstance(value, bool):
        kind = "booleano"
    elif isinstance(value, str):
        kind = "texto"
    elif isinstance(value, float):
        kind = "decimal"
    else:
        kind = "entero"
    return node("LiteralNode", line, value=value, literal_kind=kind)


def identifier(name, line=1):
    return node("IdentifierNode", line, name=name)


def vector(line=1):
    return node("VectorNode", line, x=literal(0, line), y=literal(0, line),
                z=literal(0, line))


def parameter(name, data_type, line=1):
    return node("ParameterNode", line, name=name, data_type=data_type)


def function(name, body=None, parameters=None, return_type="vacio", line=1):
    return node("FunctionDeclarationNode", line, name=name,
                parameters=parameters or [], return_type=return_type,
                body=body or [])


def call(name, arguments=None, line=1):
    return node("FunctionCallNode", line, name=name, arguments=arguments or [])


def element(name, line=1, object_type="silla"):
    return node("SpatialObjectDeclarationNode", line, object_type=object_type,
                name=name, properties=[])


def place(name, line=1):
    return node("PlaceObjectNode", line, object_name=name, position=vector(line))


def move(name, line=1):
    return node("MoveObjectNode", line, object_name=name, position=vector(line))


def rotate(name, line=1):
    return node("RotateObjectNode", line, object_name=name, rotation=vector(line))


def property_node(name, value, line=1):
    return node("SpatialPropertyNode", line, name=name, value=value)


def room(name, body=None, line=1):
    return node("RoomNode", line, name=name, width=literal(5), length=literal(4),
                height=literal(3), body=body or [])


def program(*statements):
    return node("ProgramNode", statements=list(statements))


def analyze(*statements):
    analyzer = SemanticAnalyzer()
    result = analyzer.analyze(program(*statements))
    return analyzer, result


def codes(result):
    return [item.code for item in result.diagnostics]


def test_called_function_declares_room_and_applies_its_ordered_body():
    declaration = function("crear", [room("sala", [element("silla"), place("silla")])])
    analyzer, result = analyze(declaration, call("crear", line=10))
    state = analyzer.spatial_analyzer._abstract_state

    assert result.succeeded
    assert state.room_states("sala") == frozenset({AbstractPresence.PRESENT})
    assert state.states_for("sala", "silla") == frozenset({
        AbstractElementState.DECLARED_PLACED,
    })


def test_active_room_effects_compose_across_consecutive_calls():
    declare = function("declarar", [element("mesa", line=3)], line=2)
    position = function("posicionar", [place("mesa", line=6)], line=5)
    analyzer, result = analyze(
        declare, position,
        room("sala", [call("declarar", line=12), call("posicionar", line=13)]),
    )

    assert result.succeeded
    assert analyzer.spatial_analyzer._abstract_state.states_for(
        "sala", "mesa",
    ) == frozenset({AbstractElementState.DECLARED_PLACED})


def test_move_and_rotate_use_the_callers_existing_element_state():
    transform = function("transformar", [move("mesa", 4), rotate("mesa", 5)])
    analyzer, result = analyze(
        transform,
        room("sala", [element("mesa"), place("mesa"), call("transformar")]),
    )

    assert result.succeeded
    assert analyzer.spatial_analyzer._abstract_state.states_for(
        "sala", "mesa",
    ) == frozenset({AbstractElementState.DECLARED_PLACED})


def test_floor_wall_door_and_window_effects_are_applied():
    orientation = property_node("orientacion", literal("norte"))
    effects = function("arquitectura", [
        node("FloorNode", name="piso", properties=[]),
        node("WallNode", name="pared", properties=[orientation]),
        node("DoorNode", name="puerta", properties=[]),
        node("WindowNode", name="ventana", properties=[]),
    ])
    analyzer, _ = analyze(effects, room("sala", [call("arquitectura")]))
    state = analyzer.spatial_analyzer._abstract_state

    assert state.floor_states("sala") == frozenset({AbstractPresence.PRESENT})
    assert state.wall_states("sala", "norte") == frozenset({AbstractPresence.PRESENT})
    assert {"piso", "pared", "puerta", "ventana"}.issubset(
        state.room_elements("sala")
    )


def test_effect_requiring_active_room_reports_original_operation_location():
    declaration = function("declarar", [element("mesa", line=22)])
    _, result = analyze(declaration, call("declarar", line=40))

    diagnostic = next(item for item in result.diagnostics
                      if item.code == "SPA_OPERATION_OUTSIDE_ROOM")
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "aplicacion.lumi", 22, 4,
    )


def test_transitive_non_recursive_calls_apply_in_source_order():
    helper = function("declarar", [element("mesa", line=3)], line=2)
    outer = function("preparar", [call("declarar", line=7), place("mesa", line=8)], line=6)
    analyzer, result = analyze(
        helper, outer, room("sala", [call("preparar", line=15)]),
    )

    assert result.succeeded
    assert analyzer.spatial_analyzer._abstract_state.states_for(
        "sala", "mesa",
    ) == frozenset({AbstractElementState.DECLARED_PLACED})


def test_uncalled_function_does_not_change_the_callers_state():
    declaration = function("fantasma", [element("ausente")])
    analyzer, _ = analyze(declaration, room("sala"))

    assert analyzer.spatial_analyzer._abstract_state.room_elements("sala") == {}


def test_lexical_identity_selects_nested_function_effects():
    global_helper = function("ayuda", [element("global")], line=20)
    nested_helper = function("ayuda", [element("local")], line=4)
    outer = function("preparar", [nested_helper, call("ayuda", line=7)], line=2)
    analyzer, _ = analyze(
        global_helper, outer, room("sala", [call("preparar")]),
    )
    elements = analyzer.spatial_analyzer._abstract_state.room_elements("sala")

    assert "local" in elements
    assert "global" not in elements


def test_constant_parameter_substitution_selects_wall_orientation():
    wall = node("WallNode", name="pared", properties=[
        property_node("orientacion", identifier("lado")),
    ])
    declaration = function(
        "pared_en", [wall], [parameter("lado", "texto")],
    )
    analyzer, _ = analyze(
        declaration,
        room("sala", [call("pared_en", [literal("oeste")])]),
    )

    assert analyzer.spatial_analyzer._abstract_state.wall_states(
        "sala", "oeste",
    ) == frozenset({AbstractPresence.PRESENT})


def test_unknown_parameter_preserves_possible_wall_orientations():
    wall = node("WallNode", name="pared", properties=[
        property_node("orientacion", identifier("lado")),
    ])
    declaration = function("pared_en", [wall], [parameter("lado", "texto")])
    variable = node("VariableDeclarationNode", type="texto", name="direccion",
                    value=literal("norte"))
    analyzer, _ = analyze(
        declaration, variable,
        room("sala", [call("pared_en", [identifier("direccion")])]),
    )
    state = analyzer.spatial_analyzer._abstract_state

    possible = frozenset({AbstractPresence.ABSENT, AbstractPresence.PRESENT})
    assert all(
        state.wall_states("sala", orientation) == possible
        for orientation in ("norte", "sur", "este", "oeste")
    )


def test_call_in_initializer_applies_effect_once():
    declaration = function("crear", [
        element("mesa", line=3),
        node("ReturnNode", value=literal(1)),
    ], return_type="entero")
    variable = node("VariableDeclarationNode", type="entero", name="valor",
                    value=call("crear", line=10))
    analyzer, result = analyze(declaration, room("sala", [variable]))

    assert result.succeeded
    assert analyzer.spatial_analyzer._abstract_state.states_for(
        "sala", "mesa",
    ) == frozenset({AbstractElementState.DECLARED_UNPLACED})


def test_nested_argument_call_order_declares_before_outer_placement():
    inner = function("crear", [
        element("mesa", line=3), node("ReturnNode", value=literal(1)),
    ], return_type="entero", line=2)
    outer = function(
        "colocar_mesa", [place("mesa", line=8)],
        [parameter("ignorado", "entero")], line=7,
    )
    analyzer, result = analyze(
        inner, outer,
        room("sala", [call("colocar_mesa", [call("crear", line=15)], line=15)]),
    )

    assert result.succeeded
    assert analyzer.spatial_analyzer._abstract_state.states_for(
        "sala", "mesa",
    ) == frozenset({AbstractElementState.DECLARED_PLACED})


def test_conditional_effects_join_possible_element_presence():
    conditional = node(
        "IfNode", condition=identifier("condicion"),
        then_body=[element("a")], else_body=[element("b")],
    )
    declaration = function(
        "elegir", [conditional], [parameter("condicion", "booleano")],
    )
    variable = node(
        "VariableDeclarationNode", type="booleano", name="opcion",
        value=literal(True),
    )
    analyzer, _ = analyze(
        declaration, variable,
        room("sala", [call("elegir", [identifier("opcion")])]),
    )
    state = analyzer.spatial_analyzer._abstract_state
    possible = frozenset({
        AbstractElementState.ABSENT,
        AbstractElementState.DECLARED_UNPLACED,
    })

    assert state.states_for("sala", "a") == possible
    assert state.states_for("sala", "b") == possible


def test_recursive_summary_reaches_a_conservative_unknown_fixed_point():
    recursive = function("repetir", [element("mesa"), call("repetir")])
    analyzer, _ = analyze(recursive, room("sala", [call("repetir")]))

    state = analyzer.spatial_analyzer._abstract_state
    assert "mesa" in state.room_elements("sala")
    assert state.unknown_rooms == {"sala"}


def test_two_calls_do_not_duplicate_the_same_confirmed_diagnostic():
    declaration = function("declarar", [element("mesa", line=9)])
    _, result = analyze(
        declaration,
        room("sala", [call("declarar"), call("declarar")]),
    )

    assert codes(result).count("SPA_DUPLICATE_ELEMENT") == 1
