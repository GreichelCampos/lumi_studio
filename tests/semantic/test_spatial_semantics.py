"""Static semantic checks for the spatial AST supported by Lumi."""

import pytest

from lumi_language.diagnostics import DiagnosticCategory
from lumi_language.import_resolver import InMemoryImportResolver
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser
from lumi_language.semantic_analyzer import SemanticAnalyzer


def analyze_source(source: str, file: str = "principal.lumi", sources=None):
    resolver = InMemoryImportResolver(sources or {})
    parser = Parser(
        Lexer(source, file).tokenize(),
        import_resolver=resolver,
        file=file,
    )
    program = parser.parse()
    return SemanticAnalyzer().analyze(program, parser.imported_programs)


def codes(result):
    return [diagnostic.code for diagnostic in result.diagnostics]


def test_valid_room_elements_and_operations_are_analyzed():
    result = analyze_source(
        'decimal ancho = 5.0>> habitacion sala(ancho, 4, 3) { '
        'piso suelo { material "madera">> } silla silla1 { color "azul">> } '
        'colocar silla1 [1, 0, 2]>> mover silla1 [2, 0, 1]>> '
        'rotar silla1 [0, 90, 0]>> }'
    )

    assert result.succeeded


def test_room_dimensions_must_be_numeric_and_keep_location():
    result = analyze_source(
        'habitacion sala("ancha", verdadero, 3) { }',
        "dimensiones.lumi",
    )

    assert codes(result) == [
        "SEM_SPATIAL_DIMENSION_NOT_NUMERIC",
        "SEM_SPATIAL_DIMENSION_NOT_NUMERIC",
    ]
    assert [(item.file, item.line) for item in result.diagnostics] == [
        ("dimensiones.lumi", 1),
        ("dimensiones.lumi", 1),
    ]


def test_vector_components_are_checked_from_spatial_operations():
    result = analyze_source(
        'habitacion sala(5, 4, 3) { silla silla1 { } '
        'colocar silla1 [1, "arriba", falso]>> }'
    )

    assert codes(result) == [
        "SEM_VECTOR_COMPONENT_NOT_NUMERIC",
        "SEM_VECTOR_COMPONENT_NOT_NUMERIC",
    ]


def test_color_and_material_must_be_text():
    result = analyze_source(
        'habitacion sala(5, 4, 3) { mesa mesa1 { '
        'color 15>> material verdadero>> } }'
    )

    assert codes(result) == [
        "SEM_SPATIAL_PROPERTY_TYPE_MISMATCH",
        "SEM_SPATIAL_PROPERTY_TYPE_MISMATCH",
    ]


def test_duplicate_elements_share_one_room_namespace():
    result = analyze_source(
        'habitacion sala(5, 4, 3) { silla item { } mesa item { } }'
    )

    assert codes(result) == ["SPA_DUPLICATE_ELEMENT"]


def test_same_element_name_is_allowed_in_different_rooms():
    result = analyze_source(
        'habitacion sala(5, 4, 3) { silla item { } } '
        'habitacion estudio(4, 3, 2.5) { mesa item { } }'
    )

    assert result.succeeded


def test_spatial_reference_must_exist_in_active_room():
    result = analyze_source(
        'habitacion sala(5, 4, 3) { colocar fantasma [0, 0, 0]>> }'
    )

    assert codes(result) == ["SPA_ELEMENT_NOT_FOUND"]


def test_spatial_operation_outside_room_is_rejected():
    result = analyze_source('mover mesa1 [0, 0, 0]>>')

    assert codes(result) == ["SPA_OPERATION_OUTSIDE_ROOM"]


def test_only_one_floor_is_allowed_per_room_at_second_location():
    result = analyze_source(
        'habitacion sala(5, 4, 3) {\n'
        '  piso primero { }\n'
        '  piso segundo { }\n'
        '}',
        "pisos.lumi",
    )

    assert codes(result) == ["SPA_MULTIPLE_FLOORS"]
    diagnostic = result.diagnostics[0]
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "pisos.lumi",
        3,
        3,
    )


def test_orientation_domain_is_validated_semantically():
    result = analyze_source(
        'habitacion sala(5, 4, 3) { '
        'pared diagonal { orientacion "diagonal">> } }'
    )

    assert codes(result) == ["SEM_INVALID_SPATIAL_ORIENTATION"]


def test_door_measurements_and_window_elevation_must_be_numeric():
    result = analyze_source(
        'habitacion sala(5, 4, 3) { '
        'puerta entrada { orientacion "norte">> ancho "grande">> alto 2>> '
        'desplazamiento falso>> } '
        'ventana luz { orientacion "este">> ancho 1>> alto 1>> '
        'desplazamiento 1>> elevacion "alta">> } }'
    )

    assert codes(result) == [
        "SEM_SPATIAL_PROPERTY_TYPE_MISMATCH",
        "SEM_SPATIAL_PROPERTY_TYPE_MISMATCH",
        "SEM_SPATIAL_PROPERTY_TYPE_MISMATCH",
    ]


def test_complete_architectural_elements_and_optional_properties_succeed():
    result = analyze_source(
        'habitacion sala(6, 5, 3) { '
        'pared frente { orientacion "norte">> color "blanco">> material "yeso">> } '
        'puerta entrada { orientacion "norte">> ancho 0.9>> alto 2.1>> '
        'desplazamiento 0.5>> color "cafe">> } '
        'ventana luz { orientacion "sur">> ancho 1.2>> alto 1>> '
        'desplazamiento 2>> elevacion 0.9>> material "vidrio">> } }'
    )

    assert result.succeeded


def test_incomplete_wall_reports_missing_orientation_at_declaration():
    result = analyze_source(
        'habitacion sala(6, 5, 3) {\n  pared frente { color "blanco">> }\n}',
        "arquitectura.lumi",
    )

    assert codes(result) == ["SEM_MISSING_SPATIAL_PROPERTY"]
    diagnostic = result.diagnostics[0]
    assert "orientacion" in diagnostic.description
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "arquitectura.lumi",
        2,
        3,
    )


def test_incomplete_door_reports_every_missing_required_property():
    result = analyze_source(
        'habitacion sala(6, 5, 3) { puerta entrada { ancho 0.9>> } }'
    )

    assert codes(result) == [
        "SEM_MISSING_SPATIAL_PROPERTY",
        "SEM_MISSING_SPATIAL_PROPERTY",
        "SEM_MISSING_SPATIAL_PROPERTY",
    ]
    assert [
        name
        for name in ("orientacion", "alto", "desplazamiento")
        if any(name in diagnostic.description for diagnostic in result.diagnostics)
    ] == ["orientacion", "alto", "desplazamiento"]


def test_incomplete_window_reports_every_missing_required_property():
    result = analyze_source(
        'habitacion sala(6, 5, 3) { ventana luz { orientacion "este">> } }'
    )

    assert codes(result) == ["SEM_MISSING_SPATIAL_PROPERTY"] * 4
    assert all(
        any(name in diagnostic.description for diagnostic in result.diagnostics)
        for name in ("ancho", "alto", "desplazamiento", "elevacion")
    )


def test_second_explicit_wall_for_same_orientation_is_rejected_at_property():
    result = analyze_source(
        'habitacion sala(6, 5, 3) {\n'
        '  pared primera { orientacion "norte">> }\n'
        '  pared segunda { orientacion "norte">> }\n'
        '}',
        "paredes.lumi",
    )

    assert codes(result) == ["SEM_DUPLICATE_WALL_ORIENTATION"]
    diagnostic = result.diagnostics[0]
    assert "norte" in diagnostic.description
    assert (diagnostic.file, diagnostic.line) == ("paredes.lumi", 3)


def test_one_explicit_wall_per_different_orientation_is_allowed():
    result = analyze_source(
        'habitacion sala(6, 5, 3) { '
        'pared norte1 { orientacion "norte">> } '
        'pared sur1 { orientacion "sur">> } '
        'pared este1 { orientacion "este">> } '
        'pared oeste1 { orientacion "oeste">> } }'
    )

    assert result.succeeded


def test_door_and_window_do_not_require_explicit_wall_declarations():
    result = analyze_source(
        'habitacion sala(6, 5, 3) { '
        'puerta entrada { orientacion "norte">> ancho 0.9>> alto 2.1>> '
        'desplazamiento 0.5>> } '
        'ventana luz { orientacion "este">> ancho 1.2>> alto 1>> '
        'desplazamiento 1>> elevacion 0.9>> } }'
    )

    assert result.succeeded


def test_spatial_expressions_resolve_lexical_variables():
    result = analyze_source(
        'decimal base = 1.5>> texto tono = "verde">> '
        'habitacion sala(base * 4, 4, 3) { mesa mesa1 { color tono>> } '
        'colocar mesa1 [base, 0, base + 1]>> }'
    )

    assert result.succeeded


def test_spatial_nodes_inside_control_flow_are_traversed():
    result = analyze_source(
        'habitacion sala(5, 4, 3) { silla silla1 { } '
        'si verdadero { mover fantasma [0, "mal", 0]>> } }'
    )

    assert codes(result) == ["SEM_VECTOR_COMPONENT_NOT_NUMERIC"]


def test_function_spatial_vectors_are_checked_without_inventing_a_room():
    result = analyze_source(
        'funcion vacio ubicar() { mover mesa1 [0, "mal", 0]>> } '
        'habitacion sala(5, 4, 3) { mesa mesa1 { } colocar mesa1 [0, 0, 0]>> '
        'ubicar()>> }'
    )

    assert codes(result) == ["SEM_VECTOR_COMPONENT_NOT_NUMERIC"]


def test_imported_spatial_function_is_analyzed_without_false_room_error():
    result = analyze_source(
        'importar "muebles.lumi" usar mover_mesa>> '
        'habitacion sala(5, 4, 3) { mesa mesa1 { } '
        'colocar mesa1 [0, 0, 0]>> mover_mesa()>> }',
        sources={
            "muebles.lumi": (
                'funcion vacio mover_mesa() { mover mesa1 [1, 0, 1]>> }'
            )
        },
    )

    assert result.succeeded


def test_numeric_literals_and_declared_variables_are_valid_room_dimensions():
    result = analyze_source(
        "decimal ancho = 5.5>> entero largo = 4>> "
        "habitacion sala(ancho, largo + 1, 3) {}"
    )

    assert result.succeeded


def test_undeclared_room_dimension_reports_only_identifier_error():
    result = analyze_source("habitacion sala(faltante + 1, 4, 3) {}")

    assert codes(result) == ["SEM_UNDECLARED_VARIABLE"]


def test_invalid_room_arithmetic_is_reported_without_derived_dimension_error():
    result = analyze_source('habitacion sala("cinco" - 1, 4, 3) {}')

    assert codes(result) == ["SEM_INVALID_BINARY_OPERATION"]


def test_known_non_numeric_room_dimension_has_spatial_type_diagnostic():
    result = analyze_source('habitacion sala("cinco", 4, 3) {}')

    assert codes(result) == ["SEM_SPATIAL_DIMENSION_NOT_NUMERIC"]


@pytest.mark.parametrize(
    "declaration",
    [
        'mesa mesa1 { color tono>> material "madera">> }',
        'piso suelo { color tono>> }',
        'pared norte { orientacion "norte">> material "yeso">> }',
        'puerta entrada { orientacion "norte">> ancho medida + 0.1>> '
        'alto 2>> desplazamiento 0.2>> }',
        'ventana luz { orientacion "sur">> ancho 1>> alto 1>> '
        'elevacion medida>> desplazamiento 0.2>> }',
    ],
)
def test_recognized_properties_accept_compatible_expressions(declaration):
    result = analyze_source(
        f'texto tono = "azul">> decimal medida = 0.9>> {declaration}'
    )

    assert result.succeeded


@pytest.mark.parametrize(
    "declaration",
    [
        "mesa mesa1 { color 12>> }",
        'piso suelo { material falso>> }',
        'puerta entrada { orientacion "norte">> ancho "amplio">> '
        'alto 2>> desplazamiento 0.2>> }',
        'ventana luz { orientacion "sur">> ancho 1>> alto 1>> '
        'desplazamiento 0.2>> elevacion "alta">> }',
    ],
)
def test_recognized_properties_reject_incompatible_types(declaration):
    result = analyze_source(declaration)

    assert codes(result) == ["SEM_SPATIAL_PROPERTY_TYPE_MISMATCH"]


def test_undeclared_property_identifier_does_not_add_property_type_error():
    result = analyze_source(
        'puerta entrada { orientacion "norte">> ancho medida_inexistente>> '
        'alto 2>> desplazamiento 0.2>> }'
    )

    assert codes(result) == ["SEM_UNDECLARED_VARIABLE"]


@pytest.mark.parametrize("operation", ["colocar", "mover", "rotar"])
def test_all_spatial_vector_operations_analyze_each_component(operation):
    result = analyze_source(
        f'{operation} objeto [base + 1, "incorrecto", ausente]>>'
    )

    assert codes(result) == [
        "SEM_UNDECLARED_VARIABLE",
        "SEM_VECTOR_COMPONENT_NOT_NUMERIC",
        "SEM_UNDECLARED_VARIABLE",
        "SPA_OPERATION_OUTSIDE_ROOM",
    ]


def test_function_parameters_and_locals_are_visible_in_spatial_expressions():
    result = analyze_source(
        "funcion vacio crear(decimal ancho) { "
        "decimal alto = ancho / 2>> "
        "habitacion sala(ancho, ancho + 1, alto) { "
        "decimal x = alto - 1>> mover mesa1 [x, ancho, alto]>> } }"
    )

    assert result.succeeded


def test_room_body_is_a_child_scope_and_local_does_not_escape():
    result = analyze_source(
        "habitacion sala(5, 4, 3) { mesa mesa1 {} entero local = 1>> "
        "mover mesa1 [local, 0, 0]>> } mostrar(local)>>"
    )

    assert codes(result) == [
        "SPA_ELEMENT_NOT_PLACED", "SEM_UNDECLARED_VARIABLE",
    ]


def test_spatial_nodes_inside_conditions_and_loops_are_analyzed_statically():
    result = analyze_source(
        "si falso { habitacion sala(ancho_faltante, 4, 3) {} } "
        "mientras falso { mover mesa1 [x_faltante, 0, 0]>> } "
        'repetir 1 { ventana luz { orientacion "sur">> ancho 1>> alto 1>> '
        "desplazamiento 0.2>> elevacion altura_faltante>> } }"
    )

    assert codes(result) == [
        "SEM_UNDECLARED_VARIABLE",
        "SEM_UNDECLARED_VARIABLE",
        "SEM_UNDECLARED_VARIABLE",
    ]


def test_spatial_diagnostic_preserves_expression_location():
    result = analyze_source(
        'habitacion sala(\n  "ancho", 4, 3\n) {}',
        file="espacio.lumi",
    )

    diagnostic = result.diagnostics[0]
    assert diagnostic.category is DiagnosticCategory.SEMANTIC
    assert diagnostic.code == "SEM_SPATIAL_DIMENSION_NOT_NUMERIC"
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "espacio.lumi", 2, 3,
    )


def test_same_failing_expression_is_not_analyzed_twice():
    result = analyze_source(
        "habitacion sala(no_existe, 4, 3) { "
        'puerta entrada { orientacion "norte">> ancho otra_inexistente>> '
        "alto 2>> desplazamiento 0.2>> } }"
    )

    assert codes(result) == [
        "SEM_UNDECLARED_VARIABLE",
        "SEM_UNDECLARED_VARIABLE",
    ]
    assert len(result.diagnostics) == 2


@pytest.mark.parametrize(
    "dimension",
    ["0", "-1", "2 - 2", "-(1 + 2)"],
)
def test_constant_non_positive_dimensions_are_rejected(dimension):
    result = analyze_source(f"habitacion sala({dimension}, 4, 3) {{}}")

    assert codes(result) == ["SPA_INVALID_DIMENSION"]
    assert result.diagnostics[0].category is DiagnosticCategory.SPATIAL


def test_positive_constant_arithmetic_dimension_succeeds():
    result = analyze_source("habitacion sala((2 + 3) * 2, 8 / 2, 3) {}")

    assert result.succeeded


def test_mutable_identifier_value_remains_unknown_to_constant_analysis():
    result = analyze_source(
        "entero ancho = 0>> habitacion sala(ancho, 4, 3) {}"
    )

    assert result.succeeded


def test_constant_division_by_zero_does_not_crash_or_add_spatial_diagnostic():
    result = analyze_source("habitacion sala(1 / 0, 4, 3) {}")

    assert result.succeeded


def test_non_finite_constant_dimension_and_vector_preserve_locations():
    program = {
        "node": "ProgramNode",
        "file": "constantes.lumi",
        "line": 1,
        "column": 1,
        "statements": [{
            "node": "RoomNode",
            "name": "sala",
            "width": {
                "node": "LiteralNode", "value": float("inf"),
                "literal_kind": "decimal", "file": "constantes.lumi",
                "line": 2, "column": 7,
            },
            "length": {
                "node": "LiteralNode", "value": 4, "literal_kind": "entero",
                "file": "constantes.lumi", "line": 2, "column": 12,
            },
            "height": {
                "node": "LiteralNode", "value": 3, "literal_kind": "entero",
                "file": "constantes.lumi", "line": 2, "column": 15,
            },
            "body": [{
                "node": "SpatialObjectDeclarationNode",
                "object_type": "mesa", "name": "mesa1", "properties": [],
                "file": "constantes.lumi", "line": 3, "column": 1,
            }, {
                "node": "PlaceObjectNode", "object_name": "mesa1",
                "file": "constantes.lumi", "line": 3, "column": 3,
                "position": {
                    "node": "VectorNode", "file": "constantes.lumi",
                    "line": 3, "column": 17,
                    "x": {
                        "node": "LiteralNode", "value": float("nan"),
                        "literal_kind": "decimal", "file": "constantes.lumi",
                        "line": 3, "column": 18,
                    },
                    "y": {"node": "LiteralNode", "value": 0, "literal_kind": "entero"},
                    "z": {"node": "LiteralNode", "value": 0, "literal_kind": "entero"},
                },
            }],
        }],
    }

    result = SemanticAnalyzer().analyze(program)

    assert codes(result) == ["SPA_INVALID_DIMENSION", "SPA_INVALID_VECTOR"]
    assert [(item.line, item.column) for item in result.diagnostics] == [
        (2, 7), (3, 18),
    ]


def test_duplicate_property_fixture_reports_only_second_occurrence():
    def text(value, line):
        return {
            "node": "LiteralNode", "value": value, "literal_kind": "texto",
            "file": "propiedades.lumi", "line": line, "column": 20,
        }

    program = {
        "node": "ProgramNode", "file": "propiedades.lumi", "line": 1,
        "column": 1, "statements": [{
            "node": "SpatialObjectDeclarationNode", "object_type": "mesa",
            "name": "mesa1", "file": "propiedades.lumi", "line": 1,
            "column": 1, "properties": [
                {"node": "SpatialPropertyNode", "name": "color",
                 "value": text("rojo", 1), "file": "propiedades.lumi",
                 "line": 1, "column": 10},
                {"node": "SpatialPropertyNode", "name": "color",
                 "value": text("azul", 2), "file": "propiedades.lumi",
                 "line": 2, "column": 9},
            ],
        }],
    }

    result = SemanticAnalyzer().analyze(program)

    assert codes(result) == ["SPA_INVALID_PROPERTY"]
    assert (result.diagnostics[0].line, result.diagnostics[0].column) == (2, 9)


def test_only_direct_second_floor_is_statically_certain():
    direct = analyze_source(
        "habitacion sala(5, 4, 3) { piso uno {} piso dos {} }"
    )
    conditional = analyze_source(
        "habitacion sala(5, 4, 3) { piso uno {} "
        "si verdadero { piso posible {} } }"
    )

    assert codes(direct) == ["SPA_MULTIPLE_FLOORS"]
    assert conditional.succeeded


def test_linear_declaration_placement_move_and_rotation_are_valid():
    result = analyze_source(
        "habitacion sala(5, 4, 3) { mesa mesa1 {} "
        "rotar mesa1 [0, 90, 0]>> colocar mesa1 [1, 0, 1]>> "
        "mover mesa1 [2, 0, 2]>> rotar mesa1 [0, 180, 0]>> }"
    )

    assert result.succeeded


@pytest.mark.parametrize("operation", ["colocar", "mover", "rotar"])
def test_linear_operation_on_missing_element_is_reported(operation):
    result = analyze_source(
        f"habitacion sala(5, 4, 3) {{ {operation} fantasma [0, 0, 0]>> }}"
    )

    assert codes(result) == ["SPA_ELEMENT_NOT_FOUND"]


def test_linear_duplicate_element_is_reported_at_second_declaration():
    result = analyze_source(
        "habitacion sala(5, 4, 3) {\n"
        "  mesa item {}\n"
        "  silla item {}\n"
        "}",
        file="duplicados.lumi",
    )

    diagnostic, = result.diagnostics
    assert diagnostic.code == "SPA_DUPLICATE_ELEMENT"
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "duplicados.lumi", 3, 3,
    )


def test_linear_duplicate_room_is_reported_at_second_declaration():
    result = analyze_source(
        "habitacion sala(5, 4, 3) {}\n"
        "habitacion sala(6, 5, 3) {}",
        file="habitaciones.lumi",
    )

    diagnostic, = result.diagnostics
    assert diagnostic.code == "SPA_DUPLICATE_ROOM"
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "habitaciones.lumi", 2, 1,
    )


def test_linear_repeated_placement_and_move_before_place_are_reported():
    repeated = analyze_source(
        "habitacion sala(5, 4, 3) { mesa mesa1 {} "
        "colocar mesa1 [0, 0, 0]>> colocar mesa1 [1, 0, 1]>> }"
    )
    unplaced = analyze_source(
        "habitacion sala(5, 4, 3) { mesa mesa1 {} "
        "mover mesa1 [1, 0, 1]>> }"
    )

    assert codes(repeated) == ["SPA_ELEMENT_ALREADY_PLACED"]
    assert codes(unplaced) == ["SPA_ELEMENT_NOT_PLACED"]


def test_unplaced_element_and_equal_names_in_different_rooms_are_valid():
    result = analyze_source(
        "habitacion sala(5, 4, 3) { silla item {} } "
        "habitacion oficina(4, 3, 3) { mesa item {} }"
    )

    assert result.succeeded


def test_direct_operation_outside_room_is_reported_once_at_operation():
    result = analyze_source(
        "colocar item [0, 0, 0]>>", file="fuera.lumi",
    )

    diagnostic, = result.diagnostics
    assert diagnostic.code == "SPA_OPERATION_OUTSIDE_ROOM"
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "fuera.lumi", 1, 1,
    )


def test_only_program_wide_errors_inside_control_flow_are_reported():
    result = analyze_source(
        "habitacion sala(5, 4, 3) { mesa mesa1 {} "
        "si verdadero { colocar fantasma [0, 0, 0]>> "
        "colocar mesa1 [0, 0, 0]>> colocar mesa1 [1, 0, 1]>> } "
        "mientras falso { mover mesa1 [0, 0, 0]>> } "
        "repetir 2 { colocar mesa1 [0, 0, 0]>> } "
        "hacer entero i = 0; i < 2; i = i + 1 { "
        "colocar mesa1 [0, 0, 0]>> } }"
    )

    assert codes(result) == [
        "SPA_ELEMENT_ALREADY_PLACED", "SPA_ELEMENT_ALREADY_PLACED",
    ]


def test_if_routes_join_declaration_and_placement_conservatively():
    possible_declaration = analyze_source(
        "habitacion sala(5, 4, 3) { si verdadero { mesa item {} } "
        "rotar item [0, 90, 0]>> }"
    )
    both_declared = analyze_source(
        "habitacion sala(5, 4, 3) { si verdadero { mesa item {} } "
        "sino { silla item {} } rotar item [0, 90, 0]>> }"
    )
    possible_placement = analyze_source(
        "habitacion sala(5, 4, 3) { mesa item {} "
        "si verdadero { colocar item [0, 0, 0]>> } "
        "mover item [1, 0, 1]>> }"
    )
    both_placed = analyze_source(
        "habitacion sala(5, 4, 3) { mesa item {} "
        "si verdadero { colocar item [0, 0, 0]>> } "
        "sino { colocar item [1, 0, 1]>> } mover item [2, 0, 2]>> }"
    )

    assert possible_declaration.succeeded
    assert both_declared.succeeded
    assert possible_placement.succeeded
    assert both_placed.succeeded


def test_same_name_and_placement_in_exclusive_branches_are_not_duplicates():
    result = analyze_source(
        "habitacion sala(5, 4, 3) { si verdadero { mesa item {} "
        "colocar item [0, 0, 0]>> } sino { silla item {} "
        "colocar item [1, 0, 1]>> } mover item [2, 0, 2]>> }"
    )

    assert result.succeeded


def test_switch_cases_and_default_are_independent_routes():
    with_default = analyze_source(
        "habitacion sala(5, 4, 3) { segun 1 { "
        "caso 1: mesa item {} colocar item [0, 0, 0]>> "
        "caso 2: silla item {} colocar item [1, 0, 1]>> "
        "defecto: objeto item {} colocar item [2, 0, 2]>> } "
        "mover item [3, 0, 3]>> }"
    )
    without_default = analyze_source(
        "habitacion sala(5, 4, 3) { segun 1 { "
        "caso 1: mesa item {} } rotar item [0, 90, 0]>> }"
    )

    assert with_default.succeeded
    assert without_default.succeeded


def test_invalid_property_in_optional_branch_keeps_location_without_route_error():
    result = analyze_source(
        'habitacion sala(5, 4, 3) {\n  si verdadero {\n'
        '    mesa item { color 1>> }\n    silla item {}\n  }\n}',
        file="ramas.lumi",
    )

    assert codes(result) == ["SEM_SPATIAL_PROPERTY_TYPE_MISMATCH"]
    assert (result.diagnostics[0].file, result.diagnostics[0].line) == (
        "ramas.lumi", 3,
    )


def test_walls_in_exclusive_branches_do_not_accumulate_orientation_errors():
    result = analyze_source(
        'habitacion sala(5, 4, 3) { si verdadero { pared norte_a { '
        'orientacion "norte">> } } sino { pared norte_b { '
        'orientacion "norte">> } } }'
    )

    assert result.succeeded


def test_called_function_effects_are_applied_at_the_call_site():
    result = analyze_source(
        "funcion vacio preparar() { colocar fantasma [0, 0, 0]>> } "
        "habitacion sala(5, 4, 3) { mesa mesa1 {} preparar()>> "
        "mover mesa1 [1, 0, 1]>> }"
    )

    assert codes(result) == [
        "SPA_ELEMENT_NOT_FOUND",
        "SPA_ELEMENT_NOT_PLACED",
    ]
