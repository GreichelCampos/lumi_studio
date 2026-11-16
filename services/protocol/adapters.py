"""Convert facade results to wire data without changing core diagnostic semantics."""

from typing import cast

from lumi_language.diagnostics import Diagnostic, serialize_diagnostic
from services.results import CompilationResult, ExecutionResult
from .debug_trace_adapter import adapt_spatial_debug_trace
from .scene_adapter import scene_plan_dto
from .serialization import response_size_bytes

from .models import (
    AnalysisStatus, DiagnosticDTO, Limitation, MAX_RESPONSE_BYTES, PROTOCOL_VERSION,
    ProgramStatus, Request, ResultPayload, ResultResponse, Stage,
)


def diagnostic_dto(diagnostic: Diagnostic) -> DiagnosticDTO:
    return cast(DiagnosticDTO, serialize_diagnostic(diagnostic))


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
    response: ResultResponse = {
        "protocolVersion": PROTOCOL_VERSION,
        "requestId": request.request_id,
        "operation": request.operation,
        "status": cast(ProgramStatus, execution.status.value if execution is not None else compilation.status.value),
        "result": payload,
    }
    if execution is not None:
        adapted_trace = adapt_spatial_debug_trace(
            execution.spatial_trace,
            request.files,
            available_bytes=MAX_RESPONSE_BYTES,
        )
        if adapted_trace.available:
            payload["debugSteps"] = list(adapted_trace.debug_steps)
            payload["capabilities"]["debugTrace"] = True
            if response_size_bytes(response) > MAX_RESPONSE_BYTES:
                del payload["debugSteps"]
                payload["capabilities"]["debugTrace"] = False
                payload["debugTraceUnavailableReason"] = (
                    "response_size_exceeded"
                )
        elif adapted_trace.unavailable_reason is not None:
            payload["debugTraceUnavailableReason"] = (
                adapted_trace.unavailable_reason
            )
        if (
            "debugTraceUnavailableReason" in payload
            and response_size_bytes(response) > MAX_RESPONSE_BYTES
        ):
            del payload["debugTraceUnavailableReason"]
    return response
