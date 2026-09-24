from lumi_language.diagnostics import DiagnosticCategory
from lumi_language.import_resolver import InMemoryImportResolver
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser
from lumi_language.semantic_analyzer import SemanticAnalyzer
from lumi_language.symbol_table import DataType, SymbolKind


AREA_FUNCTION = """
funcion decimal calcular_area(decimal ancho, decimal largo) {
    retornar ancho * largo>>
}
"""


def parse_source(source: str, file: str = "principal.lumi", resolver=None):
    tokens = Lexer(source, file).tokenize()
    parser = Parser(tokens, import_resolver=resolver)
    return parser, parser.parse()


def analyze_with_imports(source: str, imported_sources: dict[str, str]):
    resolver = InMemoryImportResolver(imported_sources)
    parser, program = parse_source(source, resolver=resolver)
    analyzer = SemanticAnalyzer()
    result = analyzer.analyze(program, parser.imported_programs)
    return analyzer, result


def diagnostic_codes(result):
    return [diagnostic.code for diagnostic in result.diagnostics]


def test_imports_function_and_registers_import_metadata():
    analyzer, result = analyze_with_imports(
        'importar "utilidades.lumi" usar calcular_area>>',
        {"utilidades.lumi": AREA_FUNCTION},
    )

    symbol = analyzer.current_scope.resolve("calcular_area")
    assert result.succeeded
    assert symbol is not None
    assert symbol.kind is SymbolKind.FUNCTION
    assert symbol.is_imported
    assert symbol.source_file == "utilidades.lumi"
    assert symbol.file == "utilidades.lumi"


def test_imported_function_keeps_parameters_and_return_type():
    analyzer, result = analyze_with_imports(
        'importar "utilidades.lumi" usar calcular_area>>',
        {"utilidades.lumi": AREA_FUNCTION},
    )

    symbol = analyzer.current_scope.resolve("calcular_area")
    assert result.succeeded
    assert symbol.parameters == (
        ("ancho", DataType.DECIMAL),
        ("largo", DataType.DECIMAL),
    )
    assert symbol.return_type is DataType.DECIMAL


def test_calls_imported_function_through_real_pipeline():
    _, result = analyze_with_imports(
        """
importar "utilidades.lumi" usar calcular_area>>
principal {
    decimal area = calcular_area(4, 5)>>
}
""",
        {"utilidades.lumi": AREA_FUNCTION},
    )

    assert result.succeeded


def test_missing_symbol_in_imported_program_reports_import_diagnostic():
    _, result = analyze_with_imports(
        'importar "utilidades.lumi" usar calcular_area>>',
        {
            "utilidades.lumi": (
                "funcion entero otra() { retornar 1>> }"
            )
        },
    )

    assert diagnostic_codes(result) == ["IMPORT_SYMBOL_NOT_FOUND"]


def test_import_conflicts_with_local_function():
    _, result = analyze_with_imports(
        """
importar "utilidades.lumi" usar calcular_area>>
funcion decimal calcular_area(decimal lado) {
    retornar lado * lado>>
}
""",
        {"utilidades.lumi": AREA_FUNCTION},
    )

    assert diagnostic_codes(result) == ["IMPORT_SYMBOL_CONFLICT"]


def test_duplicate_import_reports_diagnostic():
    _, result = analyze_with_imports(
        """
importar "utilidades.lumi" usar calcular_area>>
importar "utilidades.lumi" usar calcular_area>>
""",
        {"utilidades.lumi": AREA_FUNCTION},
    )

    assert diagnostic_codes(result) == ["IMPORT_DUPLICATE_SYMBOL"]


def test_missing_import_context_reports_context_unavailable():
    _, program = parse_source(
        'importar "utilidades.lumi" usar calcular_area>>',
        file="proyecto.lumi",
    )

    result = SemanticAnalyzer().analyze(program)

    assert len(result.diagnostics) == 1
    diagnostic = result.diagnostics[0]
    assert diagnostic.category is DiagnosticCategory.IMPORT
    assert diagnostic.code == "IMPORT_CONTEXT_UNAVAILABLE"
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "proyecto.lumi",
        1,
        1,
    )
    assert diagnostic.description
    assert diagnostic.suggestion


def test_imported_function_reuses_argument_type_validation():
    _, result = analyze_with_imports(
        """
importar "utilidades.lumi" usar calcular_area>>
decimal area = calcular_area("cuatro", 5)>>
""",
        {"utilidades.lumi": AREA_FUNCTION},
    )

    assert diagnostic_codes(result) == ["SEM_ARGUMENT_TYPE_MISMATCH"]


def test_non_function_symbol_is_not_importable():
    _, result = analyze_with_imports(
        'importar "datos.lumi" usar cantidad>>',
        {"datos.lumi": "entero cantidad = 4>>"},
    )

    assert diagnostic_codes(result) == ["IMPORT_UNSUPPORTED_SYMBOL"]


def test_invalid_imported_parameter_type_does_not_raise_python_exception():
    _, program = parse_source(
        'importar "tipos.lumi" usar convertir>>',
    )
    imported_programs = {
        "tipos.lumi": {
            "node": "ProgramNode",
            "statements": [
                {
                    "node": "FunctionDeclarationNode",
                    "name": "convertir",
                    "parameters": [
                        {
                            "node": "ParameterNode",
                            "name": "valor",
                            "data_type": "desconocido",
                            "file": "tipos.lumi",
                            "line": 1,
                            "column": 26,
                        }
                    ],
                    "return_type": "entero",
                    "body": [],
                    "file": "tipos.lumi",
                    "line": 1,
                    "column": 1,
                }
            ],
            "file": "tipos.lumi",
            "line": 1,
            "column": 1,
        }
    }

    result = SemanticAnalyzer().analyze(program, imported_programs)

    assert diagnostic_codes(result) == ["IMPORT_INVALID_SIGNATURE"]


def test_semantic_analyzer_still_works_without_imported_programs():
    _, program = parse_source("entero cantidad = 4>>")

    result = SemanticAnalyzer().analyze(program)

    assert result.succeeded


def test_missing_file_with_available_context_reports_file_not_found():
    _, program = parse_source(
        'importar "faltante.lumi" usar calcular_area>>',
        file="proyecto.lumi",
    )

    result = SemanticAnalyzer().analyze(program, {})

    assert diagnostic_codes(result) == ["IMPORT_FILE_NOT_FOUND"]


def test_imported_function_body_validates_return_type_and_location():
    _, result = analyze_with_imports(
        'importar "utilidades.lumi" usar cantidad>>',
        {
            "utilidades.lumi": """funcion entero cantidad() {
    retornar "cuatro">>
}
"""
        },
    )

    assert len(result.diagnostics) == 1
    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "SEM_RETURN_TYPE_MISMATCH"
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "utilidades.lumi",
        2,
        5,
    )


def test_imported_function_body_reports_undeclared_variable():
    _, result = analyze_with_imports(
        'importar "utilidades.lumi" usar obtener>>',
        {
            "utilidades.lumi": (
                "funcion entero obtener() { retornar inexistente>> }"
            )
        },
    )

    assert diagnostic_codes(result) == ["SEM_UNDECLARED_VARIABLE"]
    assert result.diagnostics[0].file == "utilidades.lumi"


def test_imported_function_with_duplicate_parameters_has_invalid_signature():
    _, result = analyze_with_imports(
        'importar "utilidades.lumi" usar sumar>>',
        {
            "utilidades.lumi": (
                "funcion entero sumar(entero x, entero x) { retornar x>> }"
            )
        },
    )

    assert diagnostic_codes(result) == ["IMPORT_INVALID_SIGNATURE"]


def test_malformed_imported_program_reports_controlled_diagnostic():
    _, program = parse_source('importar "roto.lumi" usar funcion_rota>>')

    result = SemanticAnalyzer().analyze(program, {"roto.lumi": {}})

    assert diagnostic_codes(result) == ["IMPORT_INVALID_SIGNATURE"]
