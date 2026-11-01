"""Static semantic checks for the spatial AST supported by Lumi."""

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

    assert codes(result) == ["SEM_DUPLICATE_SPATIAL_ELEMENT"]


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

    assert codes(result) == ["SEM_UNDECLARED_SPATIAL_ELEMENT"]


def test_spatial_operation_outside_room_is_rejected():
    result = analyze_source('mover mesa1 [0, 0, 0]>>')

    assert codes(result) == ["SEM_SPATIAL_OPERATION_OUTSIDE_ROOM"]


def test_only_one_floor_is_allowed_per_room_at_second_location():
    result = analyze_source(
        'habitacion sala(5, 4, 3) {\n'
        '  piso primero { }\n'
        '  piso segundo { }\n'
        '}',
        "pisos.lumi",
    )

    assert codes(result) == ["SEM_MULTIPLE_FLOORS"]
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
        'ventana luz { orientacion "este">> elevacion "alta">> } }'
    )

    assert codes(result) == [
        "SEM_SPATIAL_PROPERTY_TYPE_MISMATCH",
        "SEM_SPATIAL_PROPERTY_TYPE_MISMATCH",
        "SEM_SPATIAL_PROPERTY_TYPE_MISMATCH",
    ]


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

    assert codes(result) == [
        "SEM_UNDECLARED_SPATIAL_ELEMENT",
        "SEM_VECTOR_COMPONENT_NOT_NUMERIC",
    ]


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
