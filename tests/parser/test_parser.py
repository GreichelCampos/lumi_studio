import pytest

from lumi_language.lexer import Lexer
from lumi_language.parser import Parser
from lumi_language.import_resolver import InMemoryImportResolver
from lumi_language.ast_nodes import (
    AssignmentNode,
    BinaryExpressionNode,
    CaseNode,
    DoorNode,
    FloorNode,
    ForNode,
    FunctionCallNode,
    FunctionDeclarationNode,
    IdentifierNode,
    IfNode,
    ImportNode,
    ListNode,
    LiteralNode,
    MainNode,
    MoveObjectNode,
    ParameterNode,
    PlaceObjectNode,
    ReadNode,
    RepeatNode,
    ReturnNode,
    RoomNode,
    RotateObjectNode,
    ShowNode,
    SpatialObjectDeclarationNode,
    SpatialPropertyNode,
    SwitchNode,
    UnaryExpressionNode,
    VariableDeclarationNode,
    VectorNode,
    WallNode,
    WhileNode,
    WindowNode,
)


def parse_source(source: str):
    tokens = Lexer(source, "principal.lumi").tokenize()
    return Parser(tokens).parse()


def make_parser(source: str, file: str = "principal.lumi", import_resolver=None):
    tokens = Lexer(source, file).tokenize()
    return Parser(tokens, import_resolver=import_resolver)


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


def test_if_without_else():
    ast = parse_source('si ancho >= 5 { mostrar("Amplia")>> }')
    statement = ast.statements[0]

    assert isinstance(statement, IfNode)
    assert isinstance(statement.condition, BinaryExpressionNode)
    assert len(statement.then_body) == 1
    assert statement.else_body == []


def test_if_with_else():
    ast = parse_source(
        'si ancho >= 5 { mostrar("Amplia")>> } sino { mostrar("Compacta")>> }'
    )
    statement = ast.statements[0]

    assert isinstance(statement, IfNode)
    assert len(statement.then_body) == 1
    assert len(statement.else_body) == 1


def test_if_complex_condition():
    ast = parse_source("si ancho >= 5 y activo o falso { }")
    condition = ast.statements[0].condition

    assert isinstance(condition, BinaryExpressionNode)
    assert condition.operator == "o"


def test_nested_if():
    ast = parse_source('si activo { si ancho > 5 { mostrar("Amplia")>> } }')
    outer = ast.statements[0]
    inner = outer.then_body[0]

    assert isinstance(outer, IfNode)
    assert isinstance(inner, IfNode)


def test_if_empty_block():
    ast = parse_source("si activo { }")

    assert ast.statements[0].then_body == []


def test_switch_one_case_without_default():
    ast = parse_source('segun acabado { caso "madera": mostrar("Calido")>> }')
    statement = ast.statements[0]

    assert isinstance(statement, SwitchNode)
    assert isinstance(statement.expression, IdentifierNode)
    assert len(statement.cases) == 1
    assert statement.default_body == []


def test_switch_multiple_cases_with_default_and_case_content():
    ast = parse_source(
        """
segun acabado {
    caso "madera":
        mostrar("Calido")>>
    caso "ceramica":
        mostrar("Resistente")>>
    defecto:
        mostrar("Desconocido")>>
}
"""
    )
    statement = ast.statements[0]

    assert isinstance(statement, SwitchNode)
    assert len(statement.cases) == 2
    assert len(statement.default_body) == 1

    first_case = statement.cases[0]
    assert isinstance(first_case, CaseNode)
    assert first_case.value.value == "madera"
    assert isinstance(first_case.body[0], ShowNode)


def test_while_condition_and_assignment_body():
    ast = parse_source("mientras cantidad < 4 { cantidad = cantidad + 1>> }")
    statement = ast.statements[0]

    assert isinstance(statement, WhileNode)
    assert isinstance(statement.condition, BinaryExpressionNode)
    assert isinstance(statement.body[0], AssignmentNode)


def test_repeat_literal_count():
    ast = parse_source('repetir 4 { mostrar("Dato")>> }')
    statement = ast.statements[0]

    assert isinstance(statement, RepeatNode)
    assert isinstance(statement.count, LiteralNode)
    assert len(statement.body) == 1


def test_repeat_identifier_count():
    ast = parse_source('repetir cantidad { mostrar("Dato")>> }')

    assert isinstance(ast.statements[0].count, IdentifierNode)


def test_for_header_and_body():
    ast = parse_source(
        "hacer entero i = 0; i < 4; i = i + 1 { mostrar(i)>> }"
    )
    statement = ast.statements[0]

    assert isinstance(statement, ForNode)
    assert isinstance(statement.initializer, VariableDeclarationNode)
    assert statement.initializer.type == "entero"
    assert statement.initializer.name == "i"
    assert isinstance(statement.condition, BinaryExpressionNode)
    assert statement.condition.operator == "<"
    assert isinstance(statement.update, AssignmentNode)
    assert statement.update.name == "i"
    assert isinstance(statement.body[0], ShowNode)


def test_for_body_is_parsed_as_block():
    ast = parse_source(
        """
hacer entero i = 0; i < 4; i = i + 1 {
    mostrar(i)>>
    si i < 2 { mostrar(i)>> }
}
"""
    )
    statement = ast.statements[0]

    assert isinstance(statement, ForNode)
    assert len(statement.body) == 2
    assert isinstance(statement.body[0], ShowNode)
    assert isinstance(statement.body[1], IfNode)


def test_for_header_uses_semicolon_not_terminator():
    ast = parse_source("hacer entero i = 0; i < 1; i = i + 1 { }")

    assert isinstance(ast.statements[0], ForNode)


def test_for_missing_left_brace_raises_value_error():
    with pytest.raises(ValueError) as error:
        parse_source("hacer entero i = 0; i < 4; i = i + 1 mostrar(i)>> }")

    assert not isinstance(error.value, IndexError)


def test_for_header_rejects_terminator_after_initializer():
    with pytest.raises(ValueError) as error:
        parse_source("hacer entero i = 0>> i < 4; i = i + 1 { mostrar(i)>> }")

    assert not isinstance(error.value, IndexError)


def test_for_missing_semicolon_raises_value_error():
    with pytest.raises(ValueError) as error:
        parse_source("hacer entero i = 0 i < 4; i = i + 1 { }")

    assert not isinstance(error.value, IndexError)


def test_for_incomplete_header_raises_value_error_not_index_error():
    with pytest.raises(ValueError) as error:
        parse_source("hacer entero i = 0; i < 4; i =")

    assert not isinstance(error.value, IndexError)


def test_function_with_return_and_multiple_parameters():
    ast = parse_source(
        """
funcion decimal calcular_area(decimal ancho, decimal largo) {
    retornar ancho * largo>>
}
"""
    )
    statement = ast.statements[0]

    assert isinstance(statement, FunctionDeclarationNode)
    assert statement.name == "calcular_area"
    assert statement.return_type == "decimal"
    assert len(statement.parameters) == 2
    assert isinstance(statement.parameters[0], ParameterNode)
    assert statement.parameters[0].name == "ancho"
    assert statement.parameters[0].data_type == "decimal"
    assert isinstance(statement.body[0], ReturnNode)


def test_void_function_without_parameters():
    ast = parse_source('funcion vacio preparar_espacio() { mostrar("Ok")>> }')
    statement = ast.statements[0]

    assert isinstance(statement, FunctionDeclarationNode)
    assert statement.return_type == "vacio"
    assert statement.parameters == []


def test_function_with_one_parameter():
    ast = parse_source("funcion entero duplicar(entero valor) { retornar valor>> }")

    assert len(ast.statements[0].parameters) == 1


def test_return_literal_identifier_and_expression():
    literal_ast = parse_source("retornar 4>>")
    identifier_ast = parse_source("retornar cantidad>>")
    expression_ast = parse_source("retornar ancho * largo>>")

    assert isinstance(literal_ast.statements[0].value, LiteralNode)
    assert isinstance(identifier_ast.statements[0].value, IdentifierNode)
    assert isinstance(expression_ast.statements[0].value, BinaryExpressionNode)


def test_return_requires_terminator():
    with pytest.raises(ValueError) as error:
        parse_source("retornar 4")

    assert not isinstance(error.value, IndexError)


def test_main_empty():
    ast = parse_source("principal { }")
    statement = ast.statements[0]

    assert isinstance(statement, MainNode)
    assert statement.body == []


def test_main_with_multiple_statements():
    ast = parse_source(
        """
principal {
    entero cantidad = 4>>
    mostrar(cantidad)>>
}
"""
    )
    statement = ast.statements[0]

    assert isinstance(statement, MainNode)
    assert isinstance(statement.body[0], VariableDeclarationNode)
    assert isinstance(statement.body[1], ShowNode)


@pytest.mark.parametrize(
    "source",
    [
        "si activo mostrar(activo)>>",
        "si activo { mostrar(activo)>>",
        "segun acabado { caso 1 mostrar(acabado)>> }",
        "funcion entero prueba(entero valor { retornar valor>> }",
        "funcion entero prueba(entero) { retornar 1>> }",
        "retornar",
        "principal { si activo {",
    ],
)
def test_l016_incomplete_or_invalid_input_raises_value_error(source):
    with pytest.raises(ValueError) as error:
        parse_source(source)

    assert not isinstance(error.value, IndexError)


def test_l016_node_locations():
    ast = parse_source(
        """
principal {
    si activo { }
    mientras activo { }
    repetir 2 { }
    hacer entero i = 0; i < 1; i = i + 1 { }
    segun i {
        caso 1:
            mostrar(i)>>
    }
    funcion entero identidad(entero valor) {
        retornar valor>>
    }
}
"""
    )
    main = ast.statements[0]
    if_node = main.body[0]
    while_node = main.body[1]
    repeat_node = main.body[2]
    for_node = main.body[3]
    switch_node = main.body[4]
    case_node = switch_node.cases[0]
    function_node = main.body[5]
    parameter_node = function_node.parameters[0]
    return_node = function_node.body[0]

    assert (main.file, main.line, main.column) == ("principal.lumi", 2, 1)
    assert (if_node.file, if_node.line, if_node.column) == (
        "principal.lumi",
        3,
        5,
    )
    assert while_node.line == 4
    assert repeat_node.line == 5
    assert for_node.line == 6
    assert switch_node.line == 7
    assert case_node.line == 8
    assert function_node.line == 11
    assert parameter_node.line == 11
    assert return_node.line == 12


def test_l016_integrated_program():
    ast = parse_source(
        """
funcion decimal calcular_area(decimal ancho, decimal largo) {
    retornar ancho * largo>>
}

principal {
    entero cantidad = 0>>

    mientras cantidad < 3 {
        cantidad = cantidad + 1>>
    }

    si cantidad == 3 {
        mostrar("Completo")>>
    } sino {
        mostrar("Incompleto")>>
    }

    repetir 2 {
        mostrar(cantidad)>>
    }

    hacer entero i = 0; i < 3; i = i + 1 {
        mostrar(i)>>
    }

    segun cantidad {
        caso 1:
            mostrar("Uno")>>
        caso 2:
            mostrar("Dos")>>
        defecto:
            mostrar("Otro")>>
    }
}
"""
    )

    assert isinstance(ast.statements[0], FunctionDeclarationNode)
    assert isinstance(ast.statements[1], MainNode)


def test_l022_function_call_without_arguments_as_statement():
    ast = parse_source("preparar()>>")

    statement = ast.statements[0]

    assert isinstance(statement, FunctionCallNode)
    assert statement.name == "preparar"
    assert statement.arguments == []


def test_l022_function_call_with_one_argument():
    ast = parse_source("centro(longitud)>>")

    call = ast.statements[0]

    assert isinstance(call, FunctionCallNode)
    assert call.name == "centro"
    assert len(call.arguments) == 1
    assert isinstance(call.arguments[0], IdentifierNode)


def test_l022_function_call_with_multiple_expression_arguments():
    ast = parse_source("decimal total = calcular_area(ancho + 1, largo * 2)>>")

    call = ast.statements[0].value

    assert isinstance(call, FunctionCallNode)
    assert call.name == "calcular_area"
    assert len(call.arguments) == 2
    assert isinstance(call.arguments[0], BinaryExpressionNode)
    assert isinstance(call.arguments[1], BinaryExpressionNode)


def test_l022_function_call_inside_show_return_and_binary_expression():
    ast = parse_source(
        """
mostrar(calcular_area(ancho, largo))>>
retornar calcular_area(ancho, largo)>>
decimal total = calcular_area(ancho, largo) + 5>>
"""
    )

    assert isinstance(ast.statements[0].expression, FunctionCallNode)
    assert isinstance(ast.statements[1].value, FunctionCallNode)

    expression = ast.statements[2].value
    assert isinstance(expression, BinaryExpressionNode)
    assert isinstance(expression.left, FunctionCallNode)


def test_l022_nested_function_call_argument():
    ast = parse_source("mostrar(exterior(interior(1)))>>")

    outer = ast.statements[0].expression

    assert isinstance(outer, FunctionCallNode)
    assert isinstance(outer.arguments[0], FunctionCallNode)


def test_l022_identifier_statement_still_parses_assignment():
    ast = parse_source("cantidad = cantidad + 1>>")

    assert isinstance(ast.statements[0], AssignmentNode)


def test_l022_import_uses_documented_importar_usar_syntax():
    ast = parse_source('importar "utilidades.lumi" usar calcular_area>>')

    statement = ast.statements[0]

    assert isinstance(statement, ImportNode)
    assert statement.file_name == "utilidades.lumi"
    assert statement.symbol_name == "calcular_area"


def test_l022_import_resolver_parses_imported_file_and_preserves_file():
    resolver = InMemoryImportResolver(
        {
            "utilidades.lumi": """
funcion decimal calcular_area(decimal ancho, decimal largo) {
    retornar ancho * largo>>
}
"""
        }
    )
    parser = make_parser(
        'importar "utilidades.lumi" usar calcular_area>>',
        import_resolver=resolver,
    )

    ast = parser.parse()
    imported = parser.imported_programs["utilidades.lumi"]

    assert isinstance(ast.statements[0], ImportNode)
    assert imported.statements[0].file == "utilidades.lumi"
    assert imported.statements[0].body[0].file == "utilidades.lumi"


def test_l022_import_missing_file_reports_import_diagnostic():
    parser = make_parser(
        'importar "faltante.lumi" usar calcular_area>>',
        import_resolver=InMemoryImportResolver({}),
    )

    with pytest.raises(ValueError):
        parser.parse()

    assert parser.diagnostics[0].category.value == "IMPORT"
    assert parser.diagnostics[0].code == "IMPORT_FILE_NOT_FOUND"
    assert parser.diagnostics[0].file == "principal.lumi"


@pytest.mark.parametrize(
    "source, expected",
    [
        ("preparar(", "Se esperaba una expresion."),
        ("preparar(1, )>>", "Se esperaba un argumento"),
        ("preparar(1 2)>>", "Se esperaba ')' despues de los argumentos."),
        ('importar "utilidades.lumi">>', "Se esperaba 'usar'"),
        ("mostrar(1)", "Se esperaba '>>'"),
        ("si activo {", "Se esperaba '}'"),
        ("entero x = >>", "Se esperaba una expresion."),
        (">>", "Se esperaba una instruccion valida."),
    ],
)
def test_l022_precise_syntax_errors_include_location(source, expected):
    parser = make_parser(source)

    with pytest.raises(ValueError):
        parser.parse()

    diagnostic = parser.diagnostics[0]
    assert diagnostic.category.value == "SYNTACTIC"
    assert expected in diagnostic.description
    assert diagnostic.file == "principal.lumi"
    assert diagnostic.line >= 1
    assert diagnostic.column >= 1


def test_l022_recovery_continues_after_invalid_statement():
    parser = make_parser(
        """
mostrar(1)
entero cantidad = 4>>
mostrar(cantidad)>>
"""
    )

    ast = parser.parse_with_recovery()

    assert len(parser.diagnostics) == 1
    assert len(ast.statements) == 2
    assert isinstance(ast.statements[0], VariableDeclarationNode)
    assert isinstance(ast.statements[1], ShowNode)


def test_l025_empty_room_with_literal_dimensions():
    ast = parse_source("habitacion sala(5, 4, 2.7) { }")

    room = ast.statements[0]
    assert isinstance(room, RoomNode)
    assert room.name == "sala"
    assert room.width.value == 5
    assert room.length.value == 4
    assert room.height.value == 2.7
    assert room.body == []


def test_l025_room_accepts_expression_dimensions():
    ast = parse_source("habitacion sala(ancho, largo + 1, alto) { }")

    room = ast.statements[0]
    assert isinstance(room.width, IdentifierNode)
    assert isinstance(room.length, BinaryExpressionNode)
    assert isinstance(room.height, IdentifierNode)


@pytest.mark.parametrize(
    "source, expected_names",
    [
        ("silla silla1 { }", []),
        ('silla silla1 { color "rojo">> }', ["color"]),
        ('mesa mesa1 { material "madera">> }', ["material"]),
        (
            'silla silla1 { color "rojo">> material "madera">> }',
            ["color", "material"],
        ),
        (
            'silla silla1 { material "madera">> color "rojo">> }',
            ["material", "color"],
        ),
    ],
)
def test_l025_generic_spatial_object_properties(source, expected_names):
    declaration = parse_source(source).statements[0]

    assert isinstance(declaration, SpatialObjectDeclarationNode)
    assert declaration.object_type in ("silla", "mesa")
    assert declaration.name in ("silla1", "mesa1")
    assert [property_node.name for property_node in declaration.properties] == (
        expected_names
    )
    assert all(
        isinstance(property_node, SpatialPropertyNode)
        for property_node in declaration.properties
    )


def test_l025_spatial_property_value_accepts_expression():
    declaration = parse_source("silla silla1 { color tono + sufijo>> }").statements[0]

    assert isinstance(declaration.properties[0].value, BinaryExpressionNode)


@pytest.mark.parametrize(
    "source, node_type",
    [
        ('piso piso1 { material "madera">> }', FloorNode),
        ('pared pared1 { color "blanco">> }', WallNode),
        ("puerta puerta1 { }", DoorNode),
        ("ventana ventana1 { }", WindowNode),
    ],
)
def test_l025_reserved_spatial_elements(source, node_type):
    declaration = parse_source(source).statements[0]

    assert isinstance(declaration, node_type)
    assert declaration.name.endswith("1")


def test_l025_place_with_literal_vector():
    statement = parse_source("colocar silla1 [1, 0, 2]>>").statements[0]

    assert isinstance(statement, PlaceObjectNode)
    assert statement.object_name == "silla1"
    assert isinstance(statement.position, VectorNode)
    assert (statement.position.x.value, statement.position.y.value) == (1, 0)
    assert statement.position.z.value == 2


def test_l025_place_with_expression_vector():
    statement = parse_source(
        "colocar silla1 [x + 1, 0, largo / 2]>>"
    ).statements[0]

    assert isinstance(statement.position.x, BinaryExpressionNode)
    assert isinstance(statement.position.z, BinaryExpressionNode)


def test_l025_move_and_rotate_use_vectors():
    ast = parse_source("mover silla1 [2, 0, 3]>> rotar silla1 [0, 90, 0]>>")

    assert isinstance(ast.statements[0], MoveObjectNode)
    assert isinstance(ast.statements[0].position, VectorNode)
    assert isinstance(ast.statements[1], RotateObjectNode)
    assert isinstance(ast.statements[1].rotation, VectorNode)


def test_l025_room_reuses_general_block_for_mixed_instructions():
    ast = parse_source(
        """
habitacion sala(5, 4, 2.7) {
    silla silla1 {
        color "rojo">>
        material "madera">>
    }
    colocar silla1 [1, 0, 2]>>
    mostrar("Habitacion creada")>>
}
"""
    )

    room = ast.statements[0]
    assert isinstance(room, RoomNode)
    assert isinstance(room.body[0], SpatialObjectDeclarationNode)
    assert isinstance(room.body[1], PlaceObjectNode)
    assert isinstance(room.body[2], ShowNode)


def test_l025_identifier_dispatch_regressions():
    ast = parse_source("x = 10>> calcular(5)>> silla silla1 { }")

    assert isinstance(ast.statements[0], AssignmentNode)
    assert isinstance(ast.statements[1], FunctionCallNode)
    assert isinstance(ast.statements[2], SpatialObjectDeclarationNode)


def test_l025_list_assignment_remains_list_not_vector():
    statement = parse_source("punto = [4, 5, 6]>>").statements[0]

    assert isinstance(statement.value, ListNode)
    assert not isinstance(statement.value, VectorNode)


@pytest.mark.parametrize(
    "source, expected",
    [
        ("habitacion sala(5, 4) { }", "Se esperaba ',' despues del largo."),
        (
            "habitacion sala(5, 4, 2.7 { }",
            "Se esperaba ')' despues de las dimensiones",
        ),
        ("habitacion sala(5, 4, 2.7)", "Se esperaba '{'"),
        ("silla { }", "una asignacion, una llamada o una declaracion espacial"),
        ("silla silla1", "Se esperaba '{'"),
        ('silla silla1 { color >> }', "Se esperaba una expresion."),
        ('silla silla1 { color "rojo" }', "Se esperaba '>>'"),
        (
            'silla silla1 { color "rojo">> color "azul">> }',
            "La propiedad 'color' no puede repetirse.",
        ),
        (
            'silla silla1 { material "madera">> material "metal">> }',
            "La propiedad 'material' no puede repetirse.",
        ),
        ("silla silla1 { mostrar(1)>> }", "Solo se permiten las propiedades"),
        ("colocar [1, 0, 2]>>", "Se esperaba el nombre del objeto a colocar."),
        ("colocar silla1 en [1, 0, 2]>>", "Se esperaba '['"),
        ("mover silla1 a [2, 0, 3]>>", "Se esperaba '['"),
        ("colocar silla1 [1, 0]>>", "Se esperaba ',' despues del componente y."),
        ("rotar silla1 [0, 90, 0, 1]>>", "Se esperaba ']'"),
    ],
)
def test_l025_invalid_spatial_syntax_reports_controlled_error(source, expected):
    parser = make_parser(source)

    with pytest.raises(ValueError):
        parser.parse()

    diagnostic = parser.diagnostics[0]
    assert diagnostic.category.value == "SYNTACTIC"
    assert expected in diagnostic.description
    assert diagnostic.file == "principal.lumi"
