import pytest

from lumi_language.ast_nodes import LiteralNode, MainNode, VariableDeclarationNode
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser
from lumi_language.token_type import TokenType
from services.compiler_service import CompilerService
from services.execution_service import ExecutionService


def compile_source(source: str):
    return CompilerService().compile(source, "principal.lumi")


def execute_source(source: str):
    compilation = compile_source(source)
    return compilation, ExecutionService().execute(compilation)


def test_null_is_recognized_as_keyword_type_and_literal_in_ast():
    source = "principal { nulo resultado = nulo>> }"
    tokens = Lexer(source, "principal.lumi").tokenize()

    assert [token.type for token in tokens].count(TokenType.NULL) == 2

    program = Parser(tokens).parse()
    main = program.statements[0]
    declaration = main.body[0]
    assert isinstance(main, MainNode)
    assert isinstance(declaration, VariableDeclarationNode)
    assert declaration.type == "nulo"
    assert isinstance(declaration.value, LiteralNode)
    assert declaration.value.literal_kind == "nulo"
    assert declaration.value.value is None


@pytest.mark.parametrize(
    "source",
    [
        "principal { nulo resultado = nulo>> }",
        "principal { nulo resultado = nulo>> resultado = nulo>> }",
    ],
)
def test_null_declaration_and_reassignment_execute_successfully(source):
    compilation, execution = execute_source(source)

    assert compilation.can_execute
    assert compilation.diagnostics == ()
    assert execution.succeeded
    assert execution.diagnostics == ()


def test_null_equality_executes_expected_branch():
    source = """
principal {
    nulo resultado = nulo>>
    si resultado == nulo {
        mostrar("Sin resultado")>>
    }
}
"""
    compilation, execution = execute_source(source)

    assert compilation.can_execute
    assert execution.succeeded
    assert execution.output == ("Sin resultado",)


@pytest.mark.parametrize(
    ("source", "expected_code"),
    [
        (
            "principal { nulo resultado = nulo>> mostrar(resultado + 3)>> }",
            "SEM_INVALID_BINARY_OPERATION",
        ),
        (
            'principal { nulo resultado = nulo>> si resultado { mostrar("Incorrecto")>> } }',
            "SEM_CONDITION_NOT_BOOLEAN",
        ),
        (
            "principal { entero cantidad = 5>> cantidad = nulo>> }",
            "SEM_TYPE_MISMATCH",
        ),
    ],
)
def test_invalid_null_uses_are_rejected_semantically(source, expected_code):
    compilation = compile_source(source)

    assert not compilation.can_execute
    assert compilation.stage.value == "semantic"
    assert [diagnostic.code for diagnostic in compilation.diagnostics] == [expected_code]


def test_original_program_executes_end_to_end():
    source = """
principal {
    entero cantidad_sillas = 4>>
    decimal ancho = 5.5>>
    texto nombre = "Sala principal">>
    booleano iluminada = verdadero>>
    nulo resultado = nulo>>

    cantidad_sillas = cantidad_sillas + 2>>

    mostrar(nombre)>>
    mostrar(cantidad_sillas)>>
    mostrar(ancho)>>
    mostrar(iluminada)>>
}
"""
    compilation, execution = execute_source(source)

    assert compilation.can_execute
    assert execution.succeeded
    assert execution.output == ("Sala principal", "6", "5.5", "verdadero")
