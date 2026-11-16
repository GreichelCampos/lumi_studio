import re
from pathlib import Path

import pytest

from services.compiler_service import CompilerService
from services.execution_service import ExecutionService
from services.results import CompilationStatus, ExecutionStatus


ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "apps/desktop/renderer/src/data/fixtures.ts"


@pytest.fixture(scope="module")
def fixture_sources():
    text = FIXTURES.read_text(encoding="utf-8")

    def content(file_id: str) -> str:
        match = re.search(
            rf"id: '{re.escape(file_id)}',[\s\S]*?content: `([\s\S]*?)`",
            text,
        )
        assert match is not None, f"No se encontró la fixture {file_id}"
        return match.group(1)

    return content


@pytest.mark.parametrize(
    ("file_id", "room", "element_count", "analysis_status"),
    [
        ("casa-ejemplo-principal", "sala", 8, CompilationStatus.INCOMPLETE),
        ("dormitorio-principal", "dormitorio", 9, CompilationStatus.COMPLETED),
        ("oficina-principal", "oficina", 10, CompilationStatus.COMPLETED),
    ],
)
def test_normal_preloaded_projects_execute_with_valid_scene_plans(
    fixture_sources, file_id, room, element_count, analysis_status,
):
    source = fixture_sources(file_id)
    sources = {"principal.lumi": source}
    if file_id == "casa-ejemplo-principal":
        for module_id, name in [
            ("casa-ejemplo-muebles", "muebles.lumi"),
            ("casa-ejemplo-habitaciones", "habitaciones.lumi"),
            ("casa-ejemplo-materiales", "materiales.lumi"),
        ]:
            sources[name] = fixture_sources(module_id)

    compilation = CompilerService().compile_project(
        sources, entry_file="principal.lumi"
    )
    execution = ExecutionService().execute(compilation)

    assert compilation.status is analysis_status
    assert compilation.diagnostics == ()
    assert execution.status is ExecutionStatus.COMPLETED
    assert execution.diagnostics == ()
    assert execution.scene_plan is not None
    assert len(execution.scene_plan.rooms) == 1
    scene_room = execution.scene_plan.rooms[0]
    assert scene_room.name == room
    assert len(scene_room.elements) == element_count


def test_preloaded_spatial_error_demo_remains_an_intentional_failure(fixture_sources):
    source = fixture_sources("demo-error-principal")
    compilation = CompilerService().compile(source, "principal.lumi")
    execution = ExecutionService().execute(compilation)

    assert compilation.status is CompilationStatus.COMPLETED
    assert execution.status is ExecutionStatus.FAILED
    assert execution.scene_plan is None
    assert {diagnostic.code for diagnostic in execution.diagnostics} == {
        "SPA_OBJECT_OUT_OF_BOUNDS",
        "SPA_OBJECT_COLLISION",
    }
