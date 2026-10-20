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


@pytest.mark.parametrize("index", [0, 2])
def test_spatial_help_does_not_claim_a_generated_scene(help_sections, index):
    result = CompilerService().compile(help_sections[index]["code"], "ayuda.lumi")
    assert result.status is CompilationStatus.INCOMPLETE
    assert result.diagnostics == ()
    assert result.limitations


def test_type_example_can_be_analyzed_without_claiming_collection_execution(help_sections):
    result = CompilerService().compile(help_sections[1]["code"], "ayuda.lumi")
    assert result.status is CompilationStatus.COMPLETED
    assert result.diagnostics == ()


def test_loop_and_function_help_executes_through_the_real_interpreter(help_sections):
    result = ExecutionService().execute_source(help_sections[3]["code"], "ayuda.lumi")
    assert result.status is ExecutionStatus.COMPLETED
    assert result.diagnostics == ()
    assert result.output == ("0", "1", "2")
