"""Lexical analysis responsibilities for Lumi source code."""

from .token import Token
from .token_type import TokenType
from .lexer_config import (
    SINGLE_CHAR_TOKENS,
    SINGLE_OPERATOR_TOKENS,
    MULTI_CHAR_TOKENS,
    KEYWORDS,
)
from .lexer_error import LexerError


class Lexer:
    def __init__(self, source: str, file: str):
        self.source = source
        self.file = file
        self.current = 0
        self.line = 1
        self.column = 1
        self.start_line = 1
        self.start_column = 1

    def advance(self) -> str:
        char = self.source[self.current]
        self.current += 1

        if char == "\n":
            self.line += 1
            self.column = 1
        else:
            self.column += 1

        return char

    def is_at_end(self) -> bool:
        return self.current >= len(self.source)

    def peek(self) -> str:
        if self.is_at_end():
            return "\0"
        return self.source[self.current]

    def peek_next(self) -> str:
        if self.current + 1 >= len(self.source):
            return "\0"
        return self.source[self.current + 1]

    def skip_whitespace(self):
        while not self.is_at_end():
            char = self.peek()

            if char in (" ", "\r", "\t", "\n"):
                self.advance()
            else:
                break

    def make_token(self, token_type: TokenType, lexeme: str) -> Token:
        return Token(
            type=token_type,
            lexeme=lexeme,
            file=self.file,
            line=self.start_line,
            column=self.start_column,
        )

    def scan_symbol(self, char: str) -> Token | None:
        if char in MULTI_CHAR_TOKENS:
            possible_tokens = MULTI_CHAR_TOKENS[char]
            next_char = self.peek()

            if next_char in possible_tokens:
                self.advance()
                return self.make_token(
                    possible_tokens[next_char],
                    char + next_char,
                )

        if char in SINGLE_CHAR_TOKENS:
            return self.make_token(
                SINGLE_CHAR_TOKENS[char],
                char,
            )

        if char in SINGLE_OPERATOR_TOKENS:
            return self.make_token(
                SINGLE_OPERATOR_TOKENS[char],
                char,
            )

        return None

    def scan_number(self, first_char: str) -> Token:
        lexeme = first_char

        while self.peek().isdigit():
            lexeme += self.advance()

        if self.peek() == "." and self.peek_next().isdigit():
            lexeme += self.advance()

            while self.peek().isdigit():
                lexeme += self.advance()

            return self.make_token(TokenType.DECIMAL_LITERAL, lexeme)
        return self.make_token(TokenType.INTEGER_LITERAL, lexeme)

    def scan_string(self) -> Token:
        lexeme = '"'

        while not self.is_at_end() and self.peek() != '"':
            lexeme += self.advance()

        if self.is_at_end():
            raise LexerError(
                f"{self.file}:{self.start_line}:{self.start_column}: texto sin cerrar"
            )

        lexeme += self.advance()

        return self.make_token(
            TokenType.STRING_LITERAL,
            lexeme,
        )

    def skip_comment(self, multiline: bool) -> None:
        if not multiline:
            while not self.is_at_end() and self.peek() != "\n":
                self.advance()
            return

        while not self.is_at_end():
            if self.peek() == "-" and self.peek_next() == "-":
                self.advance()
                self.advance()
                return

            self.advance()

        raise LexerError(
            f"{self.file}:{self.start_line}:{self.start_column}: "
            "comentario multilínea sin cerrar"
        )

    def scan_identifier(self, first_char: str) -> Token:
        lexeme = first_char

        while self.peek().isalnum() or self.peek() == "_":
            lexeme += self.advance()

        token_type = KEYWORDS.get(
            lexeme,
            TokenType.IDENTIFIER,
        )

        return self.make_token(
            token_type,
            lexeme,
        )

    def tokenize(self) -> list[Token]:
        tokens = []
        while not self.is_at_end():
            self.skip_whitespace()

            if self.is_at_end():
                break

            self.start_line = self.line
            self.start_column = self.column

            char = self.advance()

            if char == "-" and self.peek() == "-":
                self.advance()

                multiline = self.peek() == "\n"

                self.skip_comment(multiline)
                continue

            token = self.scan_symbol(char)

            if token is not None:
                tokens.append(token)
            elif char.isdigit():
                tokens.append(self.scan_number(char))
            elif char == '"':
                tokens.append(self.scan_string())
            elif char.isalpha() or char == "_":
                tokens.append(self.scan_identifier(char))
            else:
                raise LexerError(
                    f"{self.file}:{self.start_line}:{self.start_column}: "
                    f"carácter inválido '{char}'"
                )

        return tokens