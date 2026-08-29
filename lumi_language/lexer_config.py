"""Token configuration used by the Lumi lexer."""

from .token_type import TokenType

SINGLE_CHAR_TOKENS = {
    "{": TokenType.LEFT_BRACE,
    "}": TokenType.RIGHT_BRACE,
    "(": TokenType.LEFT_PAREN,
    ")": TokenType.RIGHT_PAREN,
    "[": TokenType.LEFT_BRACKET,
    "]": TokenType.RIGHT_BRACKET,
    ",": TokenType.COMMA,
    ":": TokenType.COLON,
    ";": TokenType.SEMICOLON,
}

SINGLE_OPERATOR_TOKENS = {
    ">": TokenType.GREATER,
    "<": TokenType.LESS,
    "=": TokenType.ASSIGN,
    "+": TokenType.PLUS,
    "-": TokenType.MINUS,
    "*": TokenType.MULTIPLY,
    "/": TokenType.DIVIDE,
}

MULTI_CHAR_TOKENS = {
    ">": {
        ">": TokenType.TERMINATOR,
        "=": TokenType.GREATER_EQUAL,
    },
    "<": {
        "=": TokenType.LESS_EQUAL,
    },
    "=": {
        "=": TokenType.EQUAL_EQUAL,
    },
    "!": {"=": TokenType.NOT_EQUAL},
}

KEYWORDS = {
    "principal": TokenType.PRINCIPAL,
    "entero": TokenType.INTEGER_TYPE,
    "decimal": TokenType.DECIMAL_TYPE,
    "texto": TokenType.STRING_TYPE,
    "booleano": TokenType.BOOLEAN_TYPE,
    "verdadero": TokenType.TRUE,
    "falso": TokenType.FALSE,
    "nulo": TokenType.NULL,
    "lista": TokenType.LIST_TYPE,
    "vector": TokenType.VECTOR_TYPE,
    "importar": TokenType.IMPORT,
    "usar": TokenType.USE,
    "funcion": TokenType.FUNCTION,
    "retornar": TokenType.RETURN,
    "vacio": TokenType.VOID,
    "si": TokenType.IF,
    "sino": TokenType.ELSE,
    "segun": TokenType.SWITCH,
    "caso": TokenType.CASE,
    "defecto": TokenType.DEFAULT,
    "hacer": TokenType.FOR,
    "mientras": TokenType.WHILE,
    "repetir": TokenType.REPEAT,
    "leer": TokenType.READ,
    "mostrar": TokenType.SHOW,
    "habitacion": TokenType.ROOM,
    "piso": TokenType.FLOOR,
    "pared": TokenType.WALL,
    "puerta": TokenType.DOOR,
    "ventana": TokenType.WINDOW,
    "colocar": TokenType.PLACE,
    "mover": TokenType.MOVE,
    "rotar": TokenType.ROTATE,
    "visualizar3D": TokenType.VISUALIZE_3D,
    "en": TokenType.IN,
    "color": TokenType.COLOR,
    "material": TokenType.MATERIAL,
    "posicion": TokenType.POSITION,
    "y": TokenType.AND,
    "o": TokenType.OR,
    "no": TokenType.NOT,
}