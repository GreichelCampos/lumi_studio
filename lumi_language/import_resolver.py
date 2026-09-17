"""Import resolution responsibilities for Lumi projects."""

from dataclasses import dataclass, field

@dataclass(slots=True)
class InMemoryImportResolver:
    """Small test resolver for Lumi imports backed by provided source text."""

    sources: dict[str, str] = field(default_factory=dict)

    def exists(self, file_name: str) -> bool:
        return file_name in self.sources

    def resolve(self, file_name: str) -> str:
        if not self.exists(file_name):
            raise FileNotFoundError(file_name)

        return self.sources[file_name]
