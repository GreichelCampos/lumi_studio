import pytest

from lumi_language.diagnostics import DiagnosticCategory
from lumi_language.interpreter import Interpreter
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser


def execute_source(source: str, file: str = "principal.lumi"):
    tokens = Lexer(source, file).tokenize()
    program = Parser(tokens).parse()
    return Interpreter().execute(program)


def test_function_without_arguments_returns_literal():
    result = execute_source(
        """
funcion entero respuesta() { retornar 42>> }
mostrar(respuesta())>>
"""
    )

    assert result.succeeded
    assert result.output == ["42"]


def test_function_with_one_argument_returns_identifier():
    result = execute_source(
        """
funcion entero identidad(entero valor) { retornar valor>> }
mostrar(identidad(7))>>
"""
    )

    assert result.succeeded
    assert result.output == ["7"]


def test_function_with_multiple_arguments_returns_expression():
    result = execute_source(
        """
funcion entero sumar(entero primero, entero segundo) {
    retornar primero + segundo>>
}
mostrar(sumar(4, 5))>>
"""
    )

    assert result.succeeded
    assert result.output == ["9"]


def test_function_can_be_called_before_declaration():
    result = execute_source(
        """
mostrar(respuesta())>>
funcion entero respuesta() { retornar 5>> }
"""
    )

    assert result.succeeded
    assert result.output == ["5"]


def test_function_result_can_initialize_variable():
    result = execute_source(
        """
funcion entero obtener() { retornar 8>> }
entero resultado = obtener()>>
mostrar(resultado)>>
"""
    )

    assert result.succeeded
    assert result.output == ["8"]


def test_function_result_can_be_used_in_operation():
    result = execute_source(
        """
funcion entero obtener() { retornar 5>> }
mostrar(obtener() + 10)>>
"""
    )

    assert result.succeeded
    assert result.output == ["15"]


def test_function_result_can_be_used_directly_in_show():
    result = execute_source(
        """
funcion texto saludo() { retornar "hola">> }
mostrar(saludo())>>
"""
    )

    assert result.succeeded
    assert result.output == ["hola"]


def test_nested_function_calls():
    result = execute_source(
        """
funcion entero duplicar(entero valor) { retornar valor * 2>> }
funcion entero incrementar(entero valor) { retornar valor + 1>> }
mostrar(duplicar(incrementar(3)))>>
"""
    )

    assert result.succeeded
    assert result.output == ["8"]


def test_void_function_can_be_called_as_statement():
    result = execute_source(
        """
funcion vacio preparar() { mostrar("preparado")>> }
preparar()>>
"""
    )

    assert result.succeeded
    assert result.output == ["preparado"]


def test_void_function_finishes_with_none_value():
    result = execute_source(
        """
funcion vacio preparar() { }
mostrar(preparar())>>
"""
    )

    assert result.succeeded
    assert result.output == ["nulo"]


def test_parameter_does_not_leak_into_caller_scope():
    result = execute_source(
        """
funcion entero identidad(entero parametro) { retornar parametro>> }
identidad(4)>>
mostrar(parametro)>>
"""
    )

    assert not result.succeeded
    assert result.diagnostics[0].code == "RUN_UNDEFINED_VARIABLE"


def test_local_variable_does_not_leak_into_caller_scope():
    result = execute_source(
        """
funcion vacio crear_local() { entero local = 9>> }
crear_local()>>
mostrar(local)>>
"""
    )

    assert not result.succeeded
    assert result.diagnostics[0].code == "RUN_UNDEFINED_VARIABLE"


def test_consecutive_calls_use_independent_local_scopes():
    result = execute_source(
        """
funcion entero copiar(entero valor) {
    entero temporal = valor>>
    retornar temporal>>
}
mostrar(copiar(2))>>
mostrar(copiar(7))>>
"""
    )

    assert result.succeeded
    assert result.output == ["2", "7"]


def test_return_stops_function_body_immediately():
    result = execute_source(
        """
funcion entero obtener() {
    retornar 5>>
    mostrar("no debe ejecutarse")>>
}
mostrar(obtener())>>
"""
    )

    assert result.succeeded
    assert result.output == ["5"]


def test_return_propagates_out_of_nested_block():
    result = execute_source(
        """
funcion entero seleccionar(booleano activo) {
    si activo {
        retornar 3>>
    }
    retornar 1>>
}
mostrar(seleccionar(verdadero))>>
"""
    )

    assert result.succeeded
    assert result.output == ["3"]


def test_simple_recursion_uses_normal_call_mechanism():
    result = execute_source(
        """
funcion entero factorial(entero valor) {
    si valor <= 1 {
        retornar 1>>
    }
    retornar valor * factorial(valor - 1)>>
}
mostrar(factorial(5))>>
"""
    )

    assert result.succeeded
    assert result.output == ["120"]


def test_undefined_function_reports_controlled_runtime_diagnostic():
    result = execute_source(
        "mostrar(no_existe())>>",
        file="runtime.lumi",
    )

    assert len(result.diagnostics) == 1
    diagnostic = result.diagnostics[0]
    assert diagnostic.category is DiagnosticCategory.RUNTIME
    assert diagnostic.code == "RUN_UNDEFINED_FUNCTION"
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "runtime.lumi",
        1,
        9,
    )
    assert diagnostic.description
    assert diagnostic.suggestion


@pytest.mark.parametrize(
    "call",
    ["identidad()>>", "identidad(1, 2)>>"],
)
def test_wrong_argument_count_reports_controlled_runtime_diagnostic(call):
    result = execute_source(
        "funcion entero identidad(entero valor) { retornar valor>> }\n" + call
    )

    assert len(result.diagnostics) == 1
    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "RUN_ARGUMENT_COUNT_MISMATCH"
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "principal.lumi",
        2,
        1,
    )


def test_return_outside_function_reports_controlled_runtime_diagnostic():
    result = execute_source("retornar 4>>")

    assert len(result.diagnostics) == 1
    assert result.diagnostics[0].code == "RUN_RETURN_OUTSIDE_FUNCTION"


def test_nested_function_is_visible_inside_declaring_function():
    result = execute_source(
        """
funcion entero externa() {
    funcion entero interna() { retornar 1>> }
    retornar interna()>>
}
mostrar(externa())>>
"""
    )

    assert result.succeeded
    assert result.output == ["1"]


def test_nested_function_is_not_visible_after_leaving_its_scope():
    result = execute_source(
        """
funcion vacio externa() {
    funcion entero interna() { retornar 1>> }
}
externa()>>
mostrar(interna())>>
"""
    )

    assert not result.succeeded
    assert result.diagnostics[0].code == "RUN_UNDEFINED_FUNCTION"


def test_function_cannot_read_variable_local_to_caller():
    result = execute_source(
        """
funcion entero obtener() { retornar secreta>> }
principal {
    entero secreta = 9>>
    mostrar(obtener())>>
}
"""
    )

    assert not result.succeeded
    assert result.diagnostics[0].code == "RUN_UNDEFINED_VARIABLE"


def test_function_uses_environment_where_it_was_declared():
    result = execute_source(
        """
entero x = 1>>
funcion entero leer_x() { retornar x>> }
funcion entero otra() {
    entero x = 9>>
    retornar leer_x()>>
}
mostrar(otra())>>
"""
    )

    assert result.succeeded
    assert result.output == ["1"]


def test_duplicate_local_functions_report_runtime_diagnostic():
    result = execute_source(
        """
funcion entero duplicada() { retornar 1>> }
funcion entero duplicada() { retornar 2>> }
"""
    )

    assert not result.succeeded
    assert result.diagnostics[0].code == "RUN_DUPLICATE_FUNCTION"


def test_same_interpreter_instance_resets_function_state():
    interpreter = Interpreter()
    first_program = Parser(
        Lexer(
            "funcion entero uno() { retornar 1>> } mostrar(uno())>>",
            "primero.lumi",
        ).tokenize()
    ).parse()
    second_program = Parser(
        Lexer("mostrar(uno())>>", "segundo.lumi").tokenize()
    ).parse()

    first_result = interpreter.execute(first_program)
    second_result = interpreter.execute(second_program)

    assert first_result.succeeded
    assert first_result.output == ["1"]
    assert second_result.diagnostics[0].code == "RUN_UNDEFINED_FUNCTION"
