"""Lexical isolation between imported modules and their callers."""

from lumi_language.import_context import _ImportResolutionContext
from lumi_language.import_resolver import InMemoryImportResolver
from lumi_language.interpreter import Interpreter
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser
from lumi_language.semantic_analyzer import SemanticAnalyzer


def analyze_and_execute(entry: str, sources: dict[str, str]):
    context = _ImportResolutionContext()
    parser = Parser(
        Lexer(entry, "A").tokenize(),
        import_resolver=InMemoryImportResolver(sources),
        file="A",
        _import_context=context,
    )
    program = parser.parse()
    catalog = context.successful_programs
    semantic = SemanticAnalyzer().analyze(program, catalog)
    runtime = Interpreter().execute(program, catalog)
    return semantic, runtime


def test_imported_function_cannot_capture_variable_from_caller():
    semantic, runtime = analyze_and_execute(
        'entero secreto = 99>> importar "B" usar revelar>> mostrar(revelar())>>',
        {"B": "funcion entero revelar() { retornar secreto>> }"},
    )

    assert [item.code for item in semantic.diagnostics] == [
        "SEM_UNDECLARED_VARIABLE",
    ]
    assert [item.code for item in runtime.diagnostics] == [
        "RUN_UNDEFINED_VARIABLE",
    ]


def test_imported_function_resolves_variable_from_its_own_module():
    semantic, runtime = analyze_and_execute(
        'importar "B" usar obtener>> mostrar(obtener())>>',
        {"B": "entero base = 7>> funcion entero obtener() { retornar base>> }"},
    )

    assert semantic.succeeded
    assert runtime.succeeded
    assert runtime.output == ["7"]


def test_homonymous_module_variable_wins_over_caller_variable():
    semantic, runtime = analyze_and_execute(
        'entero base = 99>> importar "B" usar obtener>> mostrar(obtener())>>',
        {"B": "entero base = 7>> funcion entero obtener() { retornar base>> }"},
    )

    assert semantic.succeeded
    assert runtime.succeeded
    assert runtime.output == ["7"]


def test_imported_function_uses_its_modules_explicit_import():
    semantic, runtime = analyze_and_execute(
        'importar "B" usar publica>> mostrar(publica())>>',
        {
            "B": (
                'importar "C" usar auxiliar>> '
                "funcion entero publica() { retornar auxiliar()>> }"
            ),
            "C": "funcion entero auxiliar() { retornar 12>> }",
        },
    )

    assert semantic.succeeded
    assert runtime.succeeded
    assert runtime.output == ["12"]


def test_imported_function_resolves_function_from_its_own_module():
    semantic, runtime = analyze_and_execute(
        'importar "B" usar publica>> mostrar(publica())>>',
        {
            "B": (
                "funcion entero auxiliar() { retornar 5>> } "
                "funcion entero publica() { retornar auxiliar() + 1>> }"
            ),
        },
    )

    assert semantic.succeeded
    assert runtime.succeeded
    assert runtime.output == ["6"]
