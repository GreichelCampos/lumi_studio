import pytest

from lumi_language.lexer import Lexer
from lumi_language.parser import Parser
from lumi_language.ast_nodes import (
    AssignmentNode,
    BinaryExpressionNode,
    IdentifierNode,
    ListNode,
    LiteralNode,
    ReadNode,
    ShowNode,
    UnaryExpressionNode,
    VariableDeclarationNode,
    VectorNode,
)


def parse_source(source: str):
    tokens = Lexer(source, "principal.lumi").tokenize()
    return Parser(tokens).parse()


def test_variable_declaration():
    ast = parse_source("entero cantidad = 4>>")

    assert len(ast.statements) == 1

    statement = ast.statements[0]

    assert isinstance(statement, VariableDeclarationNode)
    assert statement.type == "entero"
    assert statement.name == "cantidad"

    assert isinstance(statement.value, LiteralNode)
    assert statement.value.value == 4
    assert statement.value.literal_kind == "entero"


def test_assignment():
    ast = parse_source("cantidad = 5>>")

    assert len(ast.statements) == 1

    statement = ast.statements[0]

    assert isinstance(statement, AssignmentNode)
    assert statement.name == "cantidad"

    assert isinstance(statement.value, LiteralNode)
    assert statement.value.value == 5
    assert statement.value.literal_kind == "entero"


def test_read_inside_variable_declaration():
    ast = parse_source('texto nombre = leer("Nombre:")>>')

    statement = ast.statements[0]

    assert isinstance(statement, VariableDeclarationNode)
    assert statement.type == "texto"
    assert statement.name == "nombre"

    assert isinstance(statement.value, ReadNode)

    assert isinstance(statement.value.message, LiteralNode)
    assert statement.value.message.value == "Nombre:"
    assert statement.value.message.literal_kind == "texto"


def test_show():
    ast = parse_source("mostrar(5)>>")

    statement = ast.statements[0]

    assert isinstance(statement, ShowNode)

    assert isinstance(statement.expression, LiteralNode)
    assert statement.expression.value == 5
    assert statement.expression.literal_kind == "entero"


def test_arithmetic_precedence():
    ast = parse_source("entero resultado = 2 + 3 * 4>>")

    statement = ast.statements[0]
    expression = statement.value

    assert isinstance(expression, BinaryExpressionNode)
    assert expression.operator == "+"

    assert isinstance(expression.left, LiteralNode)
    assert expression.left.value == 2

    assert isinstance(expression.right, BinaryExpressionNode)
    assert expression.right.operator == "*"
    assert expression.right.left.value == 3
    assert expression.right.right.value == 4


def test_parentheses_change_precedence():
    ast = parse_source("entero resultado = (2 + 3) * 4>>")

    statement = ast.statements[0]
    expression = statement.value

    assert isinstance(expression, BinaryExpressionNode)
    assert expression.operator == "*"

    assert isinstance(expression.left, BinaryExpressionNode)
    assert expression.left.operator == "+"
    assert expression.left.left.value == 2
    assert expression.left.right.value == 3

    assert isinstance(expression.right, LiteralNode)
    assert expression.right.value == 4


def test_logical_precedence():
    ast = parse_source(
        "booleano resultado = verdadero o falso y verdadero>>"
    )

    statement = ast.statements[0]
    expression = statement.value

    assert isinstance(expression, BinaryExpressionNode)
    assert expression.operator == "o"

    assert isinstance(expression.left, LiteralNode)
    assert expression.left.value is True

    assert isinstance(expression.right, BinaryExpressionNode)
    assert expression.right.operator == "y"
    assert expression.right.left.value is False
    assert expression.right.right.value is True


def test_unary_not():
    ast = parse_source("booleano activo = no falso>>")

    statement = ast.statements[0]
    expression = statement.value

    assert isinstance(expression, UnaryExpressionNode)
    assert expression.operator == "no"

    assert isinstance(expression.operand, LiteralNode)
    assert expression.operand.value is False


def test_multiple_statements():
    source = """
entero cantidad = 4>>
cantidad = cantidad + 1>>
mostrar(cantidad)>>
"""

    ast = parse_source(source)

    assert len(ast.statements) == 3

    assert isinstance(ast.statements[0], VariableDeclarationNode)
    assert isinstance(ast.statements[1], AssignmentNode)
    assert isinstance(ast.statements[2], ShowNode)


def test_node_location():
    ast = parse_source("entero cantidad = 4>>")

    statement = ast.statements[0]

    assert statement.file == "principal.lumi"
    assert statement.line == 1
    assert statement.column == 1

    assert statement.value.file == "principal.lumi"
    assert statement.value.line == 1


def test_missing_terminator_raises_error():
    with pytest.raises(ValueError):
        parse_source("entero cantidad = 4")


@pytest.mark.parametrize(
    "source",
    [
        "entero cantidad =",
        "mostrar(",
        "lista xs = [1,",
    ],
)
def test_incomplete_input_raises_value_error_not_index_error(source):
    with pytest.raises(ValueError) as error:
        parse_source(source)

    assert not isinstance(error.value, IndexError)


def test_decimal_declaration():
    ast = parse_source("decimal ancho = 2.5>>")

    statement = ast.statements[0]

    assert isinstance(statement, VariableDeclarationNode)
    assert statement.type == "decimal"
    assert statement.name == "ancho"

    assert isinstance(statement.value, LiteralNode)
    assert statement.value.value == 2.5
    assert statement.value.literal_kind == "decimal"


def test_text_declaration():
    ast = parse_source('texto nombre = "Sala">>')

    statement = ast.statements[0]

    assert isinstance(statement, VariableDeclarationNode)
    assert statement.type == "texto"
    assert statement.name == "nombre"

    assert isinstance(statement.value, LiteralNode)
    assert statement.value.value == "Sala"
    assert statement.value.literal_kind == "texto"


def test_boolean_declaration():
    ast = parse_source("booleano activo = verdadero>>")

    statement = ast.statements[0]

    assert isinstance(statement, VariableDeclarationNode)
    assert statement.type == "booleano"
    assert statement.name == "activo"

    assert isinstance(statement.value, LiteralNode)
    assert statement.value.value is True
    assert statement.value.literal_kind == "booleano"


def test_null_literal_as_value():
    ast = parse_source("texto nombre = nulo>>")

    statement = ast.statements[0]

    assert isinstance(statement, VariableDeclarationNode)
    assert statement.type == "texto"

    assert isinstance(statement.value, LiteralNode)
    assert statement.value.value is None
    assert statement.value.literal_kind == "nulo"


def test_null_equality_comparison():
    ast = parse_source("booleano sin_nombre = nombre == nulo>>")

    expression = ast.statements[0].value

    assert isinstance(expression, BinaryExpressionNode)
    assert expression.operator == "=="

    assert isinstance(expression.left, IdentifierNode)
    assert expression.left.name == "nombre"

    assert isinstance(expression.right, LiteralNode)
    assert expression.right.value is None
    assert expression.right.literal_kind == "nulo"


def test_null_inequality_comparison():
    ast = parse_source("booleano con_nombre = nombre != nulo>>")

    expression = ast.statements[0].value

    assert isinstance(expression, BinaryExpressionNode)
    assert expression.operator == "!="

    assert isinstance(expression.left, IdentifierNode)
    assert expression.left.name == "nombre"

    assert isinstance(expression.right, LiteralNode)
    assert expression.right.value is None
    assert expression.right.literal_kind == "nulo"


def test_empty_list_declaration():
    ast = parse_source("lista elementos = []>>")

    statement = ast.statements[0]

    assert isinstance(statement, VariableDeclarationNode)
    assert statement.type == "lista"
    assert isinstance(statement.value, ListNode)
    assert statement.value.elements == []


def test_list_declaration():
    ast = parse_source(
        "lista muebles_comedor = [mesa1, silla1, silla2]>>"
    )

    statement = ast.statements[0]

    assert isinstance(statement, VariableDeclarationNode)
    assert statement.type == "lista"
    assert statement.name == "muebles_comedor"

    assert isinstance(statement.value, ListNode)
    assert len(statement.value.elements) == 3

    assert isinstance(statement.value.elements[0], IdentifierNode)
    assert statement.value.elements[0].name == "mesa1"

    assert isinstance(statement.value.elements[1], IdentifierNode)
    assert statement.value.elements[1].name == "silla1"

    assert isinstance(statement.value.elements[2], IdentifierNode)
    assert statement.value.elements[2].name == "silla2"


def test_nested_list_with_positions():
    source = """
lista posiciones = [
    [-1.5, 0, 1],
    [-0.5, 0, 1],
    [0.5, 0, 1],
    [1.5, 0, 1]
]>>
"""

    ast = parse_source(source)

    statement = ast.statements[0]

    assert isinstance(statement, VariableDeclarationNode)
    assert statement.type == "lista"

    assert isinstance(statement.value, ListNode)
    assert len(statement.value.elements) == 4

    first_position = statement.value.elements[0]

    assert isinstance(first_position, ListNode)
    assert len(first_position.elements) == 3

    assert isinstance(first_position.elements[0], UnaryExpressionNode)
    assert first_position.elements[0].operator == "-"

    assert isinstance(first_position.elements[0].operand, LiteralNode)
    assert first_position.elements[0].operand.value == 1.5


def test_vector_declaration():
    ast = parse_source(
        "vector punto = [2.5, 0, -1.5]>>"
    )

    statement = ast.statements[0]

    assert isinstance(statement, VariableDeclarationNode)
    assert statement.type == "vector"
    assert statement.name == "punto"

    assert isinstance(statement.value, VectorNode)

    assert isinstance(statement.value.x, LiteralNode)
    assert statement.value.x.value == 2.5

    assert isinstance(statement.value.y, LiteralNode)
    assert statement.value.y.value == 0

    assert isinstance(statement.value.z, UnaryExpressionNode)
    assert statement.value.z.operator == "-"

    assert isinstance(statement.value.z.operand, LiteralNode)
    assert statement.value.z.operand.value == 1.5


def test_vector_requires_exactly_three_components_with_less_components():
    with pytest.raises(ValueError):
        parse_source("vector punto = [1, 2]>>")


def test_vector_requires_exactly_three_components_with_more_components():
    with pytest.raises(ValueError):
        parse_source("vector punto = [1, 2, 3, 4]>>")


def test_assignment_bracket_literal_remains_list_pending_vector_semantics():
    ast = parse_source("punto = [4, 5, 6]>>")

    statement = ast.statements[0]

    assert isinstance(statement, AssignmentNode)
    assert statement.name == "punto"
    assert isinstance(statement.value, ListNode)
    assert len(statement.value.elements) == 3


def test_relational_equality_and_logical_precedence():
    ast = parse_source(
        "booleano resultado = 1 + 2 > 2 == verdadero y falso o verdadero>>"
    )

    expression = ast.statements[0].value

    assert isinstance(expression, BinaryExpressionNode)
    assert expression.operator == "o"

    assert isinstance(expression.left, BinaryExpressionNode)
    assert expression.left.operator == "y"

    equality = expression.left.left
    assert isinstance(equality, BinaryExpressionNode)
    assert equality.operator == "=="

    comparison = equality.left
    assert isinstance(comparison, BinaryExpressionNode)
    assert comparison.operator == ">"

    term = comparison.left
    assert isinstance(term, BinaryExpressionNode)
    assert term.operator == "+"


def test_unary_minus_precedence_before_multiplication():
    ast = parse_source("decimal resultado = -1.5 * 2>>")

    expression = ast.statements[0].value

    assert isinstance(expression, BinaryExpressionNode)
    assert expression.operator == "*"

    assert isinstance(expression.left, UnaryExpressionNode)
    assert expression.left.operator == "-"

    assert isinstance(expression.left.operand, LiteralNode)
    assert expression.left.operand.value == 1.5

    assert isinstance(expression.right, LiteralNode)
    assert expression.right.value == 2
