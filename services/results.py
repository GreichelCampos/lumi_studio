"""Application results; core AST and diagnostic objects remain unchanged."""

from dataclasses import dataclass, field
from enum import Enum
from types import MappingProxyType
from typing import Mapping

from lumi_language.ast_nodes import ProgramNode
from lumi_language.diagnostics import Diagnostic
from lumi_language.lexer_error import LexicalErrorLocation
from spatial.scene_plan import ScenePlan


class AnalysisStage(str, Enum):
    LEXICAL = "lexical"
    SYNTACTIC = "syntactic"
    SEMANTIC = "semantic"


class CompilationStatus(str, Enum):
    COMPLETED = "completed"
    FAILED = "failed"
    INCOMPLETE = "incomplete"


class AnalysisLimitation(str, Enum):
    SPATIAL_SEMANTICS_UNAVAILABLE = "spatial_semantics_unavailable"


@dataclass(frozen=True, slots=True)
class CompilationResult:
    """An analysis snapshot, not a scene or a transport DTO.

    ``lexical_error`` preserves the exception text. ``lexical_error_location``
    carries the lexer origin internally without introducing a Diagnostic.
    Never infer a code or location from the message.
    AST nodes remain mutable core objects: callers must treat this snapshot as
    read-only and recompile changed source instead of editing the returned AST.
    """

    file: str
    status: CompilationStatus
    stage: AnalysisStage
    diagnostics: tuple[Diagnostic, ...] = ()
    lexical_error: str | None = None
    program: ProgramNode | None = None
    imported_programs: Mapping[str, ProgramNode] = field(
        default_factory=lambda: MappingProxyType({})
    )
    limitations: tuple[AnalysisLimitation, ...] = ()
    lexical_error_location: LexicalErrorLocation | None = None

    @property
    def succeeded(self) -> bool:
        return self.status == CompilationStatus.COMPLETED

    @property
    def can_execute(self) -> bool:
        """Allow the real runtime to report unsupported spatial instructions."""
        return (
            self.status != CompilationStatus.FAILED
            and self.stage == AnalysisStage.SEMANTIC
            and self.program is not None
            and not self.diagnostics
            and self.lexical_error is None
        )


class ExecutionStatus(str, Enum):
    COMPLETED = "completed"
    BLOCKED = "blocked"
    FAILED = "failed"
    INCOMPLETE = "incomplete"


@dataclass(frozen=True, slots=True)
class ExecutionResult:
    """Ordered runtime output and authentic diagnostics, retaining analysis context."""

    compilation: CompilationResult
    status: ExecutionStatus
    output: tuple[str, ...] = ()
    diagnostics: tuple[Diagnostic, ...] = ()
    scene_plan: ScenePlan | None = None

    @property
    def succeeded(self) -> bool:
        return self.status == ExecutionStatus.COMPLETED

    @property
    def execution_attempted(self) -> bool:
        return self.status != ExecutionStatus.BLOCKED
