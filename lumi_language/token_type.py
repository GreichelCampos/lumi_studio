from enum import Enum, auto

class TokenType(Enum):
    #Terminación de instrucciones
    TERMINATOR = auto()

    #Separador en ciclos
    SEMICOLON = auto()

    #Delimitadores de bloques
    LEFT_BRACE = auto()
    RIGHT_BRACE = auto()

    #Identificadores
    IDENTIFIER = auto()

    #Palabra reservada para el punto de entrada
    PRINCIPAL = auto()

    #Tipos de datos
    INTEGER_TYPE = auto()
    INTEGER_LITERAL = auto()
    DECIMAL_TYPE = auto()
    DECIMAL_LITERAL = auto()
    STRING_TYPE = auto()
    STRING_LITERAL = auto()
    BOOLEAN_TYPE = auto()
    TRUE = auto()
    FALSE = auto()

    #Nulo
    NULL = auto()

    #Tipos de datos compuestos
    LIST_TYPE = auto()
    VECTOR_TYPE = auto()

    #Palabras reservadas
    IMPORT = auto()
    USE = auto()
    FUNCTION = auto()
    RETURN = auto()
    VOID = auto()
    IF = auto()
    ELSE = auto()
    SWITCH = auto()
    CASE = auto()
    DEFAULT = auto()
    FOR = auto()
    WHILE = auto()
    REPEAT = auto()
    READ = auto()
    SHOW = auto()
    ROOM = auto()
    FLOOR = auto()
    WALL = auto()
    DOOR = auto()
    WINDOW = auto()
    PLACE = auto()
    MOVE = auto()
    ROTATE = auto()
    VISUALIZE_3D = auto()
    IN = auto()
    COLOR = auto()
    MATERIAL = auto()
    POSITION = auto()

    #Asignación
    ASSIGN = auto()

    #Delimitadores de expresiones
    LEFT_PAREN = auto()
    RIGHT_PAREN = auto()
    LEFT_BRACKET = auto()
    RIGHT_BRACKET = auto()
    COMMA = auto()
    COLON = auto()
   
    #Operaciones aritméticas
    PLUS = auto()
    MINUS = auto()
    MULTIPLY = auto()
    DIVIDE = auto()

    #Operaciones lógicas
    AND = auto()
    OR = auto()
    NOT = auto()

    #Operaciones relacionales
    EQUAL_EQUAL = auto()
    NOT_EQUAL = auto()
    GREATER = auto()
    LESS = auto()
    GREATER_EQUAL = auto()
    LESS_EQUAL = auto()
