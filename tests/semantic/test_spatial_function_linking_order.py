"""Evaluation order and early dependency linking for function effects."""

from lumi_language.interpreter import Interpreter
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser
from lumi_language.semantic_analyzer import SemanticAnalyzer
from lumi_language.spatial_abstract_state import AbstractElementState


def analyze(source: str, file: str = "enlace.lumi"):
    program = Parser(Lexer(source, file).tokenize(), file=file).parse()
    analyzer = SemanticAnalyzer()
    result = analyzer.analyze(program)
    return analyzer, result, program


def codes(result):
    return [item.code for item in result.diagnostics]


def test_nested_argument_effect_precedes_outer_call_effect():
    source = (
        "funcion entero crear() { mesa item {} retornar 1>> } "
        "funcion vacio colocar_mesa(entero x) { colocar item [x, 0, 0]>> } "
        "funcion vacio envolver() { colocar_mesa(crear())>> } "
        "habitacion sala(5, 4, 3) { envolver()>> }"
    )
    analyzer, semantic, program = analyze(source)
    runtime = Interpreter().execute(program)

    assert semantic.succeeded == runtime.succeeded
    assert codes(semantic) == []
    assert analyzer.spatial_analyzer._abstract_state.states_for(
        "sala", "item",
    ) == frozenset({AbstractElementState.DECLARED_PLACED})


def test_two_call_arguments_are_applied_left_to_right_before_outer_call():
    source = (
        "funcion entero declarar() { mesa item {} retornar 1>> } "
        "funcion entero posicionar() { colocar item [0, 0, 0]>> retornar 2>> } "
        "funcion vacio consumir(entero a, entero b) { mover item [a + b, 0, 0]>> } "
        "funcion vacio envolver() { consumir(declarar(), posicionar())>> } "
        "habitacion sala(5, 4, 3) { envolver()>> }"
    )
    analyzer, result, _ = analyze(source)

    assert result.succeeded
    assert analyzer.spatial_analyzer._abstract_state.states_for(
        "sala", "item",
    ) == frozenset({AbstractElementState.DECLARED_PLACED})


def test_three_nested_call_levels_preserve_inside_out_order_without_duplicates():
    source = (
        "funcion entero crear() { mesa item {} retornar 1>> } "
        "funcion entero colocar_nivel(entero x) { colocar item [x, 0, 0]>> retornar x>> } "
        "funcion vacio final(entero x) { mover item [x, 0, 0]>> } "
        "funcion vacio envolver() { final(colocar_nivel(crear()))>> } "
        "habitacion sala(5, 4, 3) { envolver()>> }"
    )
    analyzer, result, _ = analyze(source)

    assert result.succeeded
    assert analyzer.spatial_analyzer._abstract_state.states_for(
        "sala", "item",
    ) == frozenset({AbstractElementState.DECLARED_PLACED})


def test_forward_transitive_dependency_is_linked_before_call_application():
    source = (
        "habitacion sala(5, 4, 3) { preparar()>> } "
        "funcion vacio declarar() { mesa item {} } "
        "funcion vacio preparar() { declarar()>> }"
    )
    analyzer, result, program = analyze(source)
    runtime = Interpreter().execute(program)

    assert result.succeeded == runtime.succeeded
    assert analyzer.spatial_analyzer._abstract_state.unknown_rooms == set()
    assert analyzer.spatial_analyzer._abstract_state.states_for(
        "sala", "item",
    ) == frozenset({AbstractElementState.DECLARED_UNPLACED})


def test_forward_chain_of_three_functions_keeps_effect_location():
    source = (
        "habitacion sala(5, 4, 3) { primera()>> mover item [1, 0, 0]>> } "
        "funcion vacio tercera() {\n  mesa item {}\n  colocar item [0, 0, 0]>>\n}\n"
        "funcion vacio segunda() { tercera()>> } "
        "funcion vacio primera() { segunda()>> }"
    )
    analyzer, result, _ = analyze(source, "cadena.lumi")

    assert result.succeeded
    assert analyzer.spatial_analyzer._abstract_state.unknown_rooms == set()
    assert "item" in analyzer.spatial_analyzer._abstract_state.room_elements("sala")


def test_uncalled_forward_chain_still_has_no_spatial_effect():
    analyzer, result, _ = analyze(
        "habitacion sala(5, 4, 3) {} "
        "funcion vacio declarar() { mesa item {} } "
        "funcion vacio preparar() { declarar()>> }"
    )

    assert result.succeeded
    assert analyzer.spatial_analyzer._abstract_state.room_elements("sala") == {}


def test_nested_call_in_spatial_property_is_evaluated_before_declaration():
    analyzer, result, _ = analyze(
        'funcion texto color_efecto() { mesa marca {} retornar "rojo">> } '
        "funcion vacio decorar() { silla asiento { color color_efecto()>> } } "
        "habitacion sala(5, 4, 3) { decorar()>> }"
    )

    assert result.succeeded
    assert set(analyzer.spatial_analyzer._abstract_state.room_elements("sala")) == {
        "marca", "asiento",
    }


def test_forward_direct_call_remains_precisely_linked():
    analyzer, result, _ = analyze(
        "habitacion sala(5, 4, 3) { crear()>> } "
        "funcion vacio crear() { mesa item {} }"
    )

    assert result.succeeded
    assert analyzer.spatial_analyzer._abstract_state.unknown_rooms == set()
    assert "item" in analyzer.spatial_analyzer._abstract_state.room_elements("sala")


def test_forward_nested_homonym_uses_lexically_nearest_function():
    analyzer, result, _ = analyze(
        "funcion vacio ayuda() { mesa global {} } "
        "habitacion sala(5, 4, 3) { preparar()>> } "
        "funcion vacio preparar() { funcion vacio ayuda() { mesa local {} } ayuda()>> }"
    )
    room = analyzer.spatial_analyzer._abstract_state.room_elements("sala")

    assert result.succeeded
    assert "local" in room
    assert "global" not in room


def test_nested_summary_call_is_not_applied_twice():
    _, result, _ = analyze(
        "funcion entero crear() { mesa item {} retornar 1>> } "
        "funcion vacio consumir(entero x) {} "
        "funcion vacio envolver() { consumir(crear())>> } "
        "habitacion sala(5, 4, 3) { envolver()>> }"
    )

    assert "SPA_DUPLICATE_ELEMENT" not in codes(result)


def test_forward_transitive_error_keeps_original_effect_location():
    _, result, _ = analyze(
        "habitacion sala(5, 4, 3) { preparar()>> } "
        "funcion vacio operacion() {\n  mover ausente [0, 0, 0]>>\n}\n"
        "funcion vacio preparar() { operacion()>> }",
        file="ubicacion_enlace.lumi",
    )
    diagnostic = next(item for item in result.diagnostics
                      if item.code == "SPA_ELEMENT_NOT_FOUND")

    assert (diagnostic.file, diagnostic.line) == ("ubicacion_enlace.lumi", 2)
