"""Internal import traversal data and successful AST cache per compilation."""

from dataclasses import dataclass, field
from enum import Enum

from .ast_nodes import ImportNode, ProgramNode
from .diagnostics import Diagnostic


class ModuleState(str, Enum):
    DISCOVERED = "discovered"
    PROCESSING = "processing"
    SUCCEEDED = "succeeded"
    PARTIAL = "partial"
    FAILED = "failed"


@dataclass(frozen=True)
class ImportRelation:
    importer: str
    dependency: str
    file: str
    line: int
    column: int
    symbol: str
    order: int


@dataclass(frozen=True)
class ModuleRecord:
    file: str
    state: ModuleState = ModuleState.DISCOVERED
    program: ProgramNode | None = None
    diagnostics: tuple[Diagnostic, ...] = ()
    parsing_completed: bool = False
    failure_kind: str | None = None


@dataclass
class _ImportResolutionContext:
    """One traversal session; only complete successful ASTs can be reused."""

    active_files: list[str] = field(default_factory=list)
    modules: dict[str, ModuleRecord] = field(default_factory=dict)
    relations: list[ImportRelation] = field(default_factory=list)

    def reusable_program(self, file: str) -> ProgramNode | None:
        record = self.modules.get(file)
        if (
            record is not None
            and record.state is ModuleState.SUCCEEDED
            and record.parsing_completed
            and not record.diagnostics
        ):
            return record.program
        return None

    def discover(self, file: str) -> None:
        self.modules.setdefault(file, ModuleRecord(file))

    def record_import(self, importer: str, node: ImportNode) -> None:
        self.discover(importer)
        self.discover(node.file_name)
        self.relations.append(ImportRelation(
            importer, node.file_name, node.file, node.line, node.column,
            node.symbol_name, len(self.relations),
        ))

    def direct_dependencies(self, file: str) -> tuple[str, ...]:
        return tuple(dict.fromkeys(
            edge.dependency for edge in self.relations if edge.importer == file
        ))

    def reachable_dependencies(self, file: str) -> tuple[str, ...]:
        """Observed closure, excluding the origin even when there is a cycle."""
        seen = {file}
        reached = []
        pending = list(reversed(self.direct_dependencies(file)))
        while pending:
            dependency = pending.pop()
            if dependency in seen:
                continue
            seen.add(dependency)
            reached.append(dependency)
            pending.extend(reversed(self.direct_dependencies(dependency)))
        return tuple(reached)

    @property
    def successful_programs(self) -> dict[str, ProgramNode]:
        return {
            file: record.program for file, record in self.modules.items()
            if record.state is ModuleState.SUCCEEDED and record.program is not None
        }

    @property
    def complete(self) -> bool:
        return bool(self.modules) and all(
            record.state is ModuleState.SUCCEEDED for record in self.modules.values()
        )
