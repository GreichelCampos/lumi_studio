# Contrato de Tokens de Lumi

## 1. Propósito

Este documento define el contrato de tokens del lenguaje de programación Lumi. Establece los tipos de tokens reconocidos por el lenguaje, la información que debe almacenar cada token y las reglas utilizadas para identificar su ubicación dentro de un archivo fuente.

Este contrato servirá como base para el lexer y para los demás componentes del compilador que necesiten utilizar la información generada durante el análisis léxico.

## 2. Estructura de un Token

Cada token generado a partir del código fuente de Lumi debe almacenar la siguiente información:

| Campo | Tipo | Descripción |
|---|---|---|
| `type` | `TokenType` | Categoría a la que pertenece el token. |
| `lexeme` | `str` | Texto exacto encontrado en el código fuente. |
| `file` | `str` | Archivo `.lumi` en el que se encuentra el token. |
| `line` | `int` | Línea en la que comienza el token. |
| `column` | `int` | Columna en la que comienza el token. |

Por ejemplo, para el identificador `ancho` presente en el archivo `principal.lumi`:

`Token(TokenType.IDENTIFIER, "ancho", "principal.lumi", 1, 9)`

## 3. Reglas de ubicación

Cada token debe conservar la ubicación en la que comienza dentro del código fuente para permitir la generación de diagnósticos precisos.

### 3.1 Archivo

El campo `file` almacena el nombre del archivo `.lumi` en el que se encuentra el token.

Ejemplo:

`principal.lumi`

### 3.2 Línea

Las líneas se numeran comenzando en `1`.

La primera línea de un archivo corresponde a la línea `1`. Cada salto de línea incrementa el número de línea en una unidad.

### 3.3 Columna

Las columnas se numeran comenzando en `1`.

La columna representa la posición en la que comienza el token dentro de su línea. Los espacios de indentación también cuentan para determinar la columna.

Al producirse un salto de línea, la columna vuelve a comenzar desde `1`.

## 4. Tipos de tokens

Los tipos de tokens de Lumi se representan mediante la enumeración `TokenType`. Cada tipo identifica la categoría de un elemento reconocido en el código fuente.

### 4.1 Terminación y separación

| TokenType | Lexema | Descripción |
|---|---|---|
| `TERMINATOR` | `>>` | Indica el final de una instrucción simple. |
| `SEMICOLON` | `;` | Separa las partes de la cabecera del ciclo `hacer`. |

### 4.2 Delimitadores

| TokenType | Lexema | Descripción |
|---|---|---|
| `LEFT_BRACE` | `{` | Inicio de un bloque. |
| `RIGHT_BRACE` | `}` | Fin de un bloque. |
| `LEFT_PAREN` | `(` | Apertura de paréntesis. |
| `RIGHT_PAREN` | `)` | Cierre de paréntesis. |
| `LEFT_BRACKET` | `[` | Apertura de corchetes. |
| `RIGHT_BRACKET` | `]` | Cierre de corchetes. |
| `COMMA` | `,` | Separador de elementos o argumentos. |
| `COLON` | `:` | Separador utilizado en `caso` y `defecto`. |

### 4.3 Identificadores y literales

| TokenType | Ejemplo | Descripción |
|---|---|---|
| `IDENTIFIER` | `ancho` | Nombre definido por el programador. |
| `INTEGER_LITERAL` | `4` | Valor numérico entero. |
| `DECIMAL_LITERAL` | `5.5` | Valor numérico decimal. |
| `STRING_LITERAL` | `"Sala"` | Valor de texto. |
| `TRUE` | `verdadero` | Valor booleano verdadero. |
| `FALSE` | `falso` | Valor booleano falso. |
| `NULL` | `nulo` | Representa la ausencia de un valor. |

### 4.4 Tipos de datos

| TokenType | Palabra Lumi |
|---|---|
| `INTEGER_TYPE` | `entero` |
| `DECIMAL_TYPE` | `decimal` |
| `STRING_TYPE` | `texto` |
| `BOOLEAN_TYPE` | `booleano` |
| `LIST_TYPE` | `lista` |
| `VECTOR_TYPE` | `vector` |

### 4.5 Palabras reservadas

Las palabras reservadas tienen un significado propio dentro del lenguaje Lumi y no pueden utilizarse como identificadores.

| Palabra Lumi | TokenType | Uso |
|---|---|---|
| `principal` | `PRINCIPAL` | Define el punto de entrada del programa. |
| `importar` | `IMPORT` | Importa otro archivo Lumi. |
| `usar` | `USE` | Indica el elemento que se utilizará de una importación. |
| `funcion` | `FUNCTION` | Declara una función. |
| `retornar` | `RETURN` | Retorna un valor desde una función. |
| `vacio` | `VOID` | Indica que una función no retorna un valor. |
| `si` | `IF` | Inicia una estructura condicional. |
| `sino` | `ELSE` | Define la alternativa de una condición. |
| `segun` | `SWITCH` | Inicia una estructura condicional múltiple. |
| `caso` | `CASE` | Define un caso dentro de `segun`. |
| `defecto` | `DEFAULT` | Define el caso por defecto de `segun`. |
| `hacer` | `FOR` | Inicia un ciclo con inicialización, condición y actualización. |
| `mientras` | `WHILE` | Ejecuta un bloque mientras se cumpla una condición. |
| `repetir` | `REPEAT` | Repite un bloque una cantidad determinada de veces. |
| `leer` | `READ` | Permite obtener una entrada. |
| `mostrar` | `SHOW` | Permite mostrar una salida. |
| `habitacion` | `ROOM` | Declara una habitación. |
| `piso` | `FLOOR` | Representa el piso de una habitación. |
| `pared` | `WALL` | Representa una pared. |
| `puerta` | `DOOR` | Representa una puerta. |
| `ventana` | `WINDOW` | Representa una ventana. |
| `colocar` | `PLACE` | Coloca un objeto en una ubicación. |
| `mover` | `MOVE` | Cambia la ubicación de un objeto. |
| `rotar` | `ROTATE` | Cambia la rotación de un objeto. |
| `visualizar3D` | `VISUALIZE_3D` | Solicita la visualización tridimensional. |
| `en` | `IN` | Indica una ubicación o relación espacial. |
| `color` | `COLOR` | Define una propiedad de color. |
| `material` | `MATERIAL` | Define una propiedad de material. |
| `posicion` | `POSITION` | Representa una propiedad de posición. |

### 4.6 Operadores y asignación

#### Asignación

| TokenType | Lexema | Descripción |
|---|---|---|
| `ASSIGN` | `=` | Asigna un valor a una variable. |

#### Operadores aritméticos

| TokenType | Lexema | Descripción |
|---|---|---|
| `PLUS` | `+` | Suma. |
| `MINUS` | `-` | Resta. |
| `MULTIPLY` | `*` | Multiplicación. |
| `DIVIDE` | `/` | División. |

#### Operadores lógicos

| TokenType | Lexema | Descripción |
|---|---|---|
| `AND` | `y` | Conjunción lógica. |
| `OR` | `o` | Disyunción lógica. |
| `NOT` | `no` | Negación lógica. |

#### Operadores relacionales

| TokenType | Lexema | Descripción |
|---|---|---|
| `EQUAL_EQUAL` | `==` | Igualdad. |
| `NOT_EQUAL` | `!=` | Desigualdad. |
| `GREATER` | `>` | Mayor que. |
| `LESS` | `<` | Menor que. |
| `GREATER_EQUAL` | `>=` | Mayor o igual que. |
| `LESS_EQUAL` | `<=` | Menor o igual que. |

## 5. Reglas léxicas

### 5.1 Identificadores

Los identificadores representan nombres definidos por el programador.

Un identificador de Lumi:

- Puede contener letras, números y guion bajo (`_`).
- No puede comenzar con un número.
- No puede coincidir con una palabra reservada.
- Se recomienda utilizar nombres descriptivos.

Ejemplos válidos:

- `ancho`
- `sala1`
- `cantidad_sillas`
- `material_piso`

### 5.2 Comentarios

Lumi utiliza `--` para definir comentarios.

Los comentarios son reconocidos por el lexer, pero no generan tokens que sean enviados a las siguientes etapas del compilador. Su contenido se ignora durante el análisis léxico.

Ejemplo:

`-- Este es un comentario`

Por esta razón, `TokenType` no contiene un tipo `COMMENT`.

### 5.3 Terminación de instrucciones

Las instrucciones simples de Lumi terminan con `>>`, representado mediante `TokenType.TERMINATOR`.

El símbolo `;` se utiliza como separador dentro de la cabecera del ciclo `hacer` y se representa mediante `TokenType.SEMICOLON`.

### 5.4 Delimitación de bloques

Los bloques de Lumi se delimitan mediante `{` y `}`.

La indentación es recomendada para mejorar la legibilidad del código, pero no determina la estructura de los bloques.