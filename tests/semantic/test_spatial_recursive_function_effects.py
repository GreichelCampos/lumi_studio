"""Terminating contextual analysis of recursive spatial function effects."""

import time

from lumi_language.lexer import Lexer
from lumi_language.parser import Parser
from lumi_language.semantic_analyzer import SemanticAnalyzer
from lumi_language.spatial_abstract_state import AbstractPresence


def analyze(source: str, file: str = "recursion.lumi"):
    program = Parser(Lexer(source, file).tokenize(), file=file).parse()
    analyzer = SemanticAnalyzer()
    result = analyzer.analyze(program)
    return analyzer, result


def codes(result):
    return [item.code for item in result.diagnostics]


def test_direct_recursion_without_spatial_effects_terminates_as_unknown():
    analyzer, result = analyze(
        "funcion vacio ciclo() { ciclo()>> } "
        "habitacion sala(5, 4, 3) { ciclo()>> }"
    )

    assert result.succeeded
    assert analyzer.spatial_analyzer._abstract_state.unknown_rooms == {"sala"}


def test_effect_before_required_recursive_call_is_analyzed_repeatedly():
    analyzer, result = analyze(
        "funcion vacio ciclo() { mesa antes {} ciclo()>> } "
        "habitacion sala(5, 4, 3) { ciclo()>> }"
    )

    assert "antes" in analyzer.spatial_analyzer._abstract_state.room_elements("sala")
    assert codes(result) == ["SPA_DUPLICATE_ELEMENT"]


def test_effect_after_unconditional_recursive_call_is_not_claimed():
    analyzer, result = analyze(
        "funcion vacio ciclo() { ciclo()>> mesa despues {} } "
        "habitacion sala(5, 4, 3) { ciclo()>> }"
    )

    assert result.succeeded
    assert "despues" not in analyzer.spatial_analyzer._abstract_state.room_elements(
        "sala"
    )


def test_conditional_recursion_keeps_accumulated_failures_possible():
    analyzer, result = analyze(
        "funcion vacio ciclo(booleano continuar) { mesa item {} "
        "si continuar { ciclo(continuar)>> } } "
        "habitacion sala(5, 4, 3) { ciclo(verdadero)>> }"
    )

    assert "SPA_DUPLICATE_ELEMENT" not in codes(result)
    assert analyzer.spatial_analyzer._abstract_state.unknown_rooms == {"sala"}


def test_mutual_recursion_applies_each_component_member_without_python_recursion():
    analyzer, result = analyze(
        "funcion vacio a() { mesa desde_a {} b()>> } "
        "funcion vacio b() { silla desde_b {} a()>> } "
        "habitacion sala(5, 4, 3) { a()>> }"
    )
    room = analyzer.spatial_analyzer._abstract_state.room_elements("sala")

    assert {"desde_a", "desde_b"}.issubset(room)
    assert codes(result).count("SPA_DUPLICATE_ELEMENT") == 2


def test_three_function_recursive_component_is_detected():
    analyzer, _ = analyze(
        "funcion vacio a() { mesa ea {} b()>> } "
        "funcion vacio b() { mesa eb {} c()>> } "
        "funcion vacio c() { mesa ec {} a()>> } "
        "habitacion sala(5, 4, 3) { a()>> }"
    )

    assert {"ea", "eb", "ec"}.issubset(
        analyzer.spatial_analyzer._abstract_state.room_elements("sala")
    )


def test_recursive_function_never_called_has_no_spatial_effect():
    analyzer, result = analyze(
        "funcion vacio ciclo() { mesa fantasma {} ciclo()>> } "
        "habitacion sala(5, 4, 3) { }"
    )

    assert result.succeeded
    assert analyzer.spatial_analyzer._abstract_state.room_elements("sala") == {}
    assert analyzer.spatial_analyzer._abstract_state.unknown_rooms == set()


def test_non_recursive_wrapper_reaches_recursive_component():
    analyzer, _ = analyze(
        "funcion vacio ciclo() { mesa item {} ciclo()>> } "
        "funcion vacio entrada() { ciclo()>> } "
        "habitacion sala(5, 4, 3) { entrada()>> }"
    )

    assert "item" in analyzer.spatial_analyzer._abstract_state.room_elements("sala")


def test_constant_parameter_is_substituted_in_recursive_spatial_effect():
    analyzer, result = analyze(
        "funcion vacio desplazar(decimal x) { mover mesa1 [x, 0, 0]>> "
        "desplazar(x)>> } habitacion sala(5, 4, 3) { mesa mesa1 {} "
        "colocar mesa1 [0, 0, 0]>> desplazar(2.5)>> }"
    )

    assert "SEM_VECTOR_COMPONENT_NOT_NUMERIC" not in codes(result)
    assert analyzer.spatial_analyzer._abstract_state.unknown_rooms == {"sala"}


def test_unknown_parameter_does_not_invent_a_wall_orientation():
    analyzer, result = analyze(
        "funcion vacio desplazar(decimal x) { mover mesa1 [x, 0, 0]>> "
        "desplazar(x)>> } decimal destino = 2.5>> "
        "habitacion sala(5, 4, 3) { mesa mesa1 {} colocar mesa1 [0, 0, 0]>> "
        "desplazar(destino)>> }"
    )

    assert "SEM_VECTOR_COMPONENT_NOT_NUMERIC" not in codes(result)
    assert analyzer.spatial_analyzer._abstract_state.unknown_rooms == {"sala"}


def test_recursive_room_effect_uses_global_context_and_widens():
    analyzer, result = analyze(
        "funcion vacio crear() { habitacion interna(5, 4, 3) { crear()>> } } "
        "crear()>>"
    )
    state = analyzer.spatial_analyzer._abstract_state

    assert "SPA_DUPLICATE_ROOM" in codes(result)
    assert state.unknown_global_effects
    assert state.room_states("interna") == frozenset({AbstractPresence.TOP})


def test_recursive_floor_and_wall_effects_reach_unknown_fixed_point():
    analyzer, result = analyze(
        "funcion vacio construir() { piso suelo {} pared norte { "
        "orientacion \"norte\">> } construir()>> } "
        "habitacion sala(5, 4, 3) { construir()>> }"
    )

    assert "SPA_MULTIPLE_FLOORS" in codes(result)
    assert analyzer.spatial_analyzer._abstract_state.unknown_rooms == {"sala"}


def test_recursive_diagnostic_is_emitted_once_at_original_location():
    _, result = analyze(
        "funcion vacio ciclo() {\n  mesa item {}\n  ciclo()>>\n}\n"
        "habitacion sala(5, 4, 3) { ciclo()>> }",
        file="ubicacion_recursiva.lumi",
    )
    duplicates = [item for item in result.diagnostics
                  if item.code == "SPA_DUPLICATE_ELEMENT"]

    assert len(duplicates) == 1
    assert (duplicates[0].file, duplicates[0].line) == (
        "ubicacion_recursiva.lumi", 2,
    )


def test_recursive_unknown_state_prevents_downstream_false_positive():
    _, result = analyze(
        "funcion vacio ciclo() { ciclo()>> } "
        "habitacion sala(5, 4, 3) { ciclo()>> mover incierto [1, 0, 1]>> }"
    )

    assert "SPA_ELEMENT_NOT_FOUND" not in codes(result)


def test_large_recursive_scc_analysis_is_iterative_and_bounded():
    size = 1100
    declarations = " ".join(
        f"funcion vacio f{i}() {{ f{(i + 1) % size}()>> }}"
        for i in range(size)
    )
    started = time.monotonic()
    analyzer, result = analyze(
        f"{declarations} habitacion sala(5, 4, 3) {{ f0()>> }}"
    )

    assert result.succeeded
    assert analyzer.spatial_analyzer._abstract_state.unknown_rooms == {"sala"}
    assert time.monotonic() - started < 5.0
