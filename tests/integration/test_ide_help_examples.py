import json
from pathlib import Path
import shutil
import subprocess

import pytest

from lumi_language.lexer import Lexer
from lumi_language.parser import Parser
from services.compiler_service import CompilerService
from services.execution_service import ExecutionService
from services.results import CompilationStatus, ExecutionStatus


@pytest.fixture(scope="module")
def help_sections():
    root = Path(__file__).resolve().parents[2]
    module = root / "apps/desktop/renderer/src/data/documentation.ts"
    node = shutil.which("node")
    assert node is not None, "Validar la ayuda del IDE requiere Node.js 24."
    script = (
        f"import {{ LUMI_DOCUMENTATION_SECTIONS }} from {json.dumps(module.as_uri())};"
        "console.log(JSON.stringify(LUMI_DOCUMENTATION_SECTIONS));"
    )
    result = subprocess.run(
        [node, "--experimental-strip-types", "--input-type=module", "-e", script],
        cwd=root, capture_output=True, check=True, timeout=10,
    )
    return json.loads(result.stdout.decode("utf-8"))


@pytest.mark.parametrize("index", range(5))
def test_published_help_examples_parse_with_the_real_python_parser(help_sections, index):
    section = help_sections[index]
    parser = Parser(Lexer(section["code"], "ayuda.lumi").tokenize())
    program = parser.parse()
    assert parser.diagnostics == [], section["title"]
    assert bool(program.statements) == (index != 4)


def test_complete_spatial_help_reports_completed_without_generated_scene(help_sections):
    result = CompilerService().compile(help_sections[0]["code"], "ayuda.lumi")
    assert result.status is CompilationStatus.COMPLETED
    assert result.limitations == ()
    assert result.diagnostics == ()


def test_architectural_help_executes_with_a_scene(help_sections):
    result = ExecutionService().execute_source(help_sections[2]["code"], "ayuda.lumi")
    assert result.status is ExecutionStatus.COMPLETED
    assert result.diagnostics == ()
    assert result.scene_plan is not None


def test_missing_wall_orientation_suggests_valid_lumi():
    source = 'habitacion sala(5, 4, 3) { pared muro { color "azul">> } }'
    result = ExecutionService().execute_source(source, "ayuda.lumi")
    assert result.status is ExecutionStatus.BLOCKED
    assert result.diagnostics[0].code == "SEM_MISSING_SPATIAL_PROPERTY"
    assert 'orientacion "norte">>' in result.diagnostics[0].suggestion


def test_type_example_can_be_analyzed_without_claiming_collection_execution(help_sections):
    result = CompilerService().compile(help_sections[1]["code"], "ayuda.lumi")
    assert result.status is CompilationStatus.COMPLETED
    assert result.diagnostics == ()


def test_loop_and_function_help_executes_through_the_real_interpreter(help_sections):
    result = ExecutionService().execute_source(help_sections[3]["code"], "ayuda.lumi")
    assert result.status is ExecutionStatus.COMPLETED
    assert result.diagnostics == ()
    assert result.output == ("0", "1", "2")


@pytest.mark.parametrize(("source", "code", "repair"), [
    ('principal { mostrar("Hola" }', "SYN_UNEXPECTED_TOKEN", 'mostrar("Hola")>>'),
    ('entero cantidad =', "SYN_UNEXPECTED_TOKEN", "Falta un valor"),
    ('entero cantidad = 4', "SYN_UNEXPECTED_TOKEN", "'>>'"),
    ('habitacion sala(5 4, 3) {}', "SYN_UNEXPECTED_TOKEN", "coma después del ancho"),
    ('vector punto = (1, 0, 2)>>', "SYN_UNEXPECTED_TOKEN", "[x, y, z]"),
    ('vector punto = [1 0, 2]>>', "SYN_UNEXPECTED_TOKEN", "coma después del componente x"),
    ('habitacion sala(5, 4, 3) { silla s {} colocar s [0]>> }', "SYN_UNEXPECTED_TOKEN", "tres componentes"),
    ('funcion entero suma(ent a) { retornar a>> }', "SYN_UNEXPECTED_TOKEN", "entero cantidad"),
    ('funcion entero suma(entero a entero b) { retornar a + b>> }', "SYN_UNEXPECTED_TOKEN", "parámetros con comas"),
    ('mostrar(suma(1 2))>>', "SYN_UNEXPECTED_TOKEN", "suma(1, 2)"),
    ('lista colores = ["azul" "rojo"]>>', "SYN_UNEXPECTED_TOKEN", '["azul", "rojo"]'),
    ('hacer entero i = 0 i < 3; i = i + 1 { mostrar(i)>> }', "SYN_UNEXPECTED_TOKEN", "';'"),
    ('principal { mostrar(1)>>', "SYN_UNEXPECTED_TOKEN", "cerrar el bloque"),
    ('entero cantidad = "uno">>', "SEM_TYPE_MISMATCH", "variable de tipo 'entero'"),
    ('habitacion sala(0, 4, 3) {}', "SPA_INVALID_DIMENSION", "mayor que cero"),
    ('mostrar(4 / 0)>>', "RUN_DIVISION_BY_ZERO", "cero"),
])
def test_malformed_program_explains_what_to_correct(source, code, repair):
    result = ExecutionService().execute_source("\n" + source, "principal.lumi")
    assert result.status in (ExecutionStatus.BLOCKED, ExecutionStatus.FAILED)
    assert result.scene_plan is None
    diagnostic = result.diagnostics[0]
    assert diagnostic.code == code
    assert (diagnostic.file, diagnostic.line) == ("principal.lumi", 2)
    assert 1 <= diagnostic.column <= len(source) + 1
    assert repair in f"{diagnostic.description} {diagnostic.suggestion or ''}"
