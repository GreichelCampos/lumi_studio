import pytest

from lumi_language.diagnostics import DiagnosticCategory
from lumi_language.import_resolver import InMemoryImportResolver
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser, ParserError


FUNCTION = "funcion entero f() { retornar 1>> }"


def make_parser(source, sources, file="principal.lumi", resolver=None):
    return Parser(
        Lexer(source, file).tokenize(),
        import_resolver=(
            resolver if resolver is not None else InMemoryImportResolver(sources)
        ),
    )


@pytest.mark.parametrize(
    "file, source, sources, cycle",
    [
        ("a.lumi", 'importar "a.lumi" usar f>>', {}, "a.lumi → a.lumi"),
        (
            "principal.lumi", 'importar "a.lumi" usar f>>',
            {"a.lumi": 'importar "a.lumi" usar f>>'},
            "a.lumi → a.lumi",
        ),
        (
            "a.lumi", 'importar "b.lumi" usar f>>',
            {"b.lumi": 'importar "a.lumi" usar f>>'},
            "a.lumi → b.lumi → a.lumi",
        ),
        (
            "a.lumi", 'importar "b.lumi" usar f>>',
            {"b.lumi": 'importar "c.lumi" usar f>>',
             "c.lumi": 'importar "a.lumi" usar f>>'},
            "a.lumi → b.lumi → c.lumi → a.lumi",
        ),
        (
            "principal.lumi", 'importar "a.lumi" usar f>>',
            {"a.lumi": 'importar "b.lumi" usar f>>',
             "b.lumi": 'importar "c.lumi" usar f>>',
             "c.lumi": 'importar "b.lumi" usar f>>'},
            "b.lumi → c.lumi → b.lumi",
        ),
        (
            "a.lumi", 'importar "b.lumi" usar f>>',
            {"b.lumi": 'importar "c.lumi" usar f>>',
             "c.lumi": 'importar "d.lumi" usar f>>',
             "d.lumi": 'importar "a.lumi" usar f>>'},
            "a.lumi → b.lumi → c.lumi → d.lumi → a.lumi",
        ),
    ],
)
def test_cycles_raise_one_controlled_diagnostic(file, source, sources, cycle):
    parser = make_parser(source, sources, file)
    with pytest.raises(ParserError) as caught:
        parser.parse()
    assert len(parser.diagnostics) == 1
    diagnostic = parser.diagnostics[0]
    assert caught.value.diagnostic is diagnostic
    assert diagnostic.category is DiagnosticCategory.IMPORT
    assert diagnostic.code == "IMPORT_CIRCULAR_DEPENDENCY"
    assert cycle in diagnostic.description
    assert diagnostic.suggestion
    assert parser.imported_programs == {}
    assert parser._import_context.active_files == []


def test_cycle_location_is_the_import_that_closes_it():
    parser = make_parser(
        'importar "a.lumi" usar f>>',
        {"a.lumi": 'importar "b.lumi" usar f>>',
         "b.lumi": '\n\n    importar "a.lumi" usar f>>'},
    )
    with pytest.raises(ParserError):
        parser.parse()
    diagnostic = parser.diagnostics[0]
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "b.lumi", 3, 5,
    )


def test_valid_chain_keeps_only_direct_import_context():
    parser = make_parser(
        'importar "a.lumi" usar f>>',
        {"a.lumi": 'importar "b.lumi" usar f>> ' + FUNCTION,
         "b.lumi": 'importar "c.lumi" usar f>> ' + FUNCTION,
         "c.lumi": FUNCTION},
    )
    parser.parse()
    assert parser.diagnostics == []
    assert list(parser.imported_programs) == ["a.lumi"]
    assert parser._import_context.active_files == []


def test_shared_dependency_is_not_a_cycle():
    parser = make_parser(
        'importar "a.lumi" usar f>> importar "b.lumi" usar f>>',
        {"a.lumi": 'importar "common.lumi" usar f>> ' + FUNCTION,
         "b.lumi": 'importar "common.lumi" usar f>> ' + FUNCTION,
         "common.lumi": FUNCTION},
    )
    parser.parse()
    assert parser.diagnostics == []
    assert list(parser.imported_programs) == ["a.lumi", "b.lumi"]


def test_repeated_imports_remain_valid_for_parser():
    parser = make_parser(
        'importar "a.lumi" usar f>> importar "a.lumi" usar f>>',
        {"a.lumi": FUNCTION},
    )
    program = parser.parse()
    assert len(program.statements) == 2
    assert parser.diagnostics == []


@pytest.mark.parametrize(
    "bad_source, code",
    [
        ('importar "bad.lumi" usar f>>', "IMPORT_CIRCULAR_DEPENDENCY"),
        ('importar "missing.lumi" usar f>>', "IMPORT_FILE_NOT_FOUND"),
        ("entero x = >>", "SYN_UNEXPECTED_TOKEN"),
    ],
)
def test_recovery_cleans_context_and_processes_next_valid_import(bad_source, code):
    parser = make_parser(
        'importar "bad.lumi" usar f>> importar "good.lumi" usar f>>',
        {"bad.lumi": bad_source, "good.lumi": FUNCTION},
    )
    program = parser.parse_with_recovery()
    assert [d.code for d in parser.diagnostics] == [code]
    assert list(parser.imported_programs) == ["good.lumi"]
    assert len(program.statements) == 1
    assert parser._import_context.active_files == []


def test_independent_parsers_can_reuse_resolver_after_cycle():
    resolver = InMemoryImportResolver({"a.lumi": 'importar "a.lumi" usar f>>'})
    first = make_parser('importar "a.lumi" usar f>>', {}, resolver=resolver)
    with pytest.raises(ParserError):
        first.parse()
    resolver.sources["a.lumi"] = FUNCTION
    second = make_parser('importar "a.lumi" usar f>>', {}, resolver=resolver)
    second.parse()
    assert second.diagnostics == []
    assert first._import_context is not second._import_context


def test_empty_program_has_no_active_file():
    parser = Parser([])
    assert parser.parse().statements == []
    assert parser._import_context.active_files == []


def test_parser_without_resolver_preserves_import_ast():
    parser = Parser(Lexer('importar "principal.lumi" usar f>>',
                          "principal.lumi").tokenize())
    assert parser.parse().statements[0].file_name == "principal.lumi"
    assert parser.diagnostics == []
