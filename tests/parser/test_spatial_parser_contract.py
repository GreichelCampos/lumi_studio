"""Parser contract for walls, doors, and windows."""

import pytest

from lumi_language.ast_adapter import normalize_ast
from lumi_language.ast_nodes import (
    BinaryExpressionNode,
    DoorNode,
    FunctionCallNode,
    IdentifierNode,
    LiteralNode,
    ShowNode,
    SpatialObjectDeclarationNode,
    WallNode,
    WindowNode,
)
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser, ParserError


def parser_for(source: str, file: str = "espacio.lumi") -> Parser:
    return Parser(Lexer(source, file).tokenize())


def parse_declaration(source: str):
    return parser_for(source).parse().statements[0]


def properties_by_name(declaration):
    return {item.name: item.value for item in declaration.properties}


def test_wall_preserves_orientation_and_optional_properties():
    wall = parse_declaration(
        'pared principal { orientacion "norte">> color "blanco">> '
        'material "pintura">> }'
    )

    assert isinstance(wall, WallNode)
    assert wall.name == "principal"
    assert [item.name for item in wall.properties] == [
        "orientacion", "color", "material",
    ]
    assert properties_by_name(wall)["orientacion"].value == "norte"


@pytest.mark.parametrize("orientation", ["norte", "sur", "este", "oeste"])
def test_all_orientation_literals_are_accepted_syntactically(orientation):
    wall = parse_declaration(
        f'pared cara {{ orientacion "{orientation}">> }}'
    )

    assert properties_by_name(wall)["orientacion"].value == orientation


def test_orientation_domain_is_left_to_semantic_validation():
    wall = parse_declaration('pared cara { orientacion "diagonal">> }')

    assert properties_by_name(wall)["orientacion"].value == "diagonal"


def test_door_accepts_complete_properties_in_any_order():
    door = parse_declaration(
        'puerta entrada { material "madera">> desplazamiento 0.5>> '
        'alto 2.1>> orientacion "sur">> ancho 0.9>> color "cafe">> }'
    )

    assert isinstance(door, DoorNode)
    assert [item.name for item in door.properties] == [
        "material", "desplazamiento", "alto", "orientacion", "ancho", "color",
    ]


def test_window_accepts_elevation_and_measure_expressions_unchanged():
    window = parse_declaration(
        'ventana lateral { orientacion "este">> ancho base + 0.5>> '
        'alto calcularAlto(escala)>> desplazamiento margen>> elevacion 0.9>> }'
    )
    values = properties_by_name(window)

    assert isinstance(window, WindowNode)
    assert isinstance(values["ancho"], BinaryExpressionNode)
    assert isinstance(values["ancho"].left, IdentifierNode)
    assert isinstance(values["alto"], FunctionCallNode)
    assert isinstance(values["alto"].arguments[0], IdentifierNode)
    assert isinstance(values["desplazamiento"], IdentifierNode)
    assert isinstance(values["elevacion"], LiteralNode)


@pytest.mark.parametrize(
    "source",
    [
        'pared cara { orientacion "norte">> orientacion "sur">> }',
        'puerta entrada { ancho 1>> ancho 2>> }',
        'ventana luz { elevacion 1>> elevacion 2>> }',
    ],
)
def test_duplicate_spatial_properties_are_rejected(source):
    with pytest.raises(ParserError, match="no puede repetirse"):
        parser_for(source).parse()


@pytest.mark.parametrize(
    "source, unexpected",
    [
        ('pared cara { ancho 2>> }', "ancho"),
        ('puerta entrada { elevacion 1>> }', "elevacion"),
        ('ventana luz { profundidad 1>> }', "profundidad"),
    ],
)
def test_properties_not_allowed_for_element_are_rejected(source, unexpected):
    parser = parser_for(source)

    with pytest.raises(ParserError):
        parser.parse()

    assert parser.diagnostics[0].line == 1
    assert parser.diagnostics[0].description.endswith(
        f"Encontrado: '{unexpected}'."
    )


@pytest.mark.parametrize(
    "source",
    [
        "pared cara { orientacion norte>> }",
        "puerta entrada { ancho (1 + )>> }",
        "ventana luz { elevacion >> }",
    ],
)
def test_malformed_spatial_property_values_are_rejected(source):
    with pytest.raises(ParserError):
        parser_for(source).parse()


@pytest.mark.parametrize(
    "source, node_type",
    [
        ("pared cara { }", WallNode),
        ("puerta entrada { ancho 0.9>> }", DoorNode),
        ("ventana luz { orientacion \"oeste\">> }", WindowNode),
    ],
)
def test_incomplete_legacy_declarations_remain_syntactically_valid(
    source, node_type,
):
    assert isinstance(parse_declaration(source), node_type)


def test_element_property_and_expression_locations_are_preserved():
    window = parser_for(
        '\n  ventana lateral {\n    elevacion base + 0.9>>\n  }',
        "cuarto.lumi",
    ).parse().statements[0]
    elevation = window.properties[0]

    assert (window.file, window.line, window.column) == ("cuarto.lumi", 2, 3)
    assert (elevation.file, elevation.line, elevation.column) == (
        "cuarto.lumi", 3, 5,
    )
    assert (elevation.value.file, elevation.value.line, elevation.value.column) == (
        "cuarto.lumi", 3, 15,
    )


def test_spatial_ast_serialization_keeps_structure_and_source_data():
    window = parse_declaration(
        'ventana lateral { orientacion "este">> elevacion 0.9>> }'
    )
    serialized = normalize_ast(window)

    assert serialized["node"] == "WindowNode"
    assert serialized["name"] == "lateral"
    assert [item["node"] for item in serialized["properties"]] == [
        "SpatialPropertyNode", "SpatialPropertyNode",
    ]
    assert serialized["properties"][0]["value"]["node"] == "LiteralNode"
    assert serialized["properties"][0]["file"] == "espacio.lumi"


def test_recovery_continues_after_invalid_spatial_declaration():
    parser = parser_for(
        'pared cara { ancho 2>> } mostrar("continua")>>'
    )
    program = parser.parse_with_recovery()

    assert parser.diagnostics
    assert any(isinstance(statement, ShowNode) for statement in program.statements)


def test_generic_spatial_declarations_remain_compatible():
    table = parse_declaration(
        'mesa mesa1 { material "madera">> color tono + sufijo>> }'
    )

    assert isinstance(table, SpatialObjectDeclarationNode)
    assert [item.name for item in table.properties] == ["material", "color"]
    assert isinstance(table.properties[1].value, BinaryExpressionNode)


def test_contextual_property_names_remain_identifiers_outside_spatial_blocks():
    program = parser_for(
        "ancho = 1>> alto = 2>> desplazamiento = 3>> elevacion = 4>> "
        "orientacion = 5>>"
    ).parse()

    assert len(program.statements) == 5
