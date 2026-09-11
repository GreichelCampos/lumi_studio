"""Parsing responsibilities for Lumi source code."""

from .token import Token
from .token_type import TokenType
from .ast_nodes import (
    AssignmentNode,
    BinaryExpressionNode,
    IdentifierNode,
    ListNode,
    LiteralNode,
    ReadNode,
    ShowNode,
    UnaryExpressionNode,
    VariableDeclarationNode,
    VectorNode,
    ProgramNode,
)


class Parser:
    def __init__(self, tokens: list[Token]):
        self.tokens = tokens
        self.current = 0

    def is_at_end(self) -> bool:
        return self.current >= len(self.tokens)

    def peek(self) -> Token:
        return self.tokens[self.current]

    def advance(self) -> Token:
        token = self.peek()
        self.current += 1
        return token

    def check(self, token_type: TokenType) -> bool:
        if self.is_at_end():
            return False

        return self.peek().type == token_type

    def match(self, *token_types: TokenType) -> bool:
        for token_type in token_types:
            if self.check(token_type):
                self.advance()
                return True

        return False

    def consume(self, token_type: TokenType, message: str) -> Token:
        if self.check(token_type):
            return self.advance()

        raise ValueError(message)

    def parse_primary(self):
        if self.is_at_end():
            raise ValueError("Se esperaba una expresión.")

        token = self.advance()

        if token.type == TokenType.INTEGER_LITERAL:
            return LiteralNode(
                value=int(token.lexeme),
                literal_kind="entero",
                file=token.file,
                line=token.line,
                column=token.column,
            )

        if token.type == TokenType.DECIMAL_LITERAL:
            return LiteralNode(
                value=float(token.lexeme),
                literal_kind="decimal",
                file=token.file,
                line=token.line,
                column=token.column,
            )

        if token.type == TokenType.STRING_LITERAL:
            return LiteralNode(
                value=token.lexeme[1:-1],
                literal_kind="texto",
                file=token.file,
                line=token.line,
                column=token.column,
            )

        if token.type == TokenType.TRUE:
            return LiteralNode(
                value=True,
                literal_kind="booleano",
                file=token.file,
                line=token.line,
                column=token.column,
            )

        if token.type == TokenType.FALSE:
            return LiteralNode(
                value=False,
                literal_kind="booleano",
                file=token.file,
                line=token.line,
                column=token.column,
            )

        if token.type == TokenType.NULL:
            return LiteralNode(
                value=None,
                literal_kind="nulo",
                file=token.file,
                line=token.line,
                column=token.column,
            )
        if token.type == TokenType.IDENTIFIER:
            return IdentifierNode(
                name=token.lexeme,
                file=token.file,
                line=token.line,
                column=token.column,
            )
        if token.type == TokenType.LEFT_PAREN:
            expression = self.parse_expression()

            self.consume(
                TokenType.RIGHT_PAREN,
                "Se esperaba ')' después de la expresión.",
            )

            return expression

        if token.type == TokenType.READ:
            self.current -= 1
            return self.parse_read()

        if token.type == TokenType.LEFT_BRACKET:
            self.current -= 1
            return self.parse_list()

        raise ValueError("Se esperaba una expresión.")

    def parse_expression(self):
        return self.parse_or()

    def parse_unary(self):
        if self.match(TokenType.NOT, TokenType.MINUS):
            operator = self.tokens[self.current - 1]
            operand = self.parse_unary()

            return UnaryExpressionNode(
                operator=operator.lexeme,
                operand=operand,
                file=operator.file,
                line=operator.line,
                column=operator.column,
            )

        return self.parse_primary()

    def parse_factor(self):
        expression = self.parse_unary()

        while self.match(TokenType.MULTIPLY, TokenType.DIVIDE):
            operator = self.tokens[self.current - 1]
            right = self.parse_unary()

            expression = BinaryExpressionNode(
                left=expression,
                operator=operator.lexeme,
                right=right,
                file=expression.file,
                line=expression.line,
                column=expression.column,
            )

        return expression

    def parse_term(self):
        expression = self.parse_factor()

        while self.match(TokenType.PLUS, TokenType.MINUS):
            operator = self.tokens[self.current - 1]
            right = self.parse_factor()

            expression = BinaryExpressionNode(
                left=expression,
                operator=operator.lexeme,
                right=right,
                file=expression.file,
                line=expression.line,
                column=expression.column,
            )

        return expression

    def parse_comparison(self):
        expression = self.parse_term()

        while self.match(
            TokenType.GREATER,
            TokenType.LESS,
            TokenType.GREATER_EQUAL,
            TokenType.LESS_EQUAL,
        ):
            operator = self.tokens[self.current - 1]
            right = self.parse_term()

            expression = BinaryExpressionNode(
                left=expression,
                operator=operator.lexeme,
                right=right,
                file=expression.file,
                line=expression.line,
                column=expression.column,
            )

        return expression

    def parse_equality(self):
        expression = self.parse_comparison()

        while self.match(
            TokenType.EQUAL_EQUAL,
            TokenType.NOT_EQUAL,
        ):
            operator = self.tokens[self.current - 1]
            right = self.parse_comparison()

            expression = BinaryExpressionNode(
                left=expression,
                operator=operator.lexeme,
                right=right,
                file=expression.file,
                line=expression.line,
                column=expression.column,
            )

        return expression

    def parse_and(self):
        expression = self.parse_equality()

        while self.match(TokenType.AND):
            operator = self.tokens[self.current - 1]
            right = self.parse_equality()

            expression = BinaryExpressionNode(
                left=expression,
                operator=operator.lexeme,
                right=right,
                file=expression.file,
                line=expression.line,
                column=expression.column,
            )

        return expression

    def parse_or(self):
        expression = self.parse_and()

        while self.match(TokenType.OR):
            operator = self.tokens[self.current - 1]
            right = self.parse_and()

            expression = BinaryExpressionNode(
                left=expression,
                operator=operator.lexeme,
                right=right,
                file=expression.file,
                line=expression.line,
                column=expression.column,
            )

        return expression

    def parse_variable_declaration(self):
        type_token = self.advance()

        name_token = self.consume(
            TokenType.IDENTIFIER,
            "Se esperaba el nombre de la variable.",
        )

        self.consume(
            TokenType.ASSIGN,
            "Se esperaba '=' después del nombre de la variable.",
        )

        if type_token.type == TokenType.VECTOR_TYPE:
            value = self.parse_vector()
        else:
            value = self.parse_expression()

        self.consume(
            TokenType.TERMINATOR,
            "Se esperaba '>>' al final de la declaración.",
        )

        return VariableDeclarationNode(
            type=type_token.lexeme,
            name=name_token.lexeme,
            value=value,
            file=type_token.file,
            line=type_token.line,
            column=type_token.column,
        )

    def parse_assignment(self):
        name_token = self.consume(
            TokenType.IDENTIFIER,
            "Se esperaba el nombre de la variable.",
        )

        self.consume(
            TokenType.ASSIGN,
            "Se esperaba '=' después del nombre de la variable.",
        )

        value = self.parse_expression()

        self.consume(
            TokenType.TERMINATOR,
            "Se esperaba '>>' al final de la asignación.",
        )

        return AssignmentNode(
            name=name_token.lexeme,
            value=value,
            file=name_token.file,
            line=name_token.line,
            column=name_token.column,
        )

    def parse_read(self):
        read_token = self.consume(
            TokenType.READ,
            "Se esperaba 'leer'.",
        )

        self.consume(
            TokenType.LEFT_PAREN,
            "Se esperaba '(' después de 'leer'.",
        )

        message = self.parse_expression()

        self.consume(
            TokenType.RIGHT_PAREN,
            "Se esperaba ')' después del mensaje de leer.",
        )

        return ReadNode(
            message=message,
            file=read_token.file,
            line=read_token.line,
            column=read_token.column,
        )

    def parse_show(self):
        show_token = self.consume(
            TokenType.SHOW,
            "Se esperaba 'mostrar'.",
        )

        self.consume(
            TokenType.LEFT_PAREN,
            "Se esperaba '(' después de 'mostrar'.",
        )

        expression = self.parse_expression()

        self.consume(
            TokenType.RIGHT_PAREN,
            "Se esperaba ')' después de la expresión.",
        )

        self.consume(
            TokenType.TERMINATOR,
            "Se esperaba '>>' al final de 'mostrar'.",
        )

        return ShowNode(
            expression=expression,
            file=show_token.file,
            line=show_token.line,
            column=show_token.column,
        )


    def parse_statement(self):
        variable_types = (
            TokenType.INTEGER_TYPE,
            TokenType.DECIMAL_TYPE,
            TokenType.STRING_TYPE,
            TokenType.BOOLEAN_TYPE,
            TokenType.LIST_TYPE,
            TokenType.VECTOR_TYPE,
        )

        if self.peek().type in variable_types:
            return self.parse_variable_declaration()

        if self.check(TokenType.IDENTIFIER):
            return self.parse_assignment()

        if self.check(TokenType.SHOW):
            return self.parse_show()

        raise ValueError("Se esperaba una instrucción válida.")

    def parse(self):
        statements = []

        while not self.is_at_end():
            statements.append(self.parse_statement())

        if statements:
            first_statement = statements[0]

            return ProgramNode(
                statements=statements,
                file=first_statement.file,
                line=first_statement.line,
                column=first_statement.column,
            )

        return ProgramNode(
            statements=[],
            file="",
            line=1,
            column=1,
        )

    def parse_list(self):
        left_bracket = self.consume(
            TokenType.LEFT_BRACKET,
            "Se esperaba '[' para iniciar la lista.",
        )

        elements = []

        if not self.check(TokenType.RIGHT_BRACKET):
            while True:
                elements.append(self.parse_expression())

                if not self.match(TokenType.COMMA):
                    break

        self.consume(
            TokenType.RIGHT_BRACKET,
            "Se esperaba ']' al final de la lista.",
        )

        return ListNode(
            elements=elements,
            file=left_bracket.file,
            line=left_bracket.line,
            column=left_bracket.column,
        )

    def parse_vector(self):
        left_bracket = self.consume(
            TokenType.LEFT_BRACKET,
            "Se esperaba '[' para iniciar el vector.",
        )

        x = self.parse_expression()

        self.consume(
            TokenType.COMMA,
            "Se esperaba ',' después del componente x.",
        )

        y = self.parse_expression()

        self.consume(
            TokenType.COMMA,
            "Se esperaba ',' después del componente y.",
        )

        z = self.parse_expression()

        self.consume(
            TokenType.RIGHT_BRACKET,
            "Se esperaba ']' al final del vector.",
        )

        return VectorNode(
            x=x,
            y=y,
            z=z,
            file=left_bracket.file,
            line=left_bracket.line,
            column=left_bracket.column,
        )
