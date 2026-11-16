"""Bateria formal de los 20 casos obligatorios de la seccion 18."""

from pathlib import Path

import pytest

from services.execution_service import ExecutionService
from services.results import AnalysisStage, ExecutionStatus


ROOT = Path(__file__).parents[2]
FIXTURES = Path(__file__).parent / "fixtures"


def execute_file(path: Path):
    return ExecutionService().execute_source(
        path.read_text(encoding="utf-8"), path.name
    )


def execute_project(directory: Path):
    sources = {
        path.name: path.read_text(encoding="utf-8")
        for path in sorted(directory.glob("*.lumi"))
    }
    return ExecutionService().execute_source(
        sources["principal.lumi"], "principal.lumi", sources=sources
    )


@pytest.mark.parametrize(
    ("case_id", "relative_path", "expected_output"),
    [
        ("PV-01", "examples/07_Variables_And_Data_Types/01_Data_Types.lumi", None),
        ("PV-02", "examples/10_Conditionals/02_If_Else.lumi", None),
        ("PV-03", "examples/01_Functions/01_function_with_return.lumi", None),
        ("PV-04", "examples/08_Lists_And_Vectors/01_Lists.lumi", None),
        ("PV-05", "examples/06_Walls_Doors_Windows/11_valid_complete_room.lumi", None),
    ],
    ids=lambda value: value if isinstance(value, str) and value.startswith("PV-") else None,
)
def test_programas_validos(case_id, relative_path, expected_output):
    result = execute_file(ROOT / relative_path)

    assert result.compilation.succeeded, (case_id, result.diagnostics)
    assert result.succeeded, (case_id, result.diagnostics)
    assert result.diagnostics == ()
    if expected_output is not None:
        assert result.output == expected_output
    if case_id == "PV-05":
        assert result.scene_plan is not None
        room, = result.scene_plan.rooms
        assert [item.element_kind for item in room.elements].count("wall") == 1
        assert [item.element_kind for item in room.elements].count("door") == 1
        assert [item.element_kind for item in room.elements].count("window") == 1


@pytest.mark.parametrize(
    ("case_id", "filename"),
    [
        ("ES-01", "incomplete_expression.lumi"),
        ("ES-02", "invalid_import.lumi"),
        ("ES-03", "invalid_vector.lumi"),
        ("ES-04", "missing_parenthesis.lumi"),
        ("ES-05", "unclosed_block.lumi"),
    ],
    ids=lambda value: value if isinstance(value, str) and value.startswith("ES-") else None,
)
def test_errores_sintacticos(case_id, filename):
    path = ROOT / "tests/parser/fixtures/frontend/invalid" / filename
    result = execute_file(path)

    assert result.status is ExecutionStatus.BLOCKED
    assert not result.execution_attempted
    assert result.compilation.stage is AnalysisStage.SYNTACTIC
    diagnostic, = result.diagnostics
    assert diagnostic.code.startswith("SYN_")
    assert diagnostic.file == filename
    assert diagnostic.line >= 1 and diagnostic.column >= 1


@pytest.mark.parametrize(
    ("case_id", "relative_path", "expected_code"),
    [
        ("EM-01", "examples/04_Semantic_Errors/01_undeclared_variable.lumi", "SEM_UNDECLARED_VARIABLE"),
        ("EM-02", "examples/04_Semantic_Errors/02_duplicate_variable.lumi", "SEM_DUPLICATE_SYMBOL"),
        ("EM-03", "examples/04_Semantic_Errors/03_assignment_type_mismatch.lumi", "SEM_TYPE_MISMATCH"),
        ("EM-04", "examples/02_Parameters_And_Calls/05_wrong_argument_count.lumi", "SEM_ARGUMENT_COUNT_MISMATCH"),
        ("EM-05", "examples/04_Semantic_Errors/06_variable_out_of_scope.lumi", "SEM_UNDECLARED_VARIABLE"),
    ],
    ids=lambda value: value if isinstance(value, str) and value.startswith("EM-") else None,
)
def test_errores_semanticos(case_id, relative_path, expected_code):
    result = execute_file(ROOT / relative_path)

    assert result.status is ExecutionStatus.BLOCKED
    assert not result.execution_attempted
    assert result.compilation.stage is AnalysisStage.SEMANTIC
    assert [diagnostic.code for diagnostic in result.diagnostics] == [expected_code]
    diagnostic = result.diagnostics[0]
    assert diagnostic.file == Path(relative_path).name
    assert diagnostic.line >= 1 and diagnostic.column >= 1


def test_imp_01_importacion_directa_y_ejecucion():
    result = execute_project(FIXTURES / "import_direct")

    assert result.succeeded
    assert result.output == ("20",)
    assert set(result.compilation.imported_programs) == {"matematica.lumi"}


def test_imp_02_importacion_transitiva_y_ejecucion():
    result = execute_project(FIXTURES / "import_transitive")

    assert result.succeeded
    assert result.output == ("42",)
    assert set(result.compilation._compiled_programs) == {
        "principal.lumi", "fachada.lumi", "base.lumi"
    }


def test_imp_03_aislamiento_de_simbolos_transitivos():
    result = execute_project(FIXTURES / "import_scope")

    assert result.status is ExecutionStatus.BLOCKED
    assert not result.execution_attempted
    diagnostic, = result.diagnostics
    assert diagnostic.code == "SEM_UNDECLARED_FUNCTION"
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "principal.lumi", 5, 13
    )


def test_ic_01_rechaza_ciclo_real_entre_archivos():
    result = execute_project(FIXTURES / "import_cycle")

    assert result.status is ExecutionStatus.BLOCKED
    assert not result.execution_attempted
    diagnostic, = result.diagnostics
    assert diagnostic.code == "IMPORT_CIRCULAR_DEPENDENCY"
    assert diagnostic.file == "b.lumi"
    assert diagnostic.line >= 1 and diagnostic.column >= 1


def test_int_01_proyecto_espacial_integral_multiarchivo():
    result = execute_project(FIXTURES / "integral")

    assert result.succeeded, result.diagnostics
    assert result.output == ("Area integral:", "48")
    assert result.visualization_room == "sala"
    assert result.scene_plan is not None
    room, = result.scene_plan.rooms
    assert [item.element_kind for item in room.elements].count("wall") == 1
    assert [item.element_kind for item in room.elements].count("door") == 1
    assert [item.element_kind for item in room.elements].count("window") == 1
    assert {element.name for element in room.elements} == {
        "suelo", "muro_oeste", "entrada", "ventanal",
        "mesa_centro", "silla_lectura",
    }
    table = next(item for item in room.elements if item.name == "mesa_centro")
    assert (table.position.x.value, table.position.y.value, table.position.z.value) == (
        1.5, 0, 0.5
    )
    assert (table.rotation.x.value, table.rotation.y.value, table.rotation.z.value) == (
        0, 90, 0
    )
    assert result.spatial_trace.complete
