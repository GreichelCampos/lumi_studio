"""Syntax-only acceptance cases with independent diagnostic expectations."""

from pathlib import Path

import pytest

from lumi_language import ast_nodes as ast
from lumi_language.diagnostics import DiagnosticCategory
from lumi_language.import_resolver import InMemoryImportResolver
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser, ParserError


FIXTURES = Path(__file__).parent / "fixtures" / "frontend"


def read_fixture(group, name):
    data = (FIXTURES / group / name).read_bytes().replace(b"\r\n", b"\n")
    assert not data.startswith(b"\n")
    assert data.endswith(b"\n") and not data.endswith(b"\n\n")
    assert b"\r" not in data and b"\t" not in data
    return data.decode("utf-8")


def parse_valid(name, resolver=None):
    source = read_fixture("valid", name)
    parser = Parser(Lexer(source, name).tokenize(), import_resolver=resolver, file=name)
    program = parser.parse()
    assert isinstance(program, ast.ProgramNode)
    assert program.file == name
    assert parser.diagnostics == []
    return program, parser


def test_variables_expressions():
    program, _ = parse_valid("variables_expressions.lumi")
    main, = program.statements
    assert isinstance(main, ast.MainNode)
    assert [type(node) for node in main.body] == [
        ast.VariableDeclarationNode,
    ] * 6 + [ast.AssignmentNode, ast.ShowNode]
    quantity, half, name, active, data, origin, assignment, show = main.body
    assert [node.type for node in main.body[:6]] == [
        "entero", "decimal", "texto", "booleano", "lista", "vector",
    ]
    assert quantity.name == "cantidad"
    assert isinstance(quantity.value, ast.BinaryExpressionNode)
    assert quantity.value.operator == "+"
    assert quantity.value.right.operator == "*"
    assert (quantity.value.left.value, quantity.value.right.left.value,
            quantity.value.right.right.value) == (2, 3, 4)
    assert half.value.operator == "/" and half.value.left.operator == "-"
    assert half.value.right.value == 2.0
    assert isinstance(name.value, ast.ReadNode)
    assert name.value.message.value == "Nombre:"
    assert active.value.operator == "o"
    assert active.value.left.operator == "y"
    assert isinstance(active.value.left.left, ast.UnaryExpressionNode)
    assert active.value.left.left.operator == "no"
    assert active.value.left.right.operator == ">="
    assert isinstance(data.value, ast.ListNode)
    assert data.value.elements[0].value == 1
    assert isinstance(data.value.elements[1], ast.ListNode)
    assert [node.value for node in data.value.elements[1].elements] == [2, 3]
    assert data.value.elements[2].literal_kind == "nulo"
    assert data.value.elements[2].value is None
    assert isinstance(origin.value, ast.VectorNode)
    assert isinstance(origin.value.x, ast.UnaryExpressionNode)
    assert origin.value.x.operator == "-" and origin.value.x.operand.value == 1
    assert origin.value.y.value == 0 and origin.value.z.operator == "+"
    assert assignment.name == "cantidad" and assignment.value.operator == "+"
    assert isinstance(show.expression, ast.IdentifierNode)
    assert show.expression.name == "nombre"


def test_control_structures():
    program, _ = parse_valid("control_structures.lumi")
    main, = program.statements
    assert isinstance(main, ast.MainNode)
    assert [type(node) for node in main.body] == [
        ast.VariableDeclarationNode, ast.WhileNode, ast.IfNode,
        ast.RepeatNode, ast.ForNode, ast.SwitchNode,
    ]
    declaration, loop, conditional, repeat, for_loop, switch = main.body
    assert declaration.value.value == 0
    assert loop.condition.operator == "<"
    assert isinstance(loop.body[0], ast.AssignmentNode)
    assert loop.body[0].value.operator == "+"
    assert conditional.condition.operator == "=="
    assert conditional.then_body[0].expression.value == "Completo"
    assert conditional.else_body[0].expression.value == "Pendiente"
    assert repeat.count.value == 2
    assert isinstance(repeat.body[0], ast.ShowNode)
    assert isinstance(for_loop.initializer, ast.VariableDeclarationNode)
    assert for_loop.initializer.name == "i"
    assert for_loop.condition.operator == "<"
    assert isinstance(for_loop.update, ast.AssignmentNode)
    assert for_loop.update.name == "i" and for_loop.update.value.operator == "+"
    assert isinstance(for_loop.body[0], ast.ShowNode)
    assert switch.expression.name == "contador"
    assert all(isinstance(case, ast.CaseNode) for case in switch.cases)
    assert [case.value.value for case in switch.cases] == [1, 2]
    assert [case.body[0].expression.value for case in switch.cases] == ["Uno", "Dos"]
    assert len(switch.default_body) == 1
    assert switch.default_body[0].expression.value == "Otro"


def test_functions():
    program, _ = parse_valid("functions.lumi")
    assert [type(node) for node in program.statements] == [
        ast.FunctionDeclarationNode, ast.FunctionDeclarationNode, ast.MainNode,
    ]
    add, greet, main = program.statements
    assert add.name == "sumar" and add.return_type == "entero"
    assert all(isinstance(parameter, ast.ParameterNode) for parameter in add.parameters)
    assert [(parameter.name, parameter.data_type) for parameter in add.parameters] == [
        ("a", "entero"), ("b", "entero"),
    ]
    returned, = add.body
    assert isinstance(returned, ast.ReturnNode)
    assert returned.value.operator == "+"
    assert (returned.value.left.name, returned.value.right.name) == ("a", "b")
    assert greet.name == "saludar" and greet.return_type == "vacio"
    assert greet.parameters == []
    assert isinstance(greet.body[0], ast.ShowNode)
    assert greet.body[0].expression.value == "Hola"
    assert [type(node) for node in main.body] == [
        ast.VariableDeclarationNode, ast.FunctionCallNode, ast.ShowNode,
    ]
    call = main.body[0].value
    assert isinstance(call, ast.FunctionCallNode) and call.name == "sumar"
    assert len(call.arguments) == 2 and call.arguments[0].value == 1
    nested = call.arguments[1]
    assert isinstance(nested, ast.FunctionCallNode) and nested.name == "sumar"
    assert [argument.value for argument in nested.arguments] == [2, 3]
    assert main.body[1].name == "saludar" and main.body[1].arguments == []
    assert main.body[2].expression.name == "resultado"


def test_imports():
    imported_name = "functions.lumi"
    resolver = InMemoryImportResolver({imported_name: read_fixture("valid", imported_name)})
    program, parser = parse_valid("imports.lumi", resolver)
    assert [type(node) for node in program.statements] == [ast.ImportNode, ast.MainNode]
    imported, main = program.statements
    assert (imported.file_name, imported.symbol_name) == (imported_name, "sumar")
    show, = main.body
    assert isinstance(show, ast.ShowNode)
    assert isinstance(show.expression, ast.FunctionCallNode)
    assert show.expression.name == "sumar"
    assert [argument.value for argument in show.expression.arguments] == [4, 5]
    assert set(parser.imported_programs) == {imported_name}
    imported_program = parser.imported_programs[imported_name]
    assert isinstance(imported_program, ast.ProgramNode)
    assert imported_program.file == imported_name
    assert [type(node) for node in imported_program.statements] == [
        ast.FunctionDeclarationNode, ast.FunctionDeclarationNode, ast.MainNode,
    ]
    add = imported_program.statements[0]
    assert add.name == "sumar" and add.file == imported_name
    assert add.body[0].file == imported_name


def test_spatial_declarations():
    program, _ = parse_valid("spatial_declarations.lumi")
    room, = program.statements
    assert isinstance(room, ast.RoomNode) and room.name == "sala"
    assert [dimension.value for dimension in (room.width, room.length, room.height)] == [5, 4, 2.7]
    assert [type(node) for node in room.body] == [
        ast.FloorNode, ast.WallNode, ast.DoorNode, ast.WindowNode,
        ast.SpatialObjectDeclarationNode, ast.PlaceObjectNode,
        ast.MoveObjectNode, ast.RotateObjectNode,
    ]
    assert [node.name for node in room.body[:5]] == [
        "base", "norte", "entrada", "lateral", "mesa1",
    ]
    assert [[(prop.name, prop.value.value) for prop in node.properties]
            for node in room.body[:5]] == [
        [("material", "madera")], [("color", "blanco")],
        [("material", "madera")], [("color", "azul")],
        [("color", "rojo"), ("material", "metal")],
    ]
    assert all(isinstance(prop, ast.SpatialPropertyNode)
               for node in room.body[:5] for prop in node.properties)
    assert room.body[4].object_type == "mesa"
    place, move, rotate = room.body[5:]
    assert [node.object_name for node in (place, move, rotate)] == ["mesa1"] * 3
    assert all(isinstance(vector, ast.VectorNode)
               for vector in (place.position, move.position, rotate.rotation))
    assert [component.value for component in
            (place.position.x, place.position.y, place.position.z)] == [0, 0, 0]
    assert move.position.x.operator == "+"
    assert (move.position.x.left.value, move.position.x.right.value) == (1, 1)
    assert move.position.y.value == 0
    assert move.position.z.operator == "-" and move.position.z.operand.value == 1
    assert [component.value for component in
            (rotate.rotation.x, rotate.rotation.y, rotate.rotation.z)] == [0, 90, 0]


@pytest.mark.parametrize(
    "name,line,column,description",
    [
        pytest.param("missing_parenthesis.lumi", 2, 14,
                     "Se esperaba ')' despues de la expresion. Encontrado: '>>'.", id="missing_parenthesis"),
        pytest.param("unclosed_block.lumi", 3, 1,
                     "Se esperaba '}' para cerrar el bloque. Encontrado: fin de archivo.", id="unclosed_block"),
        pytest.param("incomplete_expression.lumi", 2, 24,
                     "Se esperaba una expresion. Encontrado: '>>'.", id="incomplete_expression"),
        # Positions count the current fixture text, including the renamed import.
        pytest.param("invalid_vector.lumi", 3, 24,
                     "Se esperaba ',' despues del componente y. Encontrado: ']'.", id="invalid_vector"),
        pytest.param("invalid_import.lumi", 1, 27,
                     "Se esperaba 'usar' despues del archivo importado. Encontrado: 'sumar'.", id="invalid_import"),
    ],
)
def test_invalid_program(name, line, column, description):
    source = read_fixture("invalid", name)
    parser = Parser(Lexer(source, name).tokenize(), file=name)
    with pytest.raises(ParserError) as raised:
        parser.parse()
    diagnostic = raised.value.diagnostic
    assert parser.diagnostics == [diagnostic]
    # One comparison reports all fields even when EOF coordinates are incorrect.
    assert {
        "category": diagnostic.category,
        "code": diagnostic.code,
        "file": diagnostic.file,
        "line": diagnostic.line,
        "column": diagnostic.column,
        "description": diagnostic.description,
        "suggestion": diagnostic.suggestion,
    } == {
        "category": DiagnosticCategory.SYNTACTIC,
        "code": "SYN_UNEXPECTED_TOKEN",
        "file": name,
        "line": line,
        "column": column,
        "description": description,
        "suggestion": None,
    }
