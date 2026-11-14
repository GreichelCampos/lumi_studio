"""Spatial-effect propagation through Lumi's real in-memory import graph."""

from lumi_language.import_context import _ImportResolutionContext
from lumi_language.import_resolver import InMemoryImportResolver
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser
from lumi_language.semantic_analyzer import SemanticAnalyzer
from lumi_language.spatial_abstract_state import (
    AbstractElementState,
    AbstractPresence,
)
from services.compiler_service import CompilerService
from services.results import CompilationStatus


def analyze(entry: str, sources: dict[str, str], file: str = "A"):
    context = _ImportResolutionContext()
    parser = Parser(
        Lexer(entry, file).tokenize(),
        import_resolver=InMemoryImportResolver(sources),
        file=file,
        _import_context=context,
    )
    program = parser.parse()
    analyzer = SemanticAnalyzer()
    result = analyzer.analyze(program, context.successful_programs)
    return analyzer, result, context


def codes(result):
    return [item.code for item in result.diagnostics]


def test_direct_imported_spatial_function_applies_only_when_called():
    source = 'importar "B" usar preparar>> habitacion sala(5, 4, 3) { preparar()>> }'
    analyzer, result, _ = analyze(source, {
        "B": "funcion vacio preparar() { mesa item {} }",
    })

    assert result.succeeded
    assert analyzer.spatial_analyzer._abstract_state.states_for(
        "sala", "item",
    ) == frozenset({AbstractElementState.DECLARED_UNPLACED})


def test_imported_function_not_called_has_no_effect():
    analyzer, result, _ = analyze(
        'importar "B" usar preparar>> habitacion sala(5, 4, 3) { }',
        {"B": "funcion vacio preparar() { mesa fantasma {} }"},
    )

    assert result.succeeded
    assert analyzer.spatial_analyzer._abstract_state.room_elements("sala") == {}


def test_imported_parameterized_function_uses_caller_state():
    analyzer, result, _ = analyze(
        'importar "B" usar colocar_en>> habitacion sala(5, 4, 3) { '
        "mesa item {} colocar_en(2.5)>> }",
        {"B": "funcion vacio colocar_en(decimal x) { colocar item [x, 0, 0]>> }"},
    )

    assert result.succeeded
    assert analyzer.spatial_analyzer._abstract_state.states_for(
        "sala", "item",
    ) == frozenset({AbstractElementState.DECLARED_PLACED})


def test_imported_function_can_declare_a_room():
    analyzer, result, _ = analyze(
        'importar "B" usar crear>> crear()>>',
        {"B": "funcion vacio crear() { habitacion importada(5, 4, 3) {} }"},
    )

    assert result.succeeded
    assert analyzer.spatial_analyzer._abstract_state.room_states(
        "importada"
    ) == frozenset({AbstractPresence.PRESENT})


def test_imported_precondition_failure_uses_operation_source_location():
    _, result, _ = analyze(
        'importar "B" usar colocar_item>> colocar_item()>>',
        {"B": "funcion vacio colocar_item() {\n  colocar item [0, 0, 0]>>\n}"},
    )
    diagnostic = next(item for item in result.diagnostics
                      if item.code == "SPA_OPERATION_OUTSIDE_ROOM")

    assert (diagnostic.file, diagnostic.line) == ("B", 2)


def test_imported_conditions_and_cycles_keep_route_certainty():
    analyzer, result, _ = analyze(
        'importar "B" usar preparar>> booleano opcion = verdadero>> '
        "habitacion sala(5, 4, 3) { preparar(opcion)>> }",
        {
            "B": (
                "funcion vacio preparar(booleano opcion) { "
                "si opcion { repetir 1 { mesa item {} } } }"
            ),
        },
    )

    assert result.succeeded
    assert analyzer.spatial_analyzer._abstract_state.states_for(
        "sala", "item",
    ) == frozenset({
        AbstractElementState.ABSENT,
        AbstractElementState.DECLARED_UNPLACED,
    })


def test_imported_function_calls_explicitly_imported_dependency():
    analyzer, result, context = analyze(
        'importar "B" usar preparar>> habitacion sala(5, 4, 3) { preparar()>> }',
        {
            "B": (
                'funcion vacio preparar() { importar "C" usar base>> base()>> }'
            ),
            "C": "funcion vacio base() { mesa item {} }",
        },
    )

    assert result.succeeded
    assert set(context.successful_programs) == {"A", "B", "C"}
    assert "item" in analyzer.spatial_analyzer._abstract_state.room_elements("sala")


def test_transitive_effects_cross_three_imported_files():
    analyzer, result, _ = analyze(
        'importar "B" usar b>> habitacion sala(5, 4, 3) { b()>> }',
        {
            "B": 'funcion vacio b() { importar "C" usar c>> c()>> }',
            "C": 'funcion vacio c() { importar "D" usar d>> d()>> }',
            "D": "funcion vacio d() { mesa profundo {} }",
        },
    )

    assert result.succeeded
    assert "profundo" in analyzer.spatial_analyzer._abstract_state.room_elements(
        "sala"
    )


def test_shared_cached_module_has_one_stable_function_identity():
    analyzer, result, context = analyze(
        "funcion vacio uno() { importar \"C\" usar base>> base()>> } "
        "funcion vacio dos() { importar \"C\" usar base>> base()>> } "
        "habitacion sala(5, 4, 3) { uno()>> dos()>> }",
        {"C": "funcion vacio base() { mesa item {} }"},
    )
    imported = [
        summary.function_identity
        for summary in analyzer._function_effect_summaries.values()
        if summary.function_identity.source_file == "C"
    ]

    assert context.modules["C"].program is not None
    assert len(set(imported)) == 1
    assert codes(result).count("SPA_DUPLICATE_ELEMENT") == 1


def test_homonymous_imported_functions_remain_module_distinct():
    analyzer, result, _ = analyze(
        "funcion vacio usar_b() { importar \"B\" usar preparar>> preparar()>> } "
        "funcion vacio usar_c() { importar \"C\" usar preparar>> preparar()>> } "
        "habitacion sala(5, 4, 3) { usar_b()>> usar_c()>> }",
        {
            "B": "funcion vacio preparar() { mesa desde_b {} }",
            "C": "funcion vacio preparar() { mesa desde_c {} }",
        },
    )
    room = analyzer.spatial_analyzer._abstract_state.room_elements("sala")

    assert result.succeeded
    assert {"desde_b", "desde_c"}.issubset(room)


def test_non_imported_function_remains_invisible():
    _, result, _ = analyze(
        'importar "B" usar visible>> oculta()>>',
        {
            "B": (
                "funcion vacio visible() {} "
                "funcion vacio oculta() { habitacion indebida(1, 1, 1) {} }"
            ),
        },
    )

    assert "SEM_UNDECLARED_FUNCTION" in codes(result)


def test_recursive_imported_function_uses_recursive_fixed_point():
    analyzer, result, _ = analyze(
        'importar "B" usar ciclo>> habitacion sala(5, 4, 3) { ciclo()>> }',
        {"B": "funcion vacio ciclo() { mesa item {} ciclo()>> }"},
    )

    assert "SPA_DUPLICATE_ELEMENT" in codes(result)
    assert analyzer.spatial_analyzer._abstract_state.unknown_rooms == {"sala"}


def test_imported_module_top_level_spatial_code_is_not_applied():
    analyzer, result, _ = analyze(
        'importar "B" usar vacia>> vacia()>>',
        {
            "B": (
                "habitacion no_ejecutada(5, 4, 3) {} "
                "funcion vacio vacia() {}"
            ),
        },
    )

    assert result.succeeded
    assert analyzer.spatial_analyzer._abstract_state.room_presence == {}


def test_compiler_keeps_spatial_capability_limitation_for_imported_source():
    result = CompilerService().compile_project(
        {
            "A": 'importar "B" usar preparar>> habitacion sala(5, 4, 3) { preparar()>> }',
            "B": "funcion vacio preparar() { mesa item {} }",
        },
        entry_file="A",
    )

    assert result.status is CompilationStatus.INCOMPLETE
    assert result.diagnostics == ()
