"""Wire contracts. No AST, synthetic diagnostics, scenes or traces cross this boundary."""

from dataclasses import dataclass
from typing import Literal, NotRequired, TypedDict

from .scene_adapter import ScenePlanDTO

PROTOCOL_VERSION = "1.0.0"
MAX_REQUEST_BYTES = 1_048_576
MAX_RESPONSE_BYTES = 4_194_304
MAX_SOURCE_BYTES = 262_144
MAX_FILES = 128
MAX_REQUEST_ID_BYTES = 128
MAX_SESSION_REQUESTS = 10_000
MAX_JSON_DEPTH = 64

Operation = Literal["analyze", "execute"]
AnalysisStatus = Literal["completed", "failed", "incomplete"]
Stage = Literal["lexical", "syntactic", "semantic"]
Limitation = Literal["spatial_semantics_unavailable"]
Category = Literal["LEXICAL", "SYNTACTIC", "SEMANTIC", "IMPORT", "RUNTIME", "SPATIAL"]
ProgramStatus = Literal["completed", "failed", "incomplete", "blocked"]
ProtocolErrorCode = Literal[
    "MALFORMED_JSON", "INVALID_UTF8", "INVALID_REQUEST", "UNSUPPORTED_VERSION",
    "UNKNOWN_OPERATION", "REQUEST_TOO_LARGE", "DUPLICATE_REQUEST_ID",
    "SESSION_LIMIT_REACHED",
]


@dataclass(frozen=True, slots=True)
class Request:
    request_id: str
    operation: Operation
    entry_file: str
    files: dict[str, str]


class DiagnosticDTO(TypedDict):
    category: Category
    code: str
    file: str
    line: int
    column: int
    description: str
    suggestion: NotRequired[str]


class Capabilities(TypedDict):
    scenePlan: bool
    debugTrace: Literal[False]
    interactiveInput: Literal[False]
    cancellation: Literal[False]


class ResultPayload(TypedDict):
    entryFile: str
    analysisStatus: AnalysisStatus
    stage: Stage
    output: list[str]
    diagnostics: list[DiagnosticDTO]
    limitations: list[Limitation]
    lexicalError: NotRequired[str]
    scenePlan: NotRequired[ScenePlanDTO]
    executionAttempted: bool
    capabilities: Capabilities


class ResultResponse(TypedDict):
    protocolVersion: str
    requestId: str
    operation: Operation
    status: ProgramStatus
    result: ResultPayload


class ErrorDetail(TypedDict):
    kind: Literal["protocol", "infrastructure"]
    code: str
    message: str


class ErrorResponse(TypedDict):
    protocolVersion: str
    requestId: str | None
    operation: Operation | None
    status: Literal["error"]
    error: ErrorDetail


Response = ResultResponse | ErrorResponse
