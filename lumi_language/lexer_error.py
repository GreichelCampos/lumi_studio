"""Lexical error definitions for Lumi."""

from dataclasses import dataclass

from .diagnostics import Diagnostic


@dataclass(frozen=True, slots=True)
class LexicalErrorLocation:
    file: str
    line: int
    column: int


class LexerError(Exception):
    """Error producido durante el análisis léxico de Lumi."""

    def __init__(
        self, *args, file=None, line=None, column=None,
        diagnostic: Diagnostic | None = None,
    ):
        super().__init__(*args)
        self.diagnostic = diagnostic
        self.file = diagnostic.file if diagnostic is not None else file
        self.line = diagnostic.line if diagnostic is not None else line
        self.column = diagnostic.column if diagnostic is not None else column

    @property
    def location(self) -> LexicalErrorLocation | None:
        if self.file is None or self.line is None or self.column is None:
            return None
        return LexicalErrorLocation(self.file, self.line, self.column)
