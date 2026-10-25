"""Analyze source through public core APIs; never execute or generate a scene."""

from dataclasses import replace
from types import MappingProxyType
from typing import Mapping

from lumi_language.import_context import _ImportResolutionContext, ModuleRecord, ModuleState
from lumi_language.import_resolver import InMemoryImportResolver
from lumi_language.lexer import Lexer
from lumi_language.lexer_error import LexerError
from lumi_language.parser import Parser, ParserError
from lumi_language.semantic_analyzer import SemanticAnalyzer

from .analysis_capabilities import analysis_limitations
from .results import AnalysisStage, CompilationResult, CompilationStatus


def _source_snapshot(sources: Mapping[str, str]) -> dict[str, str]:
    """Copy supplied sources; retain the resolver's exact-key semantics."""
    snapshot = dict(sources)
    for file, source in snapshot.items():
        if not isinstance(file, str) or not file:
            raise ValueError("Cada archivo debe tener una identidad de texto no vacía.")
        if not isinstance(source, str):
            raise TypeError("El código fuente de cada archivo debe ser texto.")
    return snapshot


class CompilerService:
    """Facade for analysis of one entry and explicitly supplied in-memory imports.

    Only LexerError and ParserError become failed analysis results. Unexpected
    exceptions propagate unchanged with their traceback: they are not student
    diagnostics. No disk access, path normalization or new import policy is added.
    """

    def compile_project(
        self, sources: Mapping[str, str], *, entry_file: str
    ) -> CompilationResult:
        """Require an explicit entry; never select the active editor file."""
        snapshot = _source_snapshot(sources)
        if entry_file not in snapshot:
            raise ValueError("El archivo principal no está en las fuentes recibidas.")
        return self.compile(snapshot[entry_file], entry_file, sources=snapshot)

    def compile(
        self, source: str, file: str, *, sources: Mapping[str, str] | None = None
    ) -> CompilationResult:
        """Analyze without executing; retain the existing public result contract."""
        result, _ = self._compile_with_dependencies(source, file, sources=sources)
        return result

    def _compile_with_dependencies(
        self, source: str, file: str, *, sources: Mapping[str, str] | None = None
    ) -> tuple[CompilationResult, _ImportResolutionContext]:
        """Internal entry: return reached dependencies, including partial failures."""
        context = _ImportResolutionContext()
        result = self._compile(source, file, sources=sources, context=context)
        result = replace(
            result, _compiled_programs=MappingProxyType(context.successful_programs),
        )
        return result, context

    def _compile(
        self, source: str, file: str, *, sources: Mapping[str, str] | None,
        context: _ImportResolutionContext,
    ) -> CompilationResult:
        if not isinstance(source, str):
            raise TypeError("El código fuente debe ser texto.")
        if not isinstance(file, str) or not file:
            raise ValueError("El archivo debe tener una identidad de texto no vacía.")
        snapshot = _source_snapshot(sources if sources is not None else {})
        if file in snapshot and snapshot[file] != source:
            raise ValueError("Hay dos contenidos distintos para el archivo principal.")

        try:
            tokens = Lexer(source, file).tokenize()
        except LexerError as error:
            context.modules[file] = ModuleRecord(
                file, ModuleState.FAILED, failure_kind="LexerError",
            )
            return CompilationResult(
                file, CompilationStatus.FAILED, AnalysisStage.LEXICAL,
                lexical_error=str(error),
                lexical_error_location=error.location,
            )

        parser = Parser(
            tokens, import_resolver=InMemoryImportResolver(snapshot), file=file,
            _import_context=context,
        )
        try:
            program = parser.parse()
        except LexerError as error:
            # Imported sources are tokenized by the parser, not by this facade.
            return CompilationResult(
                file, CompilationStatus.FAILED, AnalysisStage.LEXICAL,
                diagnostics=tuple(parser.diagnostics), lexical_error=str(error),
                lexical_error_location=error.location,
            )
        except ParserError as error:
            diagnostics = list(parser.diagnostics)
            if error.diagnostic not in diagnostics:
                diagnostics.append(error.diagnostic)
            return CompilationResult(
                file, CompilationStatus.FAILED, AnalysisStage.SYNTACTIC,
                diagnostics=tuple(diagnostics),
            )

        imports = MappingProxyType(dict(parser.imported_programs))
        if parser.diagnostics:
            return CompilationResult(
                file, CompilationStatus.FAILED, AnalysisStage.SYNTACTIC,
                diagnostics=tuple(parser.diagnostics), program=program,
                imported_programs=imports,
            )

        # The catalog supports explicit imports inside imported bodies. It does
        # not define symbols; the public import map remains direct imports.
        semantic = SemanticAnalyzer().analyze(program, context.successful_programs)
        limitations = analysis_limitations(context.successful_programs.values())
        status = CompilationStatus.COMPLETED
        if semantic.diagnostics:
            status = CompilationStatus.FAILED
        elif limitations:
            status = CompilationStatus.INCOMPLETE
        return CompilationResult(
            file, status, AnalysisStage.SEMANTIC,
            diagnostics=tuple(semantic.diagnostics), program=program,
            imported_programs=imports, limitations=limitations,
        )
