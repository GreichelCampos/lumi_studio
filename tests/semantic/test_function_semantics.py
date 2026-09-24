from lumi_language.diagnostics import DiagnosticCategory
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser
from lumi_language.semantic_analyzer import SemanticAnalyzer


def analyze_source(source: str, file: str = "principal.lumi"):
    tokens = Lexer(source, file).tokenize()
    program = Parser(tokens).parse()
    return SemanticAnalyzer().analyze(program)


def diagnostic_codes(result):
    return [diagnostic.code for diagnostic in result.diagnostics]


def test_valid_function_without_arguments():
    result = analyze_source(
        """
entero resultado = respuesta()>>
funcion entero respuesta() {
    retornar 42>>
}
"""
    )

    assert result.succeeded


def test_valid_function_with_arguments():
    result = analyze_source(
        """
funcion decimal calcular_area(decimal ancho, decimal largo) {
    retornar ancho * largo>>
}
decimal area = calcular_area(4, 5)>>
"""
    )

    assert result.succeeded


def test_function_call_before_declaration():
    result = analyze_source(
        """
decimal resultado = calcular_area(4, 5)>>
funcion decimal calcular_area(decimal ancho, decimal largo) {
    retornar ancho * largo>>
}
"""
    )

    assert result.succeeded


def test_undeclared_function_reports_diagnostic():
    result = analyze_source("mostrar(no_existe())>>")

    assert diagnostic_codes(result) == ["SEM_UNDECLARED_FUNCTION"]


def test_calling_variable_reports_diagnostic():
    result = analyze_source("entero cantidad = 1>>\ncantidad()>>")

    assert diagnostic_codes(result) == ["SEM_SYMBOL_NOT_CALLABLE"]


def test_too_few_arguments_reports_diagnostic():
    result = analyze_source(
        """
funcion entero sumar(entero primero, entero segundo) {
    retornar primero + segundo>>
}
entero total = sumar(1)>>
"""
    )

    assert diagnostic_codes(result) == ["SEM_ARGUMENT_COUNT_MISMATCH"]


def test_too_many_arguments_reports_diagnostic():
    result = analyze_source(
        """
funcion entero identidad(entero valor) {
    retornar valor>>
}
entero total = identidad(1, 2)>>
"""
    )

    assert diagnostic_codes(result) == ["SEM_ARGUMENT_COUNT_MISMATCH"]


def test_incompatible_argument_reports_diagnostic_at_argument_location():
    result = analyze_source(
        """funcion entero identidad(entero valor) {
    retornar valor>>
}
principal {
    mostrar(identidad("texto"))>>
}
""",
        file="funciones.lumi",
    )

    assert len(result.diagnostics) == 1
    diagnostic = result.diagnostics[0]
    assert diagnostic.category is DiagnosticCategory.SEMANTIC
    assert diagnostic.code == "SEM_ARGUMENT_TYPE_MISMATCH"
    assert diagnostic.file == "funciones.lumi"
    assert diagnostic.line == 5
    assert diagnostic.column == 23
    assert diagnostic.description
    assert diagnostic.suggestion


def test_nested_function_calls_are_valid():
    result = analyze_source(
        """
funcion entero duplicar(entero valor) {
    retornar valor * 2>>
}
funcion entero incrementar(entero valor) {
    retornar valor + 1>>
}
entero resultado = duplicar(incrementar(2))>>
"""
    )

    assert result.succeeded


def test_function_call_type_is_used_inside_expression():
    result = analyze_source(
        """
decimal total = calcular_area(4, 5) + 10>>
funcion decimal calcular_area(decimal ancho, decimal largo) {
    retornar ancho * largo>>
}
"""
    )

    assert result.succeeded


def test_compatible_return_type_is_valid():
    result = analyze_source(
        "funcion decimal convertir() { retornar 4>> }"
    )

    assert result.succeeded


def test_incompatible_return_type_reports_diagnostic():
    result = analyze_source(
        'funcion entero cantidad() { retornar "cuatro">> }'
    )

    assert diagnostic_codes(result) == ["SEM_RETURN_TYPE_MISMATCH"]


def test_return_outside_function_reports_diagnostic():
    result = analyze_source("retornar 4>>")

    assert diagnostic_codes(result) == ["SEM_RETURN_OUTSIDE_FUNCTION"]


def test_void_function_without_return_is_valid():
    result = analyze_source(
        'funcion vacio preparar() { mostrar("listo")>> }'
    )

    assert result.succeeded


def test_void_function_cannot_return_a_value():
    result = analyze_source("funcion vacio preparar() { retornar 1>> }")

    assert diagnostic_codes(result) == ["SEM_RETURN_TYPE_MISMATCH"]


def test_duplicate_parameters_report_diagnostic_at_second_parameter():
    result = analyze_source(
        "funcion entero sumar(entero valor, entero valor) { retornar valor>> }"
    )

    assert len(result.diagnostics) == 1
    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "SEM_DUPLICATE_SYMBOL"
    assert diagnostic.file == "principal.lumi"
    assert diagnostic.line == 1
    assert diagnostic.column == 36


def test_invalid_parameter_type_produces_diagnostic_instead_of_exception():
    program = {
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
                        "line": 3,
                        "column": 20,
                    }
                ],
                "return_type": "entero",
                "body": [],
                "file": "tipos.lumi",
                "line": 3,
                "column": 1,
            }
        ],
        "file": "tipos.lumi",
        "line": 1,
        "column": 1,
    }

    result = SemanticAnalyzer().analyze(program)

    assert len(result.diagnostics) == 1
    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "SEM_UNKNOWN_TYPE"
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "tipos.lumi",
        3,
        20,
    )


def test_non_void_function_without_return_reports_diagnostic():
    result = analyze_source("funcion entero sin_retorno() { }")

    assert diagnostic_codes(result) == ["SEM_MISSING_RETURN"]


def test_non_void_function_with_guaranteed_return_remains_valid():
    result = analyze_source(
        """
funcion entero seleccionar(booleano activo) {
    si activo { retornar 1>> } sino { retornar 2>> }
}
"""
    )

    assert result.succeeded


def test_same_semantic_analyzer_instance_resets_function_state():
    analyzer = SemanticAnalyzer()
    first_program = Parser(
        Lexer(
            "funcion entero uno() { retornar 1>> } mostrar(uno())>>",
            "primero.lumi",
        ).tokenize()
    ).parse()
    second_program = Parser(
        Lexer("mostrar(uno())>>", "segundo.lumi").tokenize()
    ).parse()

    first_result = analyzer.analyze(first_program)
    second_result = analyzer.analyze(second_program)

    assert first_result.succeeded
    assert diagnostic_codes(second_result) == ["SEM_UNDECLARED_FUNCTION"]
