"""Convert facade results to wire data without changing core diagnostic semantics."""

from typing import cast

from lumi_language.diagnostics import Diagnostic
from services.results import CompilationResult, ExecutionResult
from .scene_adapter import scene_plan_dto

from .models import (
    AnalysisStatus, Category, DiagnosticDTO, Limitation, PROTOCOL_VERSION,
    ProgramStatus, Request, ResultPayload, ResultResponse, Stage,
)


def diagnostic_dto(diagnostic: Diagnostic) -> DiagnosticDTO:
    result: DiagnosticDTO = {
        "category": cast(Category, diagnostic.category.value),
        "code": diagnostic.code,
        "file": diagnostic.file,
        "line": diagnostic.line,
        "column": diagnostic.column,
        "description": diagnostic.description,
    }
    if diagnostic.suggestion is not None:
        result["suggestion"] = diagnostic.suggestion
    return result


def adapt_result(
    request: Request, compilation: CompilationResult, execution: ExecutionResult | None = None
) -> ResultResponse:
    diagnostics = execution.diagnostics if execution is not None else compilation.diagnostics
    payload: ResultPayload = {
        "entryFile": compilation.file,
        "analysisStatus": cast(AnalysisStatus, compilation.status.value),
        "stage": cast(Stage, compilation.stage.value),
        "output": list(execution.output) if execution is not None else [],
        "diagnostics": [diagnostic_dto(item) for item in diagnostics],
        "limitations": [cast(Limitation, item.value) for item in compilation.limitations],
        "executionAttempted": execution.execution_attempted if execution is not None else False,
        "capabilities": {
            "scenePlan": False, "debugTrace": False,
            "interactiveInput": False, "cancellation": False,
        },
    }
    if compilation.lexical_error is not None:
        payload["lexicalError"] = compilation.lexical_error
    if (
        execution is not None
        and execution.succeeded
        and execution.scene_plan is not None
        and execution.scene_plan.rooms
    ):
        payload["scenePlan"] = scene_plan_dto(execution.scene_plan)
        payload["capabilities"]["scenePlan"] = True
    return {
        "protocolVersion": PROTOCOL_VERSION,
        "requestId": request.request_id,
        "operation": request.operation,
        "status": cast(ProgramStatus, execution.status.value if execution is not None else compilation.status.value),
        "result": payload,
    }
