from lumi_language.diagnostics import DiagnosticCategory
from lumi_language.import_resolver import InMemoryImportResolver
from lumi_language.interpreter import Interpreter
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser
from lumi_language.semantic_analyzer import SemanticAnalyzer


def parse_source(source: str, file: str = "principal.lumi", resolver=None):
    tokens = Lexer(source, file).tokenize()
    parser = Parser(tokens, import_resolver=resolver)
    return parser, parser.parse()


def execute_with_imports(source: str, imported_sources: dict[str, str]):
    resolver = InMemoryImportResolver(imported_sources)
    parser, program = parse_source(source, resolver=resolver)
    result = Interpreter().execute(program, parser.imported_programs)
    return parser, program, result


def test_executes_imported_function_without_arguments():
    _, _, result = execute_with_imports(
        """
importar "utilidades.lumi" usar respuesta>>
mostrar(respuesta())>>
""",
        {
            "utilidades.lumi": (
                "funcion entero respuesta() { retornar 42>> }"
            )
        },
    )

    assert result.succeeded
    assert result.output == ["42"]


def test_executes_imported_function_with_arguments_and_return_value():
    _, _, result = execute_with_imports(
        """
importar "utilidades.lumi" usar sumar>>
mostrar(sumar(4, 5))>>
""",
        {
            "utilidades.lumi": (
                "funcion entero sumar(entero a, entero b) { retornar a + b>> }"
            )
        },
    )

    assert result.succeeded
    assert result.output == ["9"]


def test_imported_result_can_initialize_variable():
    _, _, result = execute_with_imports(
        """
importar "utilidades.lumi" usar obtener>>
entero valor = obtener()>>
mostrar(valor)>>
""",
        {"utilidades.lumi": "funcion entero obtener() { retornar 7>> }"},
    )

    assert result.succeeded
    assert result.output == ["7"]


def test_imported_result_can_be_used_inside_expression():
    _, _, result = execute_with_imports(
        """
importar "utilidades.lumi" usar obtener>>
mostrar(obtener() + 3)>>
""",
        {"utilidades.lumi": "funcion entero obtener() { retornar 7>> }"},
    )

    assert result.succeeded
    assert result.output == ["10"]


def test_imported_void_function_can_be_called_as_statement():
    _, _, result = execute_with_imports(
        """
importar "utilidades.lumi" usar preparar>>
preparar()>>
""",
        {
            "utilidades.lumi": (
                'funcion vacio preparar() { mostrar("listo")>> }'
            )
        },
    )

    assert result.succeeded
    assert result.output == ["listo"]


def test_repeated_imported_calls_have_independent_scopes():
    _, _, result = execute_with_imports(
        """
importar "utilidades.lumi" usar copiar>>
mostrar(copiar(2))>>
mostrar(copiar(8))>>
""",
        {
            "utilidades.lumi": """
funcion entero copiar(entero valor) {
    entero temporal = valor>>
    retornar temporal>>
}
"""
        },
    )

    assert result.succeeded
    assert result.output == ["2", "8"]


def test_imported_function_local_variable_does_not_leak():
    _, _, result = execute_with_imports(
        """
importar "utilidades.lumi" usar preparar>>
preparar()>>
mostrar(interna)>>
""",
        {
            "utilidades.lumi": (
                "funcion vacio preparar() { entero interna = 3>> }"
            )
        },
    )

    assert not result.succeeded
    assert result.diagnostics[0].code == "RUN_UNDEFINED_VARIABLE"


def test_missing_imported_symbol_reports_runtime_diagnostic():
    _, _, result = execute_with_imports(
        'importar "utilidades.lumi" usar faltante>>',
        {"utilidades.lumi": "funcion entero existente() { retornar 1>> }"},
    )

    assert result.diagnostics[0].code == "RUN_IMPORT_SYMBOL_NOT_FOUND"


def test_import_without_context_reports_runtime_location():
    _, program = parse_source(
        'importar "utilidades.lumi" usar calcular>>',
        file="aplicacion.lumi",
    )

    result = Interpreter().execute(program)

    assert len(result.diagnostics) == 1
    diagnostic = result.diagnostics[0]
    assert diagnostic.category is DiagnosticCategory.RUNTIME
    assert diagnostic.code == "RUN_IMPORT_CONTEXT_UNAVAILABLE"
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "aplicacion.lumi",
        1,
        1,
    )
    assert diagnostic.description
    assert diagnostic.suggestion


def test_file_absent_from_import_context_reports_runtime_diagnostic():
    _, program = parse_source(
        'importar "faltante.lumi" usar calcular>>',
    )

    result = Interpreter().execute(program, {})

    assert result.diagnostics[0].code == "RUN_IMPORT_FILE_NOT_FOUND"


def test_imported_non_function_reports_runtime_diagnostic():
    _, _, result = execute_with_imports(
        'importar "datos.lumi" usar cantidad>>',
        {"datos.lumi": "entero cantidad = 4>>"},
    )

    assert result.diagnostics[0].code == "RUN_IMPORT_SYMBOL_NOT_FUNCTION"


def test_import_cannot_replace_local_function():
    _, _, result = execute_with_imports(
        """
importar "utilidades.lumi" usar obtener>>
funcion entero obtener() { retornar 1>> }
""",
        {"utilidades.lumi": "funcion entero obtener() { retornar 2>> }"},
    )

    assert result.diagnostics[0].code == "RUN_IMPORT_NAME_CONFLICT"


def test_import_registers_only_requested_function():
    _, _, result = execute_with_imports(
        """
importar "utilidades.lumi" usar publica>>
mostrar(privada())>>
""",
        {
            "utilidades.lumi": """
funcion entero publica() { retornar 1>> }
funcion entero privada() { retornar 2>> }
"""
        },
    )

    assert result.diagnostics[0].code == "RUN_UNDEFINED_FUNCTION"


def test_program_without_import_context_still_executes_normally():
    _, program = parse_source("mostrar(4 + 5)>>")

    result = Interpreter().execute(program)

    assert result.succeeded
    assert result.output == ["9"]


def test_full_semantic_and_runtime_pipeline_with_imported_function():
    resolver = InMemoryImportResolver(
        {
            "utilidades.lumi": (
                "funcion decimal area(decimal ancho, decimal largo) "
                "{ retornar ancho * largo>> }"
            )
        }
    )
    parser, program = parse_source(
        """
importar "utilidades.lumi" usar area>>
principal {
    mostrar(area(4, 5))>>
}
""",
        resolver=resolver,
    )

    semantic_result = SemanticAnalyzer().analyze(
        program,
        parser.imported_programs,
    )
    runtime_result = Interpreter().execute(
        program,
        parser.imported_programs,
    )

    assert semantic_result.succeeded
    assert runtime_result.succeeded
    assert runtime_result.output == ["20"]


def test_duplicate_runtime_import_reports_controlled_conflict():
    _, _, result = execute_with_imports(
        """
importar "utilidades.lumi" usar obtener>>
importar "utilidades.lumi" usar obtener>>
""",
        {"utilidades.lumi": "funcion entero obtener() { retornar 1>> }"},
    )

    assert result.diagnostics[0].code == "RUN_IMPORT_NAME_CONFLICT"


def test_interpreter_reuse_clears_previous_import_context():
    resolver = InMemoryImportResolver(
        {"utilidades.lumi": "funcion entero obtener() { retornar 1>> }"}
    )
    parser, imported_program = parse_source(
        'importar "utilidades.lumi" usar obtener>> mostrar(obtener())>>',
        resolver=resolver,
    )
    _, program_without_context = parse_source(
        'importar "utilidades.lumi" usar obtener>>'
    )
    interpreter = Interpreter()

    first_result = interpreter.execute(
        imported_program,
        parser.imported_programs,
    )
    second_result = interpreter.execute(program_without_context)

    assert first_result.succeeded
    assert first_result.output == ["1"]
    assert second_result.diagnostics[0].code == (
        "RUN_IMPORT_CONTEXT_UNAVAILABLE"
    )


def test_malformed_imported_function_reports_controlled_runtime_diagnostic():
    _, program = parse_source('importar "roto.lumi" usar rota>>')
    malformed_program = {
        "node": "ProgramNode",
        "statements": [
            {
                "node": "FunctionDeclarationNode",
                "name": "rota",
                "parameters": "invalido",
                "body": [],
                "file": "roto.lumi",
                "line": 1,
                "column": 1,
            }
        ],
        "file": "roto.lumi",
        "line": 1,
        "column": 1,
    }

    result = Interpreter().execute(program, {"roto.lumi": malformed_program})

    assert result.diagnostics[0].code == "RUN_IMPORT_INVALID_AST"
