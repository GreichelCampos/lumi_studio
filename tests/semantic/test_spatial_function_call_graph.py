"""Stable semantic resolution of dependencies between function summaries."""

from lumi_language.semantic_analyzer import SemanticAnalyzer
from lumi_language.spatial_function_effects import CallResolution


def node(kind, line=1, **values):
    return {"node": kind, "file": "grafo.lumi", "line": line, "column": 2, **values}


def function(name, body=None, line=1):
    return node("FunctionDeclarationNode", line, name=name, parameters=[],
                return_type="vacio", body=body or [])


def call(name, line=1):
    return node("FunctionCallNode", line, name=name, arguments=[])


def program(*statements):
    return node("ProgramNode", statements=list(statements))


def analyze(*statements):
    analyzer = SemanticAnalyzer()
    analyzer.analyze(program(*statements))
    summaries = list(analyzer._function_effect_summaries.values())
    return analyzer, summaries


def summary_named(summaries, name, *, line=None):
    return next(
        item for item in summaries
        if item.name == name and (line is None or item.location.line == line)
    )


def outgoing(analyzer, summary):
    return analyzer._function_call_graph.dependencies[summary.function_identity]


def test_forward_call_uses_predeclared_semantic_symbol_identity():
    analyzer, summaries = analyze(
        function("origen", [call("destino", 3)], 1),
        function("destino", line=8),
    )
    origin = summary_named(summaries, "origen")
    target = summary_named(summaries, "destino")
    dependency = outgoing(analyzer, origin)[0]

    assert dependency.resolution is CallResolution.RESOLVED
    assert dependency.target == target.function_identity


def test_lexically_nearest_function_wins_over_same_named_global():
    global_helper = function("ayuda", line=20)
    nested_helper = function("ayuda", line=4)
    outer = function("contenedora", [nested_helper, call("ayuda", 7)], line=2)
    analyzer, summaries = analyze(global_helper, outer)
    outer_summary = summary_named(summaries, "contenedora")
    nested_summary = summary_named(summaries, "ayuda", line=4)
    global_summary = summary_named(summaries, "ayuda", line=20)
    target = outgoing(analyzer, outer_summary)[0].target

    assert target == nested_summary.function_identity
    assert target != global_summary.function_identity


def test_same_name_in_sibling_scopes_does_not_cross_link():
    first_helper = function("local", line=4)
    second_helper = function("local", line=14)
    first = function("primera", [first_helper, call("local", 6)], line=2)
    second = function("segunda", [second_helper, call("local", 16)], line=12)
    analyzer, summaries = analyze(first, second)

    first_target = outgoing(analyzer, summary_named(summaries, "primera"))[0].target
    second_target = outgoing(analyzer, summary_named(summaries, "segunda"))[0].target

    assert first_target == summary_named(summaries, "local", line=4).function_identity
    assert second_target == summary_named(summaries, "local", line=14).function_identity
    assert first_target != second_target


def test_undeclared_call_remains_an_explicit_unresolved_dependency():
    analyzer, summaries = analyze(function("origen", [call("ausente", 5)]))
    dependency = outgoing(analyzer, summary_named(summaries, "origen"))[0]

    assert dependency.resolution is CallResolution.UNDECLARED
    assert dependency.target is None


def test_non_callable_symbol_is_not_associated_with_a_function():
    variable = node("VariableDeclarationNode", 3, type="entero", name="dato",
                    value=node("LiteralNode", value=1, literal_kind="integer"))
    analyzer, summaries = analyze(function("origen", [variable, call("dato", 4)]))
    dependency = outgoing(analyzer, summary_named(summaries, "origen"))[0]

    assert dependency.resolution is CallResolution.NOT_CALLABLE
    assert dependency.target is None


def test_self_call_is_represented_as_graph_edge_without_effect_application():
    analyzer, summaries = analyze(function("recursiva", [call("recursiva", 3)]))
    summary = summary_named(summaries, "recursiva")
    dependency = outgoing(analyzer, summary)[0]

    assert dependency.target == summary.function_identity
    assert analyzer.spatial_analyzer._abstract_state.rooms == {}


def test_dependency_order_matches_source_call_order():
    origin = function("origen", [call("b", 4), call("a", 5), call("b", 6)])
    analyzer, summaries = analyze(origin, function("a", line=10), function("b", line=12))
    dependencies = outgoing(analyzer, summary_named(summaries, "origen"))

    assert [item.target.name for item in dependencies] == ["b", "a", "b"]
    assert [item.location.line for item in dependencies] == [4, 5, 6]


def test_resolved_target_is_attached_to_the_pending_effect_too():
    analyzer, summaries = analyze(
        function("origen", [call("destino", 4)]), function("destino", line=7),
    )
    origin = summary_named(summaries, "origen")
    pending = origin.effects.effects[0]

    assert pending.call_resolution is CallResolution.RESOLVED
    assert pending.target_function == summary_named(
        summaries, "destino",
    ).function_identity


def test_graph_is_reset_between_analyses_on_the_same_analyzer():
    analyzer = SemanticAnalyzer()
    analyzer.analyze(program(function("primera", [call("primera")])))
    analyzer.analyze(program(function("segunda")))

    identities = tuple(analyzer._function_call_graph.dependencies)
    assert [identity.name for identity in identities] == ["segunda"]
    assert analyzer._function_call_graph.dependencies[identities[0]] == ()


def test_imported_call_keeps_the_identity_resolved_by_semantic_import():
    imported = program(function("destino", line=30))
    import_node = node("ImportNode", file_name="biblioteca.lumi", symbol_name="destino")
    origin = function("origen", [call("destino", 6)], line=4)
    analyzer = SemanticAnalyzer()
    analyzer.analyze(
        program(import_node, origin), {"biblioteca.lumi": imported},
    )
    summaries = list(analyzer._function_effect_summaries.values())
    dependency = outgoing(analyzer, summary_named(summaries, "origen"))[0]

    assert dependency.resolution is CallResolution.RESOLVED
    assert dependency.target.name == "destino"
    assert dependency.target.is_imported
    assert dependency.target.source_file == "biblioteca.lumi"
