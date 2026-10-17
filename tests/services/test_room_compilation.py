import pytest

from services.compiler_service import CompilerService
from services.execution_service import ExecutionService
from services.results import CompilationStatus, ExecutionStatus


def compile_room(width="5.0", length="4.0", height="2.7"):
    return CompilerService().compile(
        f"principal {{\n    habitacion sala({width}, {length}, {height}) {{\n    }}\n}}",
        "principal.lumi",
    )


def test_acceptance_program_compiles_to_a_real_resolved_scene():
    result = compile_room()
    assert result.status is CompilationStatus.COMPLETED
    assert result.diagnostics == ()
    assert result.limitations == ()
    assert result.scene_plan is not None
    room = result.scene_plan.rooms[0]
    assert room.name == "sala"
    assert [room.width.value, room.length.value, room.height.value] == [5.0, 4.0, 2.7]


@pytest.mark.parametrize("width", ["0", "-1", '"cinco"', "falso"])
def test_invalid_dimensions_fail_with_authentic_spatial_locations(width):
    result = compile_room(width)
    assert result.status is CompilationStatus.FAILED
    assert result.scene_plan is None
    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "SPA_INVALID_DIMENSION"
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == ("principal.lumi", 2, 21)


def test_recompiling_changed_source_changes_dimensions_without_reusing_a_scene():
    first = compile_room()
    second = compile_room("8", "6", "3")
    assert second.scene_plan.rooms[0].width.value == 8
    assert second.scene_plan.rooms[0].length.value == 6
    assert second.scene_plan is not first.scene_plan


@pytest.mark.parametrize("width,length", [("1" + "0" * 200 + ".0", "1" + "0" * 200 + ".0"), ("1" + "0" * 400, "4")])
def test_unrepresentable_dimensions_or_derived_metrics_are_reported_before_serialization(width, length):
    result = compile_room(width, length)
    assert result.status is CompilationStatus.FAILED
    assert result.scene_plan is None
    assert result.diagnostics[0].code == "SPA_INVALID_DIMENSION"


@pytest.mark.parametrize("source", [
    "principal { habitacion sala(5 + 1, 4, 2.7) {} }",
    "principal { si falso { habitacion sala(5, 4, 2.7) {} } }",
    'principal { habitacion sala(5, 4, 2.7) { silla asiento { color "rojo">> } } }',
    "principal { habitacion directa(5,4,2.7) {} si falso { habitacion oculta(3,3,2) {} } }",
    "principal { mientras verdadero {} habitacion sala(5,4,2.7) {} }",
    "mostrar(1)>> principal { habitacion sala(5,4,2.7) {} }",
])
def test_unsupported_spatial_syntax_does_not_publish_partial_scenes(source):
    result = CompilerService().compile(source, "principal.lumi")
    assert result.status is CompilationStatus.INCOMPLETE
    assert result.limitations
    assert result.scene_plan is None


def test_explicit_entry_is_used_instead_of_another_source_file():
    result = CompilerService().compile_project({
        "principal.lumi": "principal { habitacion sala(5, 4, 2.7) {} }",
        "otra.lumi": "@",
    }, entry_file="principal.lumi")
    assert result.status is CompilationStatus.COMPLETED
    assert result.scene_plan.rooms[0].source.file == "principal.lumi"


def test_compilation_support_does_not_claim_interpreter_support():
    result = ExecutionService().execute(compile_room())
    assert result.status is ExecutionStatus.FAILED
    assert result.diagnostics[0].code == "RUN_UNSUPPORTED_NODE"
