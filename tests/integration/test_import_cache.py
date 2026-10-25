"""Count real resolution, tokenization and parsing, including cache hits."""

from collections import Counter

import pytest

from lumi_language.ast_adapter import normalize_ast
from lumi_language.import_context import ModuleRecord, ModuleState, _ImportResolutionContext
from lumi_language.import_resolver import InMemoryImportResolver
from lumi_language.interpreter import Interpreter
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser, ParserError
from lumi_language.semantic_analyzer import SemanticAnalyzer
from services.compiler_service import CompilerService
from services.protocol.adapters import adapt_result
from services.protocol.models import Request
from services.serialization import serialize_compilation


FUNCTION = "funcion entero f() { retornar 1>> }"


def imp(file, symbol="f"):
    return f'importar "{file}" usar {symbol}>>'


@pytest.fixture
def processing_counts(monkeypatch):
    counts = {stage: Counter() for stage in ("resolve", "lex", "parse")}
    resolve = InMemoryImportResolver.resolve
    tokenize = Lexer.tokenize
    parse = Parser._parse_program

    def counted_resolve(self, file):
        counts["resolve"][file] += 1
        return resolve(self, file)

    def counted_tokenize(self):
        counts["lex"][self.file] += 1
        return tokenize(self)

    def counted_parse(self):
        counts["parse"][self.file] += 1
        return parse(self)

    monkeypatch.setattr(InMemoryImportResolver, "resolve", counted_resolve)
    monkeypatch.setattr(Lexer, "tokenize", counted_tokenize)
    monkeypatch.setattr(Parser, "_parse_program", counted_parse)
    return counts


@pytest.mark.parametrize("source,sources,edges", [
    (imp("B"), {"B": FUNCTION}, [("A", "B")]),
    (imp("B") + imp("B"), {"B": imp("C"), "C": FUNCTION},
     [("A", "B"), ("B", "C"), ("A", "B")]),
    (imp("B"), {"B": imp("C"), "C": FUNCTION}, [("A", "B"), ("B", "C")]),
    (imp("B") + imp("D"), {"B": imp("C"), "D": imp("C"), "C": FUNCTION},
     [("A", "B"), ("B", "C"), ("A", "D"), ("D", "C")]),
])
def test_each_successful_module_is_processed_once(processing_counts, source, sources, edges):
    parser = Parser(Lexer(source, "A").tokenize(), InMemoryImportResolver(sources))
    parser.parse()
    context = parser._import_context
    assert [(e.importer, e.dependency) for e in context.relations] == edges
    assert [e.order for e in context.relations] == list(range(len(edges)))
    assert set(context.reachable_dependencies("A")) == set(sources)
    assert set(context.successful_programs) == {"A", *sources}
    assert processing_counts["resolve"] == Counter({file: 1 for file in sources})
    for stage in ("lex", "parse"):
        assert processing_counts[stage] == Counter({file: 1 for file in ("A", *sources)})
    assert parser.diagnostics == []
    assert context.complete


def test_cache_hit_preserves_import_locations_symbols_and_ast_identity(processing_counts):
    parser = Parser(Lexer(imp("B", "f") + "\n  " + imp("B", "g"), "A").tokenize(),
                    InMemoryImportResolver({"B": FUNCTION}))
    parser.parse()
    context = parser._import_context
    assert [(e.file, e.line, e.column, e.symbol) for e in context.relations] == [
        ("A", 1, 1, "f"), ("A", 2, 3, "g"),
    ]
    assert parser.imported_programs["B"] is context.modules["B"].program
    assert processing_counts["lex"]["B"] == processing_counts["parse"]["B"] == 1


@pytest.mark.parametrize("size", [1, 2, 3, 4])
def test_cycles_are_checked_before_cache_lookup(monkeypatch, processing_counts, size):
    lookup = _ImportResolutionContext.reusable_program

    def checked_lookup(self, file):
        assert file not in self.active_files, "cycle must be checked before cache"
        return lookup(self, file)

    monkeypatch.setattr(_ImportResolutionContext, "reusable_program", checked_lookup)
    names = ["A", "B", "C", "D"][:size]
    sources = {name: imp(names[(i + 1) % size]) for i, name in enumerate(names)}
    parser = Parser(Lexer(imp("good") + imp("good") + "\n  " + sources["A"], "A").tokenize(),
                    InMemoryImportResolver({**sources, "good": FUNCTION}))
    with pytest.raises(ParserError) as caught:
        parser.parse()
    context = parser._import_context
    diagnostic = caught.value.diagnostic
    assert diagnostic.code == "IMPORT_CIRCULAR_DEPENDENCY"
    assert " \u2192 ".join(names + ["A"]) in diagnostic.description
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        names[-1], 2 if size == 1 else 1, 3 if size == 1 else 1,
    )
    assert context.active_files == []
    assert context.modules["good"].state is ModuleState.SUCCEEDED
    assert processing_counts["parse"]["good"] == 1


def test_failed_module_is_reparsed_and_diagnostics_are_not_deduplicated_by_text(processing_counts):
    parser = Parser(Lexer(imp("bad") + "\n" + imp("bad"), "A").tokenize(),
                    InMemoryImportResolver({"bad": "entero x = >>"}))
    parser.parse_with_recovery()
    assert processing_counts["resolve"]["bad"] == 2
    assert processing_counts["lex"]["bad"] == processing_counts["parse"]["bad"] == 2
    first, second = parser.diagnostics
    assert first.description == second.description
    assert first is not second
    assert (first.file, first.line, first.column) == (second.file, second.line, second.column)
    assert parser._own_diagnostics == []
    context = parser._import_context
    assert context.modules["bad"].state is ModuleState.FAILED
    assert len(context.modules["bad"].diagnostics) == 1
    assert context.modules["A"].state is ModuleState.PARTIAL
    assert context.successful_programs == {}


def test_missing_import_errors_remain_specific_to_each_instruction(processing_counts):
    parser = Parser(Lexer(imp("missing") + "\n  " + imp("missing"), "A").tokenize(),
                    InMemoryImportResolver({}))
    parser.parse_with_recovery()
    assert [(d.code, d.file, d.line, d.column) for d in parser.diagnostics] == [
        ("IMPORT_FILE_NOT_FOUND", "A", 1, 1), ("IMPORT_FILE_NOT_FOUND", "A", 2, 3),
    ]
    assert processing_counts["resolve"]["missing"] == 2
    assert len(parser._own_diagnostics) == 2


@pytest.mark.parametrize("state", [ModuleState.FAILED, ModuleState.PARTIAL])
def test_invalid_record_cannot_supply_a_cached_ast(processing_counts, state):
    context = _ImportResolutionContext()
    context.modules["B"] = ModuleRecord("B", state, parsing_completed=state is ModuleState.PARTIAL)
    parser = Parser(Lexer(imp("B"), "A").tokenize(), InMemoryImportResolver({"B": FUNCTION}),
                    _import_context=context)
    parser.parse()
    assert processing_counts["lex"]["B"] == processing_counts["parse"]["B"] == 1
    assert context.modules["B"].state is ModuleState.SUCCEEDED


def test_source_snapshot_and_cache_are_isolated_between_compilations(monkeypatch, processing_counts):
    service = CompilerService()
    sources = {"B": FUNCTION}
    tokenize = Lexer.tokenize

    def change_external_sources(self):
        if self.file == "A":
            sources["B"] = FUNCTION.replace("retornar 1", "retornar 2")
        return tokenize(self)

    monkeypatch.setattr(Lexer, "tokenize", change_external_sources)
    source = imp("B") + " mostrar(f())>>"
    first, first_context = service._compile_with_dependencies(source, "A", sources=sources)
    second, second_context = service._compile_with_dependencies(source, "A", sources=sources)
    assert Interpreter().execute(first.program, dict(first.imported_programs)).output == ["1"]
    assert Interpreter().execute(second.program, dict(second.imported_programs)).output == ["2"]
    assert first_context is not second_context
    assert first.imported_programs["B"] is not second.imported_programs["B"]
    assert processing_counts["lex"]["B"] == processing_counts["parse"]["B"] == 2


def test_reused_ast_is_unchanged_by_existing_consumers(processing_counts):
    source = imp("B", "f") + imp("B", "g") + " mostrar(f() + g())>>"
    sources = {"B": FUNCTION + " funcion entero g() { retornar 2>> }"}
    parser = Parser(Lexer(source, "A").tokenize(), InMemoryImportResolver(sources))
    program = parser.parse()
    imported = parser.imported_programs
    before = normalize_ast(imported["B"])
    for _ in range(2):
        assert SemanticAnalyzer().analyze(program, imported).succeeded
        runtime = Interpreter().execute(program, imported)
        assert runtime.succeeded and runtime.output == ["3"]
        assert normalize_ast(imported["B"]) == before
    result = CompilerService().compile(source, "A", sources=sources)
    assert result.succeeded
    snapshot = serialize_compilation(result)
    assert snapshot["imported_programs"]["B"] == before
    wire = adapt_result(Request("cache", "analyze", "A", {"A": source, **sources}), result)
    assert wire["protocolVersion"] == "1.0.0"
    assert set(wire["result"]) == {
        "entryFile", "analysisStatus", "stage", "output", "diagnostics",
        "limitations", "executionAttempted", "capabilities",
    }
    assert wire["result"]["diagnostics"] == []
    assert normalize_ast(imported["B"]) == before
    assert normalize_ast(result.imported_programs["B"]) == before
