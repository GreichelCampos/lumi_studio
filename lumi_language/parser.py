"""Parsing responsibilities for Lumi source code."""

from .token import Token
from .token_type import TokenType
from .lexer import Lexer
from .diagnostics import Diagnostic, DiagnosticCategory
from .ast_nodes import (
    AssignmentNode,
    BinaryExpressionNode,
    CaseNode,
    ForNode,
    FunctionCallNode,
    FunctionDeclarationNode,
    IdentifierNode,
    IfNode,
    ImportNode,
    ListNode,
    LiteralNode,
    MainNode,
    ParameterNode,
    ProgramNode,
    ReadNode,
    RepeatNode,
    ReturnNode,
    ShowNode,
    SwitchNode,
    UnaryExpressionNode,
    VariableDeclarationNode,
    VectorNode,
    WhileNode,
)


class ParserError(ValueError):
    """Syntax error that carries a Lumi diagnostic."""

    def __init__(self, diagnostic: Diagnostic):
        super().__init__(diagnostic.description)
        self.diagnostic = diagnostic


class Parser:
    def __init__(self, tokens: list[Token], import_resolver=None):
        self.tokens = tokens
        self.current = 0
        self.import_resolver = import_resolver
        self.diagnostics: list[Diagnostic] = []
        self.imported_programs: dict[str, ProgramNode] = {}

    def is_at_end(self) -> bool:
        return self.current >= len(self.tokens)

    def peek(self) -> Token:
        if self.is_at_end():
            return self.previous()
        return self.tokens[self.current]

    def previous(self) -> Token:
        if self.tokens and self.current > 0:
            return self.tokens[self.current - 1]
        if self.tokens:
            return self.tokens[0]
        return Token(TokenType.TERMINATOR, "", "", 1, 1)

    def peek_next(self) -> Token | None:
        if self.current + 1 >= len(self.tokens):
            return None

        return self.tokens[self.current + 1]

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

        raise self.error(message)

    def error(
        self,
        message: str,
        token: Token | None = None,
        *,
        code: str = "SYN_UNEXPECTED_TOKEN",
    ) -> ParserError:
        if token is None:
            token = self.peek()
        found = "fin de archivo" if self.is_at_end() else f"'{token.lexeme}'"
        diagnostic = Diagnostic(
            category=DiagnosticCategory.SYNTACTIC,
            code=code,
            file=token.file,
            line=token.line,
            column=token.column,
            description=f"{message} Encontrado: {found}.",
        )
        self.diagnostics.append(diagnostic)
        return ParserError(diagnostic)

    def synchronize(self) -> None:
        statement_starters = (
            *self.variable_type_tokens(),
            TokenType.IDENTIFIER,
            TokenType.IMPORT,
            TokenType.IF,
            TokenType.SWITCH,
            TokenType.FOR,
            TokenType.WHILE,
            TokenType.REPEAT,
            TokenType.FUNCTION,
            TokenType.RETURN,
            TokenType.PRINCIPAL,
            TokenType.SHOW,
        )

        if not self.is_at_end() and self.peek().type in statement_starters:
            return

        if not self.is_at_end():
            self.advance()

        while not self.is_at_end():
            if self.previous().type in (TokenType.TERMINATOR, TokenType.RIGHT_BRACE):
                return
            if self.peek().type in statement_starters:
                return
            self.advance()

    def parse_primary(self):
        if self.is_at_end():
            raise self.error("Se esperaba una expresion.")

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
            if self.match(TokenType.LEFT_PAREN):
                arguments = self.parse_arguments()
                self.consume(
                    TokenType.RIGHT_PAREN,
                    "Se esperaba ')' despues de los argumentos.",
                )
                return FunctionCallNode(
                    name=token.lexeme,
                    arguments=arguments,
                    file=token.file,
                    line=token.line,
                    column=token.column,
                )

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
                "Se esperaba ')' despues de la expresion.",
            )
            return expression

        if token.type == TokenType.READ:
            self.current -= 1
            return self.parse_read()

        if token.type == TokenType.LEFT_BRACKET:
            self.current -= 1
            return self.parse_list()

        raise self.error("Se esperaba una expresion.", token)

    def parse_arguments(self):
        arguments = []

        if self.check(TokenType.RIGHT_PAREN):
            return arguments

        while True:
            arguments.append(self.parse_expression())

            if not self.match(TokenType.COMMA):
                break

            if self.check(TokenType.RIGHT_PAREN) or self.is_at_end():
                raise self.error("Se esperaba un argumento despues de ','.")

        return arguments

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

        while self.match(TokenType.EQUAL_EQUAL, TokenType.NOT_EQUAL):
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

    def variable_type_tokens(self):
        return (
            TokenType.INTEGER_TYPE,
            TokenType.DECIMAL_TYPE,
            TokenType.STRING_TYPE,
            TokenType.BOOLEAN_TYPE,
            TokenType.LIST_TYPE,
            TokenType.VECTOR_TYPE,
        )

    def parse_variable_declaration(self):
        return self.parse_variable_declaration_until(TokenType.TERMINATOR)

    def parse_variable_declaration_until(self, terminator_type: TokenType):
        type_token = self.advance()
        name_token = self.consume(
            TokenType.IDENTIFIER,
            "Se esperaba el nombre de la variable.",
        )
        self.consume(
            TokenType.ASSIGN,
            "Se esperaba '=' despues del nombre de la variable.",
        )

        if type_token.type == TokenType.VECTOR_TYPE:
            value = self.parse_vector()
        else:
            value = self.parse_expression()

        self.consume(
            terminator_type,
            "Se esperaba el separador al final de la declaracion.",
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
        return self.parse_assignment_until(TokenType.TERMINATOR)

    def parse_assignment_until(self, terminator_type: TokenType):
        assignment = self.parse_assignment_without_terminator()
        self.consume(
            terminator_type,
            "Se esperaba el separador al final de la asignacion.",
        )

        return assignment

    def parse_assignment_without_terminator(self):
        name_token = self.consume(
            TokenType.IDENTIFIER,
            "Se esperaba el nombre de la variable.",
        )
        self.consume(
            TokenType.ASSIGN,
            "Se esperaba '=' despues del nombre de la variable.",
        )
        value = self.parse_expression()

        return AssignmentNode(
            name=name_token.lexeme,
            value=value,
            file=name_token.file,
            line=name_token.line,
            column=name_token.column,
        )

    def parse_read(self):
        read_token = self.consume(TokenType.READ, "Se esperaba 'leer'.")
        self.consume(TokenType.LEFT_PAREN, "Se esperaba '(' despues de 'leer'.")
        message = self.parse_expression()
        self.consume(
            TokenType.RIGHT_PAREN,
            "Se esperaba ')' despues del mensaje de leer.",
        )

        return ReadNode(
            message=message,
            file=read_token.file,
            line=read_token.line,
            column=read_token.column,
        )

    def parse_show(self):
        show_token = self.consume(TokenType.SHOW, "Se esperaba 'mostrar'.")
        self.consume(
            TokenType.LEFT_PAREN,
            "Se esperaba '(' despues de 'mostrar'.",
        )
        expression = self.parse_expression()
        self.consume(
            TokenType.RIGHT_PAREN,
            "Se esperaba ')' despues de la expresion.",
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

    def parse_import(self):
        import_token = self.consume(TokenType.IMPORT, "Se esperaba 'importar'.")
        file_token = self.consume(
            TokenType.STRING_LITERAL,
            "Se esperaba el nombre del archivo a importar.",
        )
        self.consume(TokenType.USE, "Se esperaba 'usar' despues del archivo importado.")
        symbol_token = self.consume(
            TokenType.IDENTIFIER,
            "Se esperaba el simbolo importado despues de 'usar'.",
        )
        self.consume(
            TokenType.TERMINATOR,
            "Se esperaba '>>' al final de la importacion.",
        )

        file_name = file_token.lexeme[1:-1]
        node = ImportNode(
            file_name=file_name,
            symbol_name=symbol_token.lexeme,
            file=import_token.file,
            line=import_token.line,
            column=import_token.column,
        )
        self.resolve_import(node)
        return node

    def resolve_import(self, node: ImportNode) -> None:
        if self.import_resolver is None:
            return

        try:
            source = self.import_resolver.resolve(node.file_name)
        except FileNotFoundError:
            diagnostic = Diagnostic(
                category=DiagnosticCategory.IMPORT,
                code="IMPORT_FILE_NOT_FOUND",
                file=node.file,
                line=node.line,
                column=node.column,
                description=f"No se encontro el archivo importado '{node.file_name}'.",
                suggestion="Verifique el nombre del archivo importado.",
            )
            self.diagnostics.append(diagnostic)
            raise ParserError(diagnostic)

        tokens = Lexer(source, node.file_name).tokenize()
        imported_parser = Parser(tokens, import_resolver=self.import_resolver)
        program = imported_parser.parse()
        self.diagnostics.extend(imported_parser.diagnostics)
        self.imported_programs[node.file_name] = program

    def parse_block(self):
        self.consume(TokenType.LEFT_BRACE, "Se esperaba '{' para iniciar el bloque.")
        statements = []

        while not self.check(TokenType.RIGHT_BRACE):
            if self.is_at_end():
                raise self.error("Se esperaba '}' para cerrar el bloque.")
            statements.append(self.parse_statement())

        self.consume(TokenType.RIGHT_BRACE, "Se esperaba '}' para cerrar el bloque.")
        return statements

    def parse_if(self):
        if_token = self.consume(TokenType.IF, "Se esperaba 'si'.")
        condition = self.parse_expression()
        then_body = self.parse_block()
        else_body = []

        if self.match(TokenType.ELSE):
            else_body = self.parse_block()

        return IfNode(
            condition=condition,
            then_body=then_body,
            else_body=else_body,
            file=if_token.file,
            line=if_token.line,
            column=if_token.column,
        )

    def parse_switch(self):
        switch_token = self.consume(TokenType.SWITCH, "Se esperaba 'segun'.")
        expression = self.parse_expression()
        self.consume(
            TokenType.LEFT_BRACE,
            "Se esperaba '{' para iniciar el bloque de 'segun'.",
        )
        cases = []
        default_body = []

        while not self.check(TokenType.RIGHT_BRACE):
            if self.is_at_end():
                raise self.error("Se esperaba '}' para cerrar 'segun'.")

            if self.check(TokenType.CASE):
                cases.append(self.parse_case())
                continue

            if self.match(TokenType.DEFAULT):
                self.consume(TokenType.COLON, "Se esperaba ':' despues de 'defecto'.")
                default_body = self.parse_switch_section_body()
                continue

            raise self.error("Se esperaba 'caso', 'defecto' o '}'.")

        self.consume(TokenType.RIGHT_BRACE, "Se esperaba '}' para cerrar 'segun'.")

        return SwitchNode(
            expression=expression,
            cases=cases,
            default_body=default_body,
            file=switch_token.file,
            line=switch_token.line,
            column=switch_token.column,
        )

    def parse_case(self):
        case_token = self.consume(TokenType.CASE, "Se esperaba 'caso'.")
        value = self.parse_expression()
        self.consume(TokenType.COLON, "Se esperaba ':' despues de 'caso'.")
        body = self.parse_switch_section_body()

        return CaseNode(
            value=value,
            body=body,
            file=case_token.file,
            line=case_token.line,
            column=case_token.column,
        )

    def parse_switch_section_body(self):
        body = []

        while not (
            self.check(TokenType.CASE)
            or self.check(TokenType.DEFAULT)
            or self.check(TokenType.RIGHT_BRACE)
        ):
            if self.is_at_end():
                raise self.error("Se esperaba '}' para cerrar 'segun'.")
            body.append(self.parse_statement())

        return body

    def parse_for(self):
        for_token = self.consume(TokenType.FOR, "Se esperaba 'hacer'.")

        if not self.is_at_end() and self.peek().type in self.variable_type_tokens():
            initializer = self.parse_variable_declaration_until(TokenType.SEMICOLON)
        else:
            initializer = self.parse_assignment_until(TokenType.SEMICOLON)

        condition = self.parse_expression()
        self.consume(
            TokenType.SEMICOLON,
            "Se esperaba ';' despues de la condicion.",
        )
        update = self.parse_assignment_without_terminator()
        body = self.parse_block()

        return ForNode(
            initializer=initializer,
            condition=condition,
            update=update,
            body=body,
            file=for_token.file,
            line=for_token.line,
            column=for_token.column,
        )

    def parse_while(self):
        while_token = self.consume(TokenType.WHILE, "Se esperaba 'mientras'.")
        condition = self.parse_expression()
        body = self.parse_block()

        return WhileNode(
            condition=condition,
            body=body,
            file=while_token.file,
            line=while_token.line,
            column=while_token.column,
        )

    def parse_repeat(self):
        repeat_token = self.consume(TokenType.REPEAT, "Se esperaba 'repetir'.")
        count = self.parse_expression()
        body = self.parse_block()

        return RepeatNode(
            count=count,
            body=body,
            file=repeat_token.file,
            line=repeat_token.line,
            column=repeat_token.column,
        )

    def parse_function_declaration(self):
        function_token = self.consume(TokenType.FUNCTION, "Se esperaba 'funcion'.")
        return_type_token = self.consume_return_type()
        name_token = self.consume(
            TokenType.IDENTIFIER,
            "Se esperaba el nombre de la funcion.",
        )
        self.consume(
            TokenType.LEFT_PAREN,
            "Se esperaba '(' despues del nombre de la funcion.",
        )
        parameters = self.parse_parameters()
        self.consume(
            TokenType.RIGHT_PAREN,
            "Se esperaba ')' despues de los parametros.",
        )
        body = self.parse_block()

        return FunctionDeclarationNode(
            name=name_token.lexeme,
            parameters=parameters,
            return_type=return_type_token.lexeme,
            body=body,
            file=function_token.file,
            line=function_token.line,
            column=function_token.column,
        )

    def parse_parameters(self):
        parameters = []

        if self.check(TokenType.RIGHT_PAREN):
            return parameters

        while True:
            parameters.append(self.parse_parameter())

            if not self.match(TokenType.COMMA):
                break

        return parameters

    def parse_parameter(self):
        type_token = self.consume_parameter_type()
        name_token = self.consume(
            TokenType.IDENTIFIER,
            "Se esperaba el nombre del parametro.",
        )

        return ParameterNode(
            name=name_token.lexeme,
            data_type=type_token.lexeme,
            file=type_token.file,
            line=type_token.line,
            column=type_token.column,
        )

    def parse_return(self):
        return_token = self.consume(TokenType.RETURN, "Se esperaba 'retornar'.")
        value = self.parse_expression()
        self.consume(
            TokenType.TERMINATOR,
            "Se esperaba '>>' al final de 'retornar'.",
        )

        return ReturnNode(
            value=value,
            file=return_token.file,
            line=return_token.line,
            column=return_token.column,
        )

    def parse_main(self):
        main_token = self.consume(TokenType.PRINCIPAL, "Se esperaba 'principal'.")
        body = self.parse_block()

        return MainNode(
            body=body,
            file=main_token.file,
            line=main_token.line,
            column=main_token.column,
        )

    def consume_parameter_type(self):
        if self.is_at_end():
            raise self.error("Se esperaba el tipo del parametro.")

        if self.peek().type in self.variable_type_tokens():
            return self.advance()

        raise self.error("Se esperaba el tipo del parametro.")

    def consume_return_type(self):
        if self.is_at_end():
            raise self.error("Se esperaba el tipo de retorno de la funcion.")

        if self.peek().type in (*self.variable_type_tokens(), TokenType.VOID):
            return self.advance()

        raise self.error("Se esperaba el tipo de retorno de la funcion.")

    def parse_statement(self):
        if self.is_at_end():
            raise self.error("Se esperaba una instruccion valida.")

        if self.peek().type in self.variable_type_tokens():
            return self.parse_variable_declaration()

        if self.check(TokenType.IDENTIFIER):
            next_token = self.peek_next()
            if next_token is not None and next_token.type == TokenType.LEFT_PAREN:
                call = self.parse_expression()
                self.consume(
                    TokenType.TERMINATOR,
                    "Se esperaba '>>' al final de la llamada.",
                )
                return call
            return self.parse_assignment()

        statement_parsers = {
            TokenType.IMPORT: self.parse_import,
            TokenType.IF: self.parse_if,
            TokenType.SWITCH: self.parse_switch,
            TokenType.FOR: self.parse_for,
            TokenType.WHILE: self.parse_while,
            TokenType.REPEAT: self.parse_repeat,
            TokenType.FUNCTION: self.parse_function_declaration,
            TokenType.RETURN: self.parse_return,
            TokenType.PRINCIPAL: self.parse_main,
            TokenType.SHOW: self.parse_show,
        }
        parser = statement_parsers.get(self.peek().type)

        if parser is not None:
            return parser()

        raise self.error("Se esperaba una instruccion valida.")

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

        return ProgramNode(statements=[], file="", line=1, column=1)

    def parse_with_recovery(self):
        statements = []

        while not self.is_at_end():
            try:
                statements.append(self.parse_statement())
            except ParserError:
                self.synchronize()

        if statements:
            first_statement = statements[0]
            return ProgramNode(
                statements=statements,
                file=first_statement.file,
                line=first_statement.line,
                column=first_statement.column,
            )

        return ProgramNode(statements=[], file="", line=1, column=1)

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

        self.consume(TokenType.RIGHT_BRACKET, "Se esperaba ']' al final de la lista.")

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
        self.consume(TokenType.COMMA, "Se esperaba ',' despues del componente x.")
        y = self.parse_expression()
        self.consume(TokenType.COMMA, "Se esperaba ',' despues del componente y.")
        z = self.parse_expression()
        self.consume(TokenType.RIGHT_BRACKET, "Se esperaba ']' al final del vector.")

        return VectorNode(
            x=x,
            y=y,
            z=z,
            file=left_bracket.file,
            line=left_bracket.line,
            column=left_bracket.column,
        )
