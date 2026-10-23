import pytest

from lumi_language.diagnostics import DiagnosticCategory
from spatial.scene_plan import (
    RoomPlan,
    ScenePlan,
    SourceLocation,
    SpatialElement,
    SpatialNumber,
    SpatialProperty,
    Vector3,
)
from spatial.spatial_validator import SpatialValidator


def location(line: int = 1, column: int = 1) -> SourceLocation:
    return SourceLocation(file="principal.lumi", line=line, column=column)


def spatial_number(
    value: object,
    line: int = 1,
    column: int = 1,
) -> SpatialNumber:
    return SpatialNumber(value=value, source=location(line, column))


def room(
    name: str = "sala",
    width: object = 5,
    length: object = 4,
    height: object = 2.7,
    line: int = 1,
    elements: tuple[SpatialElement, ...] = (),
) -> RoomPlan:
    return RoomPlan(
        name=name,
        width=spatial_number(width, line, 18),
        length=spatial_number(length, line, 21),
        height=spatial_number(height, line, 24),
        elements=elements,
        source=location(line),
    )


def scene(*rooms: RoomPlan) -> ScenePlan:
    return ScenePlan(rooms=rooms, source=location())


def vector(
    x: object = 1,
    y: object = 2,
    z: object = 3,
    line: int = 3,
) -> Vector3:
    return Vector3(
        x=spatial_number(x, line, 10),
        y=spatial_number(y, line, 13),
        z=spatial_number(z, line, 16),
        source=location(line, 9),
    )


def element(
    name: str = "silla1",
    position: Vector3 | None = None,
    rotation: Vector3 | None = None,
    properties: tuple[SpatialProperty, ...] = (),
) -> SpatialElement:
    return SpatialElement(
        name=name,
        element_kind="object",
        object_type="silla",
        properties=properties,
        position=position,
        rotation=rotation,
        source=location(2, 5),
    )


def floor(name: str, line: int, column: int = 5) -> SpatialElement:
    return SpatialElement(
        name=name,
        element_kind="floor",
        object_type=None,
        properties=(),
        position=None,
        rotation=None,
        source=location(line, column),
    )


def spatial_property(
    name: str,
    value: object,
    line: int = 3,
    column: int = 9,
    file: str = "principal.lumi",
) -> SpatialProperty:
    return SpatialProperty(
        name=name,
        value=value,
        source=SourceLocation(file, line, column),
    )


def test_valid_room_succeeds():
    result = SpatialValidator().validate(scene(room()))

    assert result.succeeded
    assert result.diagnostics == ()


def test_room_allows_zero_or_one_floor():
    assert SpatialValidator().validate(scene(room())).succeeded
    assert SpatialValidator().validate(
        scene(room(elements=(floor("principal", 2),)))
    ).succeeded


def test_second_floor_is_reported_at_its_source_location():
    plan = scene(
        room(
            elements=(
                floor("principal", 2, 5),
                floor("secundario", 4, 9),
            )
        )
    )

    result = SpatialValidator().validate(plan)

    assert not result.succeeded
    assert len(result.diagnostics) == 1
    diagnostic = result.diagnostics[0]
    assert diagnostic.category is DiagnosticCategory.SPATIAL
    assert diagnostic.code == "SPA_MULTIPLE_FLOORS"
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "principal.lumi",
        4,
        9,
    )
    assert "sala" in diagnostic.description


def test_floor_limit_is_scoped_to_each_room():
    result = SpatialValidator().validate(
        scene(
            room("sala", elements=(floor("sala_piso", 2),)),
            room("cocina", line=5, elements=(floor("cocina_piso", 6),)),
        )
    )

    assert result.succeeded


@pytest.mark.parametrize(
    "invalid_room, dimension_name",
    [
        (room(width=0), "ancho"),
        (room(length=-1), "largo"),
        (room(height=-0.5), "alto"),
    ],
)
def test_non_positive_dimension_is_rejected(invalid_room, dimension_name):
    result = SpatialValidator().validate(scene(invalid_room))

    assert not result.succeeded
    assert len(result.diagnostics) == 1
    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "SPA_INVALID_DIMENSION"
    assert dimension_name in diagnostic.description
    assert "sala" in diagnostic.description


@pytest.mark.parametrize("value", ["cinco", None, True, False])
def test_non_numeric_dimension_is_rejected(value):
    result = SpatialValidator().validate(scene(room(width=value)))

    assert len(result.diagnostics) == 1
    assert result.diagnostics[0].code == "SPA_INVALID_DIMENSION"


@pytest.mark.parametrize(
    "value",
    [float("nan"), float("inf"), float("-inf")],
)
def test_non_finite_dimension_is_rejected(value):
    result = SpatialValidator().validate(scene(room(height=value)))

    assert len(result.diagnostics) == 1
    assert result.diagnostics[0].code == "SPA_INVALID_DIMENSION"


def test_extremely_large_positive_integer_dimension_succeeds():
    result = SpatialValidator().validate(scene(room(width=10**1000)))

    assert result.succeeded


def test_extremely_large_negative_integer_dimension_is_not_positive():
    result = SpatialValidator().validate(scene(room(width=-(10**1000))))

    assert len(result.diagnostics) == 1
    assert result.diagnostics[0].code == "SPA_INVALID_DIMENSION"


def test_validates_multiple_rooms():
    result = SpatialValidator().validate(
        scene(room("sala"), room("cocina", width=0, line=2))
    )

    assert len(result.diagnostics) == 1
    assert "cocina" in result.diagnostics[0].description


def test_accumulates_multiple_dimension_errors():
    result = SpatialValidator().validate(
        scene(
            room("sala", width=0, length=-1),
            room("cocina", height=float("inf"), line=2),
        )
    )

    assert tuple(item.code for item in result.diagnostics) == (
        "SPA_INVALID_DIMENSION",
        "SPA_INVALID_DIMENSION",
        "SPA_INVALID_DIMENSION",
    )


def test_diagnostic_preserves_dimension_source_location():
    invalid_width = SpatialNumber(
        value=0,
        source=SourceLocation("habitaciones.lumi", 8, 17),
    )
    invalid_room = RoomPlan(
        name="comedor",
        width=invalid_width,
        length=spatial_number(4),
        height=spatial_number(3),
        elements=(),
        source=SourceLocation("habitaciones.lumi", 8, 1),
    )

    diagnostic = SpatialValidator().validate(scene(invalid_room)).diagnostics[0]

    assert diagnostic.category is DiagnosticCategory.SPATIAL
    assert diagnostic.file == "habitaciones.lumi"
    assert diagnostic.line == 8
    assert diagnostic.column == 17


def test_invalid_result_has_succeeded_false():
    result = SpatialValidator().validate(scene(room(width=0)))

    assert not result.succeeded


def test_empty_scene_plan_succeeds():
    result = SpatialValidator().validate(scene())

    assert result.succeeded
    assert result.diagnostics == ()


@pytest.mark.parametrize(
    "position",
    [
        vector(1, 0, 2),
        vector(1.5, 0.25, 2.75),
        vector(-3, 0, -1.5),
    ],
)
def test_valid_position_vectors_succeed(position):
    plan = scene(room(elements=(element(position=position),)))

    result = SpatialValidator().validate(plan)

    assert result.succeeded


def test_valid_rotation_succeeds_without_angle_restrictions():
    plan = scene(room(elements=(element(rotation=vector(-450, 0, 720)),)))

    result = SpatialValidator().validate(plan)

    assert result.succeeded


def test_absent_position_and_rotation_succeed():
    result = SpatialValidator().validate(
        scene(room(elements=(element(position=None, rotation=None),)))
    )

    assert result.succeeded


@pytest.mark.parametrize("value", ["uno", None, True, False])
def test_non_numeric_vector_component_is_rejected(value):
    plan = scene(room(elements=(element(position=vector(x=value)),)))

    result = SpatialValidator().validate(plan)

    assert len(result.diagnostics) == 1
    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "SPA_INVALID_VECTOR"
    assert "silla1" in diagnostic.description
    assert "posición" in diagnostic.description
    assert "x" in diagnostic.description


@pytest.mark.parametrize(
    "value",
    [float("nan"), float("inf"), float("-inf")],
)
def test_non_finite_vector_component_is_rejected(value):
    plan = scene(room(elements=(element(rotation=vector(z=value)),)))

    result = SpatialValidator().validate(plan)

    assert len(result.diagnostics) == 1
    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "SPA_INVALID_VECTOR"
    assert "rotación" in diagnostic.description
    assert "z" in diagnostic.description


@pytest.mark.parametrize("value", [10**1000, -(10**1000)])
def test_extremely_large_integer_vector_component_succeeds(value):
    plan = scene(room(elements=(element(position=vector(x=value)),)))

    result = SpatialValidator().validate(plan)

    assert result.succeeded


def test_accumulates_multiple_invalid_vector_components():
    invalid_position = vector("uno", float("nan"), True)
    plan = scene(room(elements=(element(position=invalid_position),)))

    result = SpatialValidator().validate(plan)

    assert tuple(item.code for item in result.diagnostics) == (
        "SPA_INVALID_VECTOR",
        "SPA_INVALID_VECTOR",
        "SPA_INVALID_VECTOR",
    )


def test_accumulates_position_and_rotation_errors():
    invalid_element = element(
        position=vector(x="uno"),
        rotation=vector(y=float("inf"), line=4),
    )

    result = SpatialValidator().validate(
        scene(room(elements=(invalid_element,)))
    )

    assert len(result.diagnostics) == 2
    assert "posición" in result.diagnostics[0].description
    assert "rotación" in result.diagnostics[1].description


def test_accumulates_vector_errors_across_rooms():
    sala = room(
        "sala",
        elements=(element("silla1", position=vector(x="uno")),),
    )
    cocina = room(
        "cocina",
        line=10,
        elements=(
            element("mesa1", rotation=vector(z=float("-inf"), line=12)),
        ),
    )

    result = SpatialValidator().validate(scene(sala, cocina))

    assert len(result.diagnostics) == 2
    assert "silla1" in result.diagnostics[0].description
    assert "mesa1" in result.diagnostics[1].description


def test_accumulates_dimension_and_vector_errors():
    invalid_room = room(
        width=0,
        elements=(element(position=vector(y=float("nan"))),),
    )

    result = SpatialValidator().validate(scene(invalid_room))

    assert tuple(item.code for item in result.diagnostics) == (
        "SPA_INVALID_DIMENSION",
        "SPA_INVALID_VECTOR",
    )
    assert not result.succeeded


def test_vector_diagnostic_preserves_component_source_location():
    invalid_component = SpatialNumber(
        value=float("inf"),
        source=SourceLocation("escena.lumi", 14, 27),
    )
    invalid_position = Vector3(
        x=spatial_number(1),
        y=invalid_component,
        z=spatial_number(3),
        source=SourceLocation("escena.lumi", 14, 20),
    )
    plan = scene(room(elements=(element(position=invalid_position),)))

    diagnostic = SpatialValidator().validate(plan).diagnostics[0]

    assert diagnostic.category is DiagnosticCategory.SPATIAL
    assert diagnostic.file == "escena.lumi"
    assert diagnostic.line == 14
    assert diagnostic.column == 27


@pytest.mark.parametrize(
    "properties",
    [
        (spatial_property("color", "rojo"),),
        (spatial_property("material", "madera"),),
        (
            spatial_property("color", "azul"),
            spatial_property("material", "metal", column=25),
        ),
        (),
    ],
)
def test_valid_spatial_properties_succeed(properties):
    plan = scene(room(elements=(element(properties=properties),)))

    result = SpatialValidator().validate(plan)

    assert result.succeeded


def test_arbitrary_text_property_values_are_allowed():
    properties = (
        spatial_property("color", "ultravioleta personalizado"),
        spatial_property("material", "compuesto experimental", column=30),
    )

    result = SpatialValidator().validate(
        scene(room(elements=(element(properties=properties),)))
    )

    assert result.succeeded


def test_unknown_property_is_rejected_without_type_diagnostic():
    unknown = spatial_property("textura", 42)
    plan = scene(room(elements=(element(properties=(unknown,)),)))

    result = SpatialValidator().validate(plan)

    assert len(result.diagnostics) == 1
    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "SPA_INVALID_PROPERTY"
    assert "textura" in diagnostic.description
    assert "silla1" in diagnostic.description


def test_duplicate_property_reports_second_occurrence():
    properties = (
        spatial_property("color", "rojo", line=3, column=9),
        spatial_property(
            "color",
            "azul",
            line=4,
            column=13,
            file="objetos.lumi",
        ),
    )
    plan = scene(room(elements=(element(properties=properties),)))

    diagnostic = SpatialValidator().validate(plan).diagnostics[0]

    assert diagnostic.code == "SPA_INVALID_PROPERTY"
    assert "color" in diagnostic.description
    assert "silla1" in diagnostic.description
    assert "duplicada" in diagnostic.description
    assert diagnostic.file == "objetos.lumi"
    assert diagnostic.line == 4
    assert diagnostic.column == 13


@pytest.mark.parametrize(
    "name, value",
    [
        ("color", 123),
        ("material", True),
        ("color", None),
    ],
)
def test_non_text_property_value_is_rejected(name, value):
    invalid_property = spatial_property(name, value)
    plan = scene(room(elements=(element(properties=(invalid_property,)),)))

    result = SpatialValidator().validate(plan)

    assert len(result.diagnostics) == 1
    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "SPA_INVALID_PROPERTY"
    assert name in diagnostic.description
    assert "silla1" in diagnostic.description
    assert "valor de texto" in diagnostic.description


def test_same_property_name_on_different_elements_is_not_duplicate():
    first = element(
        "silla1",
        properties=(spatial_property("color", "rojo"),),
    )
    second = element(
        "mesa1",
        properties=(spatial_property("color", "azul", line=6),),
    )

    result = SpatialValidator().validate(
        scene(room(elements=(first, second)))
    )

    assert result.succeeded


def test_accumulates_multiple_property_errors_in_room():
    first = element(
        "silla1",
        properties=(
            spatial_property("color", 10),
            spatial_property("textura", "rugosa", line=4),
        ),
    )
    second = element(
        "mesa1",
        properties=(spatial_property("material", None, line=6),),
    )

    result = SpatialValidator().validate(
        scene(room(elements=(first, second)))
    )

    assert tuple(item.code for item in result.diagnostics) == (
        "SPA_INVALID_PROPERTY",
        "SPA_INVALID_PROPERTY",
        "SPA_INVALID_PROPERTY",
    )


def test_accumulates_property_errors_across_rooms():
    sala = room(
        "sala",
        elements=(
            element(properties=(spatial_property("color", False),)),
        ),
    )
    cocina = room(
        "cocina",
        line=10,
        elements=(
            element(
                "mesa1",
                properties=(spatial_property("acabado", "mate", line=12),),
            ),
        ),
    )

    result = SpatialValidator().validate(scene(sala, cocina))

    assert len(result.diagnostics) == 2
    assert "silla1" in result.diagnostics[0].description
    assert "mesa1" in result.diagnostics[1].description


def test_accumulates_dimension_vector_and_property_errors():
    invalid_element = element(
        position=vector(x=float("nan")),
        properties=(spatial_property("material", 7),),
    )
    invalid_room = room(width=0, elements=(invalid_element,))

    result = SpatialValidator().validate(scene(invalid_room))

    assert tuple(item.code for item in result.diagnostics) == (
        "SPA_INVALID_DIMENSION",
        "SPA_INVALID_VECTOR",
        "SPA_INVALID_PROPERTY",
    )
    assert not result.succeeded


def test_property_diagnostic_preserves_source_location():
    invalid_property = spatial_property(
        "material",
        None,
        line=20,
        column=31,
        file="muebles.lumi",
    )
    plan = scene(
        room(elements=(element(properties=(invalid_property,)),))
    )

    diagnostic = SpatialValidator().validate(plan).diagnostics[0]

    assert diagnostic.category is DiagnosticCategory.SPATIAL
    assert diagnostic.file == "muebles.lumi"
    assert diagnostic.line == 20
    assert diagnostic.column == 31
