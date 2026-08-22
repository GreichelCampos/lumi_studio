from dataclasses import dataclass

from .token_type import TokenType

@dataclass
class Token:
    type: TokenType
    lexeme: str
    file: str
    line: int
    column: int