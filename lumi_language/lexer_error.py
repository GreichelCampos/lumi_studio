"""Lexical error definitions for Lumi."""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class LexicalErrorLocation:
    file: str
    line: int
    column: int


class LexerError(Exception):
    """Error producido durante el análisis léxico de Lumi."""

    def __init__(self, *args, file=None, line=None, column=None):
        super().__init__(*args)
        self.file = file
        self.line = line
        self.column = column

    @property
    def location(self) -> LexicalErrorLocation | None:
        if self.file is None or self.line is None or self.column is None:
            return None
        return LexicalErrorLocation(self.file, self.line, self.column)
