"""Run the fixture-based semantic and interpreter demonstration for L-020."""

import json
from pathlib import Path

from lumi_language.interpreter import Interpreter
from lumi_language.semantic_analyzer import TypeChecker
from lumi_language.symbol_table import DataType


FIXTURE_PATH = (
    Path(__file__).parent / "fixtures" / "semantic_interpreter_demo.json"
)


def load_demo_fixture() -> dict:
    with FIXTURE_PATH.open(encoding="utf-8") as fixture_file:
        return json.load(fixture_file)


def run_demo() -> int:
    """Execute the valid fixture and display one semantic diagnostic."""

    fixture = load_demo_fixture()

    print("=== Ejecución válida ===")
    execution = Interpreter().execute(fixture["valid_program"])
    for output_line in execution.output:
        print(f"Salida: {output_line}")

    print("\n=== Diagnóstico semántico ===")
    invalid = fixture["invalid_assignment"]
    diagnostic = TypeChecker().check_assignment(
        DataType(invalid["target_type"]),
        DataType(invalid["value_type"]),
        file=invalid["file"],
        line=invalid["line"],
        column=invalid["column"],
    )

    if diagnostic is not None:
        print(
            f"[{diagnostic.code}] "
            f"{diagnostic.file}:{diagnostic.line}:{diagnostic.column}"
        )
        print(diagnostic.description)
        if diagnostic.suggestion:
            print(f"Sugerencia: {diagnostic.suggestion}")

    return 0 if execution.succeeded and diagnostic is not None else 1


if __name__ == "__main__":
    raise SystemExit(run_demo())
