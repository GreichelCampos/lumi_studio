"""Tests for isolated geometry normalization and pure spatial mathematics."""

import pytest

from lumi_language.interpreter import Interpreter
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser
from spatial.geometry import (
    AxisAlignedBounds,
    GeometryNormalizationError,
    GeometryNormalizationReason,
    OrientedBox,
    Point3,
    box_vertices,
    box_within_bounds,
    boxes_intersect,
    normalize_spatial_geometry,
)
from spatial.scene_plan import SourceLocation, SpatialProperty


def source(line=1, column=1):
    return SourceLocation("geometria.lumi", line, column)


def prop(name, value, line=1, column=1):
    return SpatialProperty(name, value, source(line, column))


def test_wall_normalization_preserves_values_and_individual_sources():
    orientation = prop("orientacion", "norte", 2, 5)
    color = prop("color", "blanco", 3, 5)

    result = normalize_spatial_geometry("wall", (orientation, color))

    assert result.orientation is orientation
    assert result.color is color
    assert result.orientation.source == source(2, 5)
    assert result.width is None
    assert result.material is None


def test_door_normalization_does_not_invent_missing_properties_or_defaults():
    width = prop("ancho", 0.9, 4, 7)

    result = normalize_spatial_geometry("door", (width,))

    assert result.width is width
    assert result.orientation is None
    assert result.height is None
    assert result.offset is None
    assert result.elevation is None


def test_window_normalization_preserves_all_resolved_geometry():
    properties = (
        prop("orientacion", "este"),
        prop("ancho", 1.4),
        prop("alto", 1.0),
        prop("desplazamiento", -0.5),
        prop("elevacion", 0.9),
        prop("material", "vidrio"),
    )

    result = normalize_spatial_geometry("window", properties)

    assert result.orientation.value == "este"
    assert result.width.value == 1.4
    assert result.height.value == 1.0
    assert result.offset.value == -0.5
    assert result.elevation.value == 0.9
    assert result.material.value == "vidrio"


def test_runtime_expressions_are_resolved_before_normalization():
    program = Parser(
        Lexer(
            'decimal base = 0.7>> habitacion sala(5, 4, 3) { '
            'ventana luz { orientacion "oeste">> ancho base * 2>> '
            'alto base + 0.3>> desplazamiento -base>> elevacion base + 0.2>> } }',
            "expresiones.lumi",
        ).tokenize()
    ).parse()

    runtime = Interpreter().execute(program)
    window = runtime.scene_plan.rooms[0].elements[0]
    result = normalize_spatial_geometry(window.element_kind, window.properties)

    assert result.width.value == pytest.approx(1.4)
    assert result.height.value == pytest.approx(1.0)
    assert result.offset.value == pytest.approx(-0.7)
    assert result.elevation.value == pytest.approx(0.9)
    assert result.width.source.file == "expresiones.lumi"


@pytest.mark.parametrize("value", ["grande", True, None])
def test_numeric_geometry_rejects_incompatible_resolved_types(value):
    invalid = prop("ancho", value, 8, 4)

    with pytest.raises(GeometryNormalizationError) as captured:
        normalize_spatial_geometry("door", (invalid,))

    assert captured.value.reason is GeometryNormalizationReason.TYPE_MISMATCH
    assert captured.value.property_name == "ancho"
    assert captured.value.source == source(8, 4)


@pytest.mark.parametrize("value", [float("nan"), float("inf"), float("-inf")])
def test_numeric_geometry_rejects_non_finite_values(value):
    with pytest.raises(GeometryNormalizationError) as captured:
        normalize_spatial_geometry("window", (prop("elevacion", value),))

    assert captured.value.reason is GeometryNormalizationReason.NOT_FINITE


def test_text_geometry_rejects_non_text_values():
    with pytest.raises(GeometryNormalizationError) as captured:
        normalize_spatial_geometry("wall", (prop("orientacion", 1),))

    assert captured.value.reason is GeometryNormalizationReason.TYPE_MISMATCH


def test_duplicate_property_reports_the_second_source_location():
    properties = (prop("ancho", 1, 2, 3), prop("ancho", 2, 9, 11))

    with pytest.raises(GeometryNormalizationError) as captured:
        normalize_spatial_geometry("door", properties)

    assert captured.value.reason is GeometryNormalizationReason.DUPLICATE_PROPERTY
    assert captured.value.source == source(9, 11)


def test_property_not_supported_by_element_kind_is_controlled():
    with pytest.raises(GeometryNormalizationError) as captured:
        normalize_spatial_geometry("wall", (prop("elevacion", 0.8),))

    assert captured.value.reason is GeometryNormalizationReason.UNKNOWN_PROPERTY


def test_box_inside_explicit_bounds_is_accepted():
    room = AxisAlignedBounds(Point3(-3, 0, -2), Point3(3, 2.8, 2))
    furniture = OrientedBox(Point3(0, 0.5, 0), Point3(0.6, 0.5, 0.4))

    assert box_within_bounds(furniture, room)


def test_box_outside_explicit_bounds_is_rejected():
    room = AxisAlignedBounds(Point3(-3, 0, -2), Point3(3, 2.8, 2))
    furniture = OrientedBox(Point3(2.8, 0.5, 0), Point3(0.6, 0.5, 0.4))

    assert not box_within_bounds(furniture, room)


def test_rotated_vertices_are_used_for_bounds_without_catalog_dimensions():
    room = AxisAlignedBounds(Point3(-1, 0, -2), Point3(1, 2, 2))
    furniture = OrientedBox(
        Point3(0, 0.5, 0),
        Point3(1.5, 0.5, 0.25),
        Point3(0, 90, 0),
    )

    assert box_within_bounds(furniture, room)
    assert len(box_vertices(furniture)) == 8


def test_oriented_boxes_detect_overlap_and_separation():
    first = OrientedBox(Point3(0, 0.5, 0), Point3(1, 0.5, 0.4), Point3(0, 35, 0))
    overlapping = OrientedBox(
        Point3(1, 0.5, 0), Point3(0.5, 0.5, 0.5), Point3(0, -20, 0)
    )
    separate = OrientedBox(Point3(4, 0.5, 0), Point3(0.5, 0.5, 0.5))

    assert boxes_intersect(first, overlapping, touching_counts=True)
    assert not boxes_intersect(first, separate, touching_counts=True)


def test_touching_policy_is_explicit_in_collision_check():
    first = OrientedBox(Point3(0, 0, 0), Point3(0.5, 0.5, 0.5))
    second = OrientedBox(Point3(1, 0, 0), Point3(0.5, 0.5, 0.5))

    assert boxes_intersect(first, second, touching_counts=True)
    assert not boxes_intersect(first, second, touching_counts=False)
