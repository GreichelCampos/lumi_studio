"""Execute previously analyzed programs through the real Lumi interpreter."""

from typing import Callable, Mapping

from lumi_language.interpreter import Interpreter

from .compiler_service import CompilerService
from .results import (
    CompilationResult, CompilationStatus, ExecutionResult, ExecutionStatus,
)


class InputUnavailableError(RuntimeError):
    """Host input is unavailable; this is not a Lumi language diagnostic."""


def _unavailable_input(prompt: str) -> str:
    raise InputUnavailableError(
        "La ejecución requiere un proveedor de entrada configurado."
    )


def _create_interpreter() -> Interpreter:
    # Do not block on terminal input in a service intended for IDE integration.
    return Interpreter(input_provider=_unavailable_input)


class ExecutionService:
    """Reuse analysis or compile source, then invoke an isolated runtime instance.

    Program failures return core diagnostics. Infrastructure errors, provider
    failures and unexpected core defects propagate unchanged, never as invented
    diagnostics. Inject a factory to configure input or core loop limits, e.g.
    ``lambda: Interpreter(input_provider=provider, max_loop_iterations=100)``.
    """

    def __init__(
        self,
        compiler_service: CompilerService | None = None,
        *,
        interpreter_factory: Callable[[], Interpreter] = _create_interpreter,
    ) -> None:
        self._compiler = (
            compiler_service if compiler_service is not None else CompilerService()
        )
        self._interpreter_factory = interpreter_factory

    def execute_source(
        self, source: str, file: str, *, sources: Mapping[str, str] | None = None
    ) -> ExecutionResult:
        compilation = self._compiler.compile(source, file, sources=sources)
        return self.execute(compilation)

    def execute(self, compilation: CompilationResult) -> ExecutionResult:
        """Execute the snapshot as supplied; no recompilation or scene simulation."""
        program = compilation.program
        if not compilation.can_execute or program is None:
            return ExecutionResult(
                compilation, ExecutionStatus.BLOCKED,
                diagnostics=compilation.diagnostics,
            )

        runtime = self._interpreter_factory().execute(
            program, dict(compilation.imported_programs)
        )
        status = ExecutionStatus.COMPLETED
        if runtime.diagnostics:
            status = ExecutionStatus.FAILED
        elif compilation.status == CompilationStatus.INCOMPLETE:
            # An uncalled spatial function may not trigger a runtime diagnostic.
            status = ExecutionStatus.INCOMPLETE
        return ExecutionResult(
            compilation, status, tuple(runtime.output), tuple(runtime.diagnostics)
        )
