from collections import Counter

import pytest

from lumi_language.import_context import ModuleState
from lumi_language.import_resolver import InMemoryImportResolver
from lumi_language.lexer import Lexer
from lumi_language.lexer_error import LexerError
from lumi_language.parser import Parser, ParserError


FUNCTION = "funcion entero f() { retornar 1>> }"


def import_source(file, symbol="f"):
    return f'importar "{file}" usar {symbol}>>'


def make_parser(source, sources):
    return Parser(Lexer(source, "A").tokenize(), InMemoryImportResolver(sources))


def test_direct_import_preserves_exact_identity_location_symbol_and_ast():
    parser = make_parser('\n  ' + import_source("./B", "other"), {"./B": FUNCTION})
    program = parser.parse()
    context = parser._import_context
    edge, = context.relations
    assert (edge.importer, edge.dependency, edge.file, edge.line, edge.column,
            edge.symbol, edge.order) == ("A", "./B", "A", 2, 3, "other", 0)
    assert context.direct_dependencies("A") == ("./B",)
    assert context.reachable_dependencies("A") == ("./B",)
    assert context.successful_programs["A"] is program
    assert context.successful_programs["./B"] is parser.imported_programs["./B"]
    assert context.complete


def test_chain_retains_transitive_ast_but_direct_import_contract_is_unchanged():
    parser = make_parser(import_source("B"), {"B": import_source("C"), "C": FUNCTION})
    parser.parse()
    context = parser._import_context
    assert [(e.importer, e.dependency) for e in context.relations] == [("A", "B"), ("B", "C")]
    assert context.reachable_dependencies("A") == ("B", "C")
    assert set(context.successful_programs) == {"A", "B", "C"}
    assert list(parser.imported_programs) == ["B"]
    assert context.modules["C"].program.file == "C"
    assert context.complete


@pytest.mark.parametrize("diamond", [False, True])
def test_repeated_imports_record_order_with_successful_module_reuse(diamond):
    class CountingResolver(InMemoryImportResolver):
        def resolve(self, file):
            counts[file] += 1
            return super().resolve(file)

    counts = Counter()
    second = "D" if diamond else "B"
    parser = Parser(
        Lexer(import_source("B") + " " + import_source(second), "A").tokenize(),
        CountingResolver({"B": import_source("C"), "D": import_source("C"), "C": FUNCTION}),
    )
    parser.parse()
    context = parser._import_context
    expected = [("A", "B", 0), ("B", "C", 1), ("A", second, 2)]
    if diamond:
        expected.append((second, "C", 3))
    assert [(e.importer, e.dependency, e.order) for e in context.relations] == expected
    assert counts["C"] == 1
    assert sum(counts.values()) == (3 if diamond else 2)
    assert context.direct_dependencies("A") == (("B", "D") if diamond else ("B",))
    assert set(context.successful_programs) == ({"A", "B", "C", "D"} if diamond else {"A", "B", "C"})
    assert context.complete


@pytest.mark.parametrize("size", [1, 2, 3, 4])
def test_cycle_keeps_closing_edge_and_failed_module_records(size):
    names = ["A", "B", "C", "D"][:size]
    sources = {name: import_source(names[(i + 1) % size]) for i, name in enumerate(names)}
    parser = make_parser(sources["A"], sources)
    with pytest.raises(ParserError):
        parser.parse()
    context = parser._import_context
    assert [(e.importer, e.dependency) for e in context.relations] == list(zip(names, names[1:] + ["A"]))
    assert set(context.reachable_dependencies("A")) == set(names[1:])
    assert context.successful_programs == {}
    assert all(r.state is ModuleState.FAILED and not r.parsing_completed for r in context.modules.values())
    assert [d.code for d in context.modules[names[-1]].diagnostics] == ["IMPORT_CIRCULAR_DEPENDENCY"]
    assert sum(len(r.diagnostics) for r in context.modules.values()) == 1
    assert context.active_files == []
    assert not context.complete


@pytest.mark.parametrize("broken, exception, kind", [
    (None, ParserError, "FileNotFoundError"),
    ("entero x = >>", ParserError, "ParserError"),
    ("@", LexerError, "LexerError"),
])
def test_partial_graph_retains_completed_modules_and_own_diagnostics(broken, exception, kind):
    sources = {"good": FUNCTION, "B": import_source("bad")}
    if broken is not None:
        sources["bad"] = broken
    parser = make_parser(import_source("good") + import_source("B") + import_source("unseen"), sources)
    with pytest.raises(exception):
        parser.parse()
    context = parser._import_context
    assert set(context.modules) == {"A", "good", "B", "bad"}
    assert list(context.successful_programs) == ["good"]
    assert context.modules["bad"].failure_kind == kind
    assert context.modules["bad"].program is None
    assert context.modules["A"].diagnostics == ()
    owner = "B" if broken is None else "bad"
    assert len(context.modules[owner].diagnostics) == (0 if exception is LexerError else 1)
    assert context.active_files == []
    assert not context.complete


def test_recovery_never_publishes_partial_ast_as_valid_module():
    parser = make_parser(import_source("bad") + import_source("good"),
                         {"bad": "entero x = >>", "good": ""})
    program = parser.parse_with_recovery()
    context = parser._import_context
    assert len(program.statements) == 1
    assert context.modules["A"].state is ModuleState.PARTIAL
    assert context.modules["A"].parsing_completed
    assert context.modules["A"].program is None
    assert context.modules["A"].diagnostics == ()
    assert context.modules["bad"].state is ModuleState.FAILED
    assert list(context.successful_programs) == ["good"]
    assert not context.complete


def test_without_resolver_records_unprocessed_dependency():
    parser = Parser(Lexer(import_source("B"), "A").tokenize())
    parser.parse()
    context = parser._import_context
    assert context.direct_dependencies("A") == ("B",)
    assert context.modules["B"].state is ModuleState.DISCOVERED
    assert not context.complete


def test_unexpected_dependency_failure_propagates_and_marks_registry():
    class BrokenResolver:
        def resolve(self, file):
            raise RuntimeError("unexpected")

    parser = Parser(Lexer(import_source("B"), "A").tokenize(), BrokenResolver())
    with pytest.raises(RuntimeError, match="unexpected"):
        parser.parse()
    context = parser._import_context
    assert context.modules["B"].failure_kind == "RuntimeError"
    assert context.modules["A"].state is ModuleState.FAILED
    assert context.active_files == []
