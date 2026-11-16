"""Analyze source through public core APIs; never execute or generate a scene."""

from dataclasses import fields, is_dataclass, replace
from types import MappingProxyType
from typing import Mapping

from lumi_language.diagnostics import Diagnostic, DiagnosticCategory
from lumi_language.import_context import _ImportResolutionContext, ModuleRecord, ModuleState
from lumi_language.import_resolver import InMemoryImportResolver
from lumi_language.ast_nodes import (
    FunctionDeclarationNode,
    ImportNode,
    MainNode,
    VariableDeclarationNode,
)
from lumi_language.lexer import Lexer
from lumi_language.lexer_error import LexerError
from lumi_language.parser import Parser, ParserError
from lumi_language.semantic_analyzer import SemanticAnalyzer

from .analysis_capabilities import analysis_limitations
from .results import AnalysisStage, CompilationResult, CompilationStatus


MAX_AST_DEPTH = 128


def _entry_point_diagnostics(
    program, entry_file: str, imported_programs: Mapping[str, object],
) -> list[Diagnostic]:
    """Validate entry points from parsed structure, never from source text."""
    diagnostics: list[Diagnostic] = []
    top_level_mains = [
        node for node in program.statements if isinstance(node, MainNode)
    ]
    all_entry_mains = list(_main_nodes(program))
    if not top_level_mains:
        diagnostics.append(Diagnostic(
            category=DiagnosticCategory.SEMANTIC,
            code="SEM_ENTRY_POINT_MISSING",
            file=entry_file, line=1, column=1,
            description="El archivo principal debe contener un bloque 'principal'.",
            suggestion="Agregá exactamente un bloque principal { ... } al archivo designado.",
        ))
    elif len(top_level_mains) > 1:
        for duplicate in top_level_mains[1:]:
            diagnostics.append(Diagnostic(
                category=DiagnosticCategory.SEMANTIC,
                code="SEM_ENTRY_POINT_DUPLICATE",
                file=duplicate.file, line=duplicate.line, column=duplicate.column,
                description="El archivo principal contiene más de un bloque 'principal'.",
                suggestion="Conservá un solo bloque principal en el archivo designado.",
            ))
    top_level_main_ids = {id(node) for node in top_level_mains}
    for nested in all_entry_mains:
        if id(nested) not in top_level_main_ids:
            diagnostics.append(Diagnostic(
                category=DiagnosticCategory.SEMANTIC,
                code="SEM_ENTRY_POINT_INVALID_LOCATION",
                file=nested.file, line=nested.line, column=nested.column,
                description="El bloque 'principal' debe declararse en el nivel superior del archivo principal.",
                suggestion="Mové el bloque principal fuera de funciones y otros bloques.",
            ))

    for module_file, imported_program in imported_programs.items():
        if module_file == entry_file:
            continue
        for node in _main_nodes(imported_program):
            diagnostics.append(Diagnostic(
                category=DiagnosticCategory.SEMANTIC,
                code="SEM_ENTRY_POINT_IN_IMPORTED_MODULE",
                file=node.file, line=node.line, column=node.column,
                description=(
                    f"El archivo auxiliar '{module_file}' no puede declarar "
                    "un bloque 'principal'."
                ),
                suggestion=(
                    "Dejá el punto de entrada solamente en el archivo "
                    "principal designado."
                ),
            ))

    allowed_globals = (
        ImportNode,
        FunctionDeclarationNode,
        VariableDeclarationNode,
        MainNode,
    )
    programs = ((entry_file, program), *(
        (module_file, imported_program)
        for module_file, imported_program in imported_programs.items()
        if module_file != entry_file
    ))
    for _, source_program in programs:
        for node in source_program.statements:
            if isinstance(node, allowed_globals):
                continue
            diagnostics.append(Diagnostic(
                category=DiagnosticCategory.SEMANTIC,
                code="SEM_TOP_LEVEL_EXECUTABLE_STATEMENT",
                file=node.file, line=node.line, column=node.column,
                description=(
                    "Las instrucciones ejecutables no pueden aparecer en el "
                    "nivel superior de un archivo Lumi."
                ),
                suggestion=(
                    "Mové esta instrucción dentro de 'principal' o de una "
                    "función."
                ),
            ))
    return diagnostics


def _main_nodes(value):
    if isinstance(value, MainNode):
        yield value
    if is_dataclass(value):
        for item in fields(value):
            yield from _main_nodes(getattr(value, item.name))
    elif isinstance(value, (list, tuple)):
        for item in value:
            yield from _main_nodes(item)


def _deep_source_node(program):
    pending = [(program, 0)]
    while pending:
        node, depth = pending.pop()
        if is_dataclass(node):
            if depth > MAX_AST_DEPTH:
                return node
            pending.extend((getattr(node, field.name), depth + 1) for field in fields(node))
        elif isinstance(node, (list, tuple)):
            pending.extend((item, depth) for item in node)
    return None


def _complex_source_result(entry: str, location) -> CompilationResult:
    diagnostic = Diagnostic(
        category=DiagnosticCategory.SYNTACTIC,
        code="SYN_PROGRAM_TOO_DEEP",
        file=location.file, line=location.line, column=location.column,
        description="El código supera la profundidad que Lumi puede analizar.",
        suggestion="Divide la expresión o el bloque en instrucciones más pequeñas.",
    )
    return CompilationResult(entry, CompilationStatus.FAILED, AnalysisStage.SYNTACTIC, diagnostics=(diagnostic,))


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

    Syntax errors and excessive source nesting become failed analysis results.
    Unexpected exceptions propagate unchanged with their traceback: they are not student
    diagnostics. No disk access, path normalization or new import policy is added.
    """

    def compile_project(
        self, sources: Mapping[str, str], *, entry_file: str
    ) -> CompilationResult:
        """Require an explicit entry; never select the active editor file."""
        snapshot = _source_snapshot(sources)
        if entry_file not in snapshot:
            raise ValueError("El archivo principal no está en las fuentes recibidas.")
        result, _ = self._compile_with_dependencies(
            snapshot[entry_file], entry_file, sources=snapshot,
            require_entry_point=True,
        )
        return result

    def compile(
        self, source: str, file: str, *, sources: Mapping[str, str] | None = None
    ) -> CompilationResult:
        """Analyze without executing; retain the existing public result contract."""
        result, _ = self._compile_with_dependencies(
            source, file, sources=sources, require_entry_point=False,
        )
        return result

    def _compile_with_dependencies(
        self, source: str, file: str, *, sources: Mapping[str, str] | None = None,
        require_entry_point: bool = False,
    ) -> tuple[CompilationResult, _ImportResolutionContext]:
        """Internal entry: return reached dependencies, including partial failures."""
        context = _ImportResolutionContext()
        result = self._compile(
            source, file, sources=sources, context=context,
            require_entry_point=require_entry_point,
        )
        result = replace(
            result, _compiled_programs=MappingProxyType(context.successful_programs),
        )
        return result, context

    def _compile(
        self, source: str, file: str, *, sources: Mapping[str, str] | None,
        context: _ImportResolutionContext, require_entry_point: bool,
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
                diagnostics=(error.diagnostic,) if error.diagnostic is not None else (),
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
            diagnostics = list(parser.diagnostics)
            if error.diagnostic is not None and error.diagnostic not in diagnostics:
                diagnostics.append(error.diagnostic)
            return CompilationResult(
                file, CompilationStatus.FAILED, AnalysisStage.LEXICAL,
                diagnostics=tuple(diagnostics), lexical_error=str(error),
                lexical_error_location=error.location,
            )
        except RecursionError:
            return _complex_source_result(file, parser.peek())
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
        for source_program in (program, *context.successful_programs.values()):
            deep_node = _deep_source_node(source_program)
            if deep_node is not None:
                return _complex_source_result(file, deep_node)
        entry_diagnostics = (
            _entry_point_diagnostics(program, file, context.successful_programs)
            if require_entry_point else []
        )
        if entry_diagnostics:
            return CompilationResult(
                file, CompilationStatus.FAILED, AnalysisStage.SEMANTIC,
                diagnostics=tuple(entry_diagnostics), program=program,
                imported_programs=imports, _entry_point_validated=True,
            )
        semantic = SemanticAnalyzer().analyze(program, context.successful_programs)
        limitations = analysis_limitations(
            spatial_analysis_complete=semantic.spatial_analysis_complete,
        )
        status = CompilationStatus.COMPLETED
        if semantic.diagnostics:
            status = CompilationStatus.FAILED
        elif limitations:
            status = CompilationStatus.INCOMPLETE
        return CompilationResult(
            file, status, AnalysisStage.SEMANTIC,
            diagnostics=tuple(semantic.diagnostics), program=program,
            imported_programs=imports, limitations=limitations,
            _entry_point_validated=require_entry_point,
        )
