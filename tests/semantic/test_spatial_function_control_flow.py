"""Function-effect composition with Lumi conditional and loop semantics."""

import pytest

from lumi_language.interpreter import Interpreter
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser
from lumi_language.semantic_analyzer import SemanticAnalyzer
from lumi_language.spatial_abstract_state import (
    AbstractElementState,
)


def analyze(source: str, file: str = "control_funciones.lumi"):
    program = Parser(Lexer(source, file).tokenize(), file=file).parse()
    analyzer = SemanticAnalyzer()
    result = analyzer.analyze(program)
    return analyzer, result


def codes(result):
    return [item.code for item in result.diagnostics]


def elements(analyzer):
    return analyzer.spatial_analyzer._abstract_state.room_elements("sala")


def test_call_in_if_condition_is_inevitable_but_branch_calls_are_exclusive():
    analyzer, result = analyze(
        "funcion booleano decidir() { mesa condicion {} retornar verdadero>> } "
        "funcion vacio izquierda() { silla a {} } "
        "funcion vacio derecha() { silla b {} } "
        "habitacion sala(5, 4, 3) { si decidir() { izquierda()>> } "
        "sino { derecha()>> } }"
    )
    state = analyzer.spatial_analyzer._abstract_state
    possible = frozenset({
        AbstractElementState.ABSENT,
        AbstractElementState.DECLARED_UNPLACED,
    })

    assert result.succeeded
    assert state.states_for("sala", "condicion") == frozenset({
        AbstractElementState.DECLARED_UNPLACED,
    })
    assert state.states_for("sala", "a") == possible
    assert state.states_for("sala", "b") == possible


def test_calls_common_to_both_if_branches_remain_guaranteed_after_join():
    analyzer, _ = analyze(
        "funcion vacio crear() { mesa item {} } "
        "booleano opcion = verdadero>> habitacion sala(5, 4, 3) { "
        "si opcion { crear()>> } sino { crear()>> } }"
    )

    assert analyzer.spatial_analyzer._abstract_state.states_for(
        "sala", "item",
    ) == frozenset({AbstractElementState.DECLARED_UNPLACED})


def test_nested_conditions_do_not_apply_mutually_exclusive_calls_together():
    analyzer, result = analyze(
        "funcion vacio crear_a() { mesa a {} } "
        "funcion vacio crear_b() { mesa b {} } "
        "booleano x = verdadero>> booleano opcion = falso>> "
        "habitacion sala(5, 4, 3) { si x { si opcion { crear_a()>> } "
        "sino { crear_b()>> } } }"
    )

    assert result.succeeded
    assert set(elements(analyzer)) == {"a", "b"}


def test_switch_selector_call_is_inevitable_and_case_bodies_are_routes():
    analyzer, result = analyze(
        "funcion entero elegir() { mesa selector {} retornar 2>> } "
        "funcion vacio uno() { silla a {} } funcion vacio dos() { silla b {} } "
        "habitacion sala(5, 4, 3) { segun elegir() { "
        "caso 1: uno()>> caso 2: dos()>> defecto: uno()>> } }"
    )

    assert result.succeeded
    assert analyzer.spatial_analyzer._abstract_state.states_for(
        "sala", "selector",
    ) == frozenset({AbstractElementState.DECLARED_UNPLACED})


def test_switch_case_expressions_follow_interpreter_sequence():
    analyzer, result = analyze(
        "funcion entero caso_uno() { mesa primero {} retornar 1>> } "
        "funcion entero caso_dos() { mesa segundo {} retornar 2>> } "
        "habitacion sala(5, 4, 3) { segun 2 { "
        "caso caso_uno(): rotar primero [0, 0, 0]>> "
        "caso caso_dos(): rotar segundo [0, 0, 0]>> defecto: mostrar(0)>> } }"
    )
    state = analyzer.spatial_analyzer._abstract_state

    assert result.succeeded
    assert state.states_for("sala", "primero") == frozenset({
        AbstractElementState.DECLARED_UNPLACED,
    })
    assert state.states_for("sala", "segundo") == frozenset({
        AbstractElementState.ABSENT,
        AbstractElementState.DECLARED_UNPLACED,
    })


@pytest.mark.parametrize(
    "count, expected, diagnostics",
    [
        (0, AbstractElementState.ABSENT, []),
        (1, AbstractElementState.DECLARED_UNPLACED, []),
        (2, AbstractElementState.DECLARED_UNPLACED, ["SPA_DUPLICATE_ELEMENT"]),
    ],
)
def test_repeat_cardinality_applies_function_effects(count, expected, diagnostics):
    analyzer, result = analyze(
        "funcion vacio crear() { mesa item {} } "
        f"habitacion sala(5, 4, 3) {{ repetir {count} {{ crear()>> }} }}"
    )

    assert codes(result) == diagnostics
    assert expected in analyzer.spatial_analyzer._abstract_state.states_for(
        "sala", "item",
    )


def test_repeat_unknown_keeps_function_effect_possible_without_false_error():
    analyzer, result = analyze(
        "funcion vacio crear() { mesa item {} } entero cantidad = 2>> "
        "habitacion sala(5, 4, 3) { repetir cantidad { crear()>> } }"
    )

    assert result.succeeded
    assert analyzer.spatial_analyzer._abstract_state.states_for(
        "sala", "item",
    ) == frozenset({
        AbstractElementState.ABSENT,
        AbstractElementState.DECLARED_UNPLACED,
    })


def test_repeat_inside_function_reports_second_required_iteration_at_effect():
    _, result = analyze(
        "funcion vacio crear() { mesa item {} } "
        "funcion vacio dos_veces() { repetir 2 { crear()>> } } "
        "habitacion sala(5, 4, 3) { dos_veces()>> }",
        file="segunda_funcion.lumi",
    )

    assert codes(result) == ["SPA_DUPLICATE_ELEMENT"]
    assert result.diagnostics[0].file == "segunda_funcion.lumi"


def test_canonical_for_inside_function_preserves_required_cardinality():
    _, result = analyze(
        "funcion vacio crear() { mesa item {} } "
        "funcion vacio dos_veces() { hacer entero i = 0; i < 2; i = i + 1 { "
        "crear()>> } } habitacion sala(5, 4, 3) { dos_veces()>> }"
    )

    assert codes(result) == ["SPA_DUPLICATE_ELEMENT"]


def test_while_condition_is_evaluated_before_and_after_possible_body():
    analyzer, result = analyze(
        "funcion booleano seguir() { mesa condicion {} retornar falso>> } "
        "funcion vacio cuerpo() { silla posible {} } "
        "habitacion sala(5, 4, 3) { mientras seguir() { cuerpo()>> } }"
    )

    assert result.succeeded
    assert "condicion" in elements(analyzer)
    assert analyzer.spatial_analyzer._abstract_state.states_for(
        "sala", "posible",
    ) == frozenset({
        AbstractElementState.ABSENT,
        AbstractElementState.DECLARED_UNPLACED,
    })


def test_for_initializer_condition_update_and_body_calls_keep_phase_order():
    analyzer, result = analyze(
        "funcion entero iniciar() { mesa inicial {} retornar 0>> } "
        "funcion booleano comprobar(entero i) { mesa condicion {} retornar i < 1>> } "
        "funcion entero avanzar(entero i) { mesa actualizacion {} retornar i + 1>> } "
        "funcion vacio cuerpo() { mesa contenido {} } "
        "habitacion sala(5, 4, 3) { hacer entero i = iniciar(); comprobar(i); "
        "i = avanzar(i) { cuerpo()>> } }"
    )
    state = analyzer.spatial_analyzer._abstract_state

    assert result.succeeded
    assert state.states_for("sala", "inicial") == frozenset({
        AbstractElementState.DECLARED_UNPLACED,
    })
    assert state.states_for("sala", "condicion") == frozenset({
        AbstractElementState.DECLARED_UNPLACED,
    })
    possible = frozenset({
        AbstractElementState.ABSENT,
        AbstractElementState.DECLARED_UNPLACED,
    })
    assert state.states_for("sala", "contenido") == possible
    assert state.states_for("sala", "actualizacion") == possible


def test_transitive_call_inside_optional_route_remains_optional():
    analyzer, result = analyze(
        "funcion vacio base() { mesa item {} } "
        "funcion vacio transitiva() { base()>> } booleano opcion = verdadero>> "
        "habitacion sala(5, 4, 3) { si opcion { transitiva()>> } }"
    )

    assert result.succeeded
    assert analyzer.spatial_analyzer._abstract_state.states_for(
        "sala", "item",
    ) == frozenset({
        AbstractElementState.ABSENT,
        AbstractElementState.DECLARED_UNPLACED,
    })


def test_recursive_unknown_effect_prevents_definite_missing_element_error():
    analyzer, result = analyze(
        "funcion vacio desconocida() { desconocida()>> } "
        "habitacion sala(5, 4, 3) { desconocida()>> mover item [1, 0, 1]>> }"
    )

    assert "SPA_ELEMENT_NOT_FOUND" not in codes(result)
    assert analyzer.spatial_analyzer._abstract_state.unknown_rooms == {"sala"}


def test_repeated_function_diagnostic_is_not_duplicated_and_keeps_location():
    _, result = analyze(
        "funcion vacio crear() {\n  mesa item {}\n}\n"
        "habitacion sala(5, 4, 3) { repetir 3 { crear()>> } }",
        file="ubicacion_repetida.lumi",
    )
    duplicates = [item for item in result.diagnostics
                  if item.code == "SPA_DUPLICATE_ELEMENT"]

    assert len(duplicates) == 1
    assert (duplicates[0].file, duplicates[0].line) == (
        "ubicacion_repetida.lumi", 2,
    )


def test_scene_plan_still_contains_only_the_runtime_selected_route():
    source = (
        "funcion vacio izquierda() { silla a {} } "
        "funcion vacio derecha() { silla b {} } "
        "habitacion sala(5, 4, 3) { si falso { izquierda()>> } "
        "sino { derecha()>> } }"
    )
    program = Parser(Lexer(source, "escena.lumi").tokenize(), file="escena.lumi").parse()
    result = Interpreter().execute(program)

    assert result.succeeded
    assert [item.name for item in result.scene_plan.rooms[0].elements] == ["b"]
