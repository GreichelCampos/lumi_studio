import json
from pathlib import Path

import pytest

from lumi_language.diagnostics import DiagnosticCategory
from lumi_language.semantic_analyzer import TypeChecker
from lumi_language.symbol_table import DataType


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "type_compatibility.json"
LOCATION = {"file": "principal.lumi", "line": 4, "column": 9}


@pytest.fixture(scope="module")
def compatibility_fixture() -> dict:
    with FIXTURE_PATH.open(encoding="utf-8") as fixture_file:
        return json.load(fixture_file)


@pytest.mark.parametrize("case_index", range(5))
def test_valid_assignments(compatibility_fixture, case_index):
    case = compatibility_fixture["valid_assignments"][case_index]

    diagnostic = TypeChecker().check_assignment(
        DataType(case["target"]),
        DataType(case["value"]),
        **LOCATION,
    )

    assert diagnostic is None


@pytest.mark.parametrize("case_index", range(3))
def test_invalid_assignments_report_diagnostic(compatibility_fixture, case_index):
    case = compatibility_fixture["invalid_assignments"][case_index]

    diagnostic = TypeChecker().check_assignment(
        DataType(case["target"]),
        DataType(case["value"]),
        **LOCATION,
    )

    assert diagnostic is not None
    assert diagnostic.category is DiagnosticCategory.SEMANTIC
    assert diagnostic.code == "SEM_TYPE_MISMATCH"
    assert diagnostic.file == LOCATION["file"]
    assert diagnostic.line == LOCATION["line"]
    assert diagnostic.column == LOCATION["column"]


@pytest.mark.parametrize("case_index", range(8))
def test_valid_binary_operations(compatibility_fixture, case_index):
    case = compatibility_fixture["valid_binary_operations"][case_index]

    result = TypeChecker().check_binary_operation(
        DataType(case["left"]),
        case["operator"],
        DataType(case["right"]),
        **LOCATION,
    )

    assert result.is_valid
    assert result.result_type is DataType(case["result"])
    assert result.diagnostic is None


@pytest.mark.parametrize("case_index", range(4))
def test_invalid_binary_operations_report_diagnostic(
    compatibility_fixture,
    case_index,
):
    case = compatibility_fixture["invalid_binary_operations"][case_index]

    result = TypeChecker().check_binary_operation(
        DataType(case["left"]),
        case["operator"],
        DataType(case["right"]),
        **LOCATION,
    )

    assert not result.is_valid
    assert result.result_type is None
    assert result.diagnostic.code == "SEM_INVALID_BINARY_OPERATION"


def test_boolean_not_is_valid():
    result = TypeChecker().check_unary_operation(
        "no",
        DataType.BOOLEAN,
        **LOCATION,
    )

    assert result.is_valid
    assert result.result_type is DataType.BOOLEAN


def test_numeric_negation_preserves_type():
    result = TypeChecker().check_unary_operation(
        "-",
        DataType.DECIMAL,
        **LOCATION,
    )

    assert result.is_valid
    assert result.result_type is DataType.DECIMAL


def test_invalid_unary_operation_reports_diagnostic():
    result = TypeChecker().check_unary_operation(
        "no",
        DataType.STRING,
        **LOCATION,
    )

    assert not result.is_valid
    assert result.diagnostic.code == "SEM_INVALID_UNARY_OPERATION"
