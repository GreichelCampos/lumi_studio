# AST Contract - Lumi

## 1. Propósito

Este documento define el contrato mínimo del Árbol de Sintaxis Abstracta (AST) de Lumi. Su objetivo es establecer una estructura común que pueda ser utilizada por el parser, el analizador semántico y el intérprete sin depender todavía de una implementación específica.

## 2. Información común de los nodos

Todos los nodos del AST deben conservar información sobre su ubicación dentro del archivo fuente para permitir diagnósticos precisos y navegación desde los errores hacia el código.

Cada nodo deberá incluir como mínimo:

* `file`: archivo `.lumi` donde se originó el nodo.
* `line`: línea donde comienza la construcción.
* `column`: columna donde comienza la construcción.

Esta información será utilizada posteriormente por `Diagnostic`, el analizador semántico y las herramientas de depuración de Estudio Lumi.
## 3. Nodos mínimos del AST

El AST de Lumi utilizará nodos específicos para representar las principales construcciones del lenguaje. Todos estos nodos conservarán la información común de ubicación definida anteriormente: `file`, `line` y `column`.

| Nodo                      | Representa                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `ProgramNode`             | Estructura general de un archivo o programa Lumi.                                   |
| `MainNode`                | Bloque `principal` que inicia la ejecución.                                         |
| `VariableDeclarationNode` | Declaración de una variable con su tipo, nombre y valor inicial.                    |
| `AssignmentNode`          | Asignación de un nuevo valor a una variable existente.                              |
| `IdentifierNode`          | Referencia a una variable, función u otro identificador.                            |
| `LiteralNode`             | Valores literales como entero, decimal, texto, booleano y `nulo`.                   |
| `ListNode`                | Lista cuyos elementos pueden ser expresiones.                                      |
| `VectorNode`              | Vector Lumi cuyos componentes `x`, `y` y `z` pueden ser expresiones.                |
| `BinaryExpressionNode`    | Expresiones con dos operandos, por ejemplo `+`, `-`, `*`, `/`, `==`, `>`, `y`, `o`. |
| `UnaryExpressionNode`     | Expresiones con un solo operando, como `no`.                                        |
| `IfNode`                  | Estructura condicional `si` y su bloque opcional `sino`.                            |
| `SwitchNode`              | Estructura condicional múltiple `segun`, `caso` y `defecto`.                        |
| `CaseNode`                | Caso individual de una estructura `segun`.                                         |
| `ForNode`                 | Ciclo `hacer` con inicialización, condición y actualización.                        |
| `WhileNode`               | Ciclo `mientras`.                                                                   |
| `RepeatNode`              | Estructura `repetir`.                                                               |
| `FunctionDeclarationNode` | Declaración de una función con parámetros, tipo de retorno y cuerpo.                |
| `ParameterNode`           | Parámetro declarado por una función.                                                |
| `FunctionCallNode`        | Llamada a una función.                                                              |
| `ReturnNode`              | Instrucción `retornar`.                                                             |
| `ShowNode`                | Instrucción `mostrar`.                                                              |
| `ReadNode`                | Expresión de entrada `leer` que devuelve el valor leído.                            |
| `ImportNode`              | Importación de símbolos desde otro archivo `.lumi`.                                 |
| `RoomNode`                | Declaración de una `habitacion`.                                                    |
| `FloorNode`               | Definición de propiedades del piso.                                                 |
| `WallNode`                | Definición de una pared.                                                            |
| `DoorNode`                | Declaración de una puerta.                                                          |
| `WindowNode`              | Declaración de una ventana.                                                         |
| `PlaceObjectNode`         | Instrucción `colocar` un objeto en una posición.                                    |
| `MoveObjectNode`          | Instrucción `mover` un objeto.                                                      |
| `RotateObjectNode`        | Instrucción `rotar` un objeto.                                                      |

### 3.1 Categorías generales

Para facilitar su organización, los nodos podrán agruparse conceptualmente en:

* **Estructura del programa:** `ProgramNode`, `MainNode`, `ImportNode`.
* **Variables y expresiones:** `VariableDeclarationNode`, `AssignmentNode`, `IdentifierNode`, `LiteralNode`, `ListNode`, `VectorNode`, `BinaryExpressionNode`, `UnaryExpressionNode`.
* **Control de flujo:** `IfNode`, `SwitchNode`, `CaseNode`, `ForNode`, `WhileNode`, `RepeatNode`.
* **Funciones y entrada/salida:** `FunctionDeclarationNode`, `ParameterNode`, `FunctionCallNode`, `ReturnNode`, `ShowNode`, `ReadNode`.
* **Lenguaje espacial:** `RoomNode`, `FloorNode`, `WallNode`, `DoorNode`, `WindowNode`, `PlaceObjectNode`, `MoveObjectNode`, `RotateObjectNode`.

Esta lista representa el contrato mínimo inicial del AST y podrá ampliarse únicamente si durante la implementación aparece una construcción del lenguaje que no pueda representarse adecuadamente con estos nodos.

## 4. Propiedades mínimas de los nodos AST

Además de `file`, `line` y `column`, cada tipo de nodo almacenará únicamente la información necesaria para representar la construcción correspondiente del lenguaje Lumi.

| Nodo                      | Propiedades mínimas                          |
| ------------------------- | -------------------------------------------- |
| `ProgramNode`             | `statements`                                 |
| `MainNode`                | `body`                                       |
| `VariableDeclarationNode` | `type`, `name`, `value`                      |
| `AssignmentNode`          | `name`, `value`                              |
| `IdentifierNode`          | `name`                                       |
| `LiteralNode`             | `value`, `literal_kind`                      |
| `ListNode`                | `elements`                                   |
| `VectorNode`              | `x`, `y`, `z`                                |
| `BinaryExpressionNode`    | `left`, `operator`, `right`                  |
| `UnaryExpressionNode`     | `operator`, `operand`                        |
| `IfNode`                  | `condition`, `then_body`, `else_body`        |
| `SwitchNode`              | `expression`, `cases`, `default_body`        |
| `CaseNode`                | `value`, `body`                              |
| `ForNode`                 | `initializer`, `condition`, `update`, `body` |
| `WhileNode`               | `condition`, `body`                          |
| `RepeatNode`              | `count`, `body`                              |
| `FunctionDeclarationNode` | `name`, `parameters`, `return_type`, `body`  |
| `ParameterNode`           | `name`, `data_type`                          |
| `FunctionCallNode`        | `name`, `arguments`                          |
| `ReturnNode`              | `value`                                      |
| `ShowNode`                | `expression`                                 |
| `ReadNode`                | `message`                                    |
| `ImportNode`              | `file_name`, `symbol_name`                   |
| `RoomNode`                | `name`, `width`, `length`, `height`, `body`  |
| `FloorNode`               | `material`                                   |
| `WallNode`                | `direction`, `properties`                    |
| `DoorNode`                | `direction`, `properties`                    |
| `WindowNode`              | `direction`, `properties`                    |
| `PlaceObjectNode`         | `object_type`, `position`                    |
| `MoveObjectNode`          | `object_name`, `position`                    |
| `RotateObjectNode`        | `object_name`, `rotation`                    |

### 4.1 Descripción de las propiedades

* `body`: lista de instrucciones contenidas dentro de un bloque.
* `statements`: instrucciones principales contenidas en el programa.
* `type`: tipo declarado de una variable.
* `name`: nombre de un identificador.
* `value`: valor o expresión asociada al nodo.
* `literal_kind`: clase del literal, por ejemplo `entero`, `decimal`, `texto`, `booleano` o `nulo`. El valor `nulo` es un valor especial de Lumi y no constituye un tipo de dato independiente.
* `elements`: lista de nodos de expresión que componen un `ListNode`.
* `x`, `y` y `z`: componentes numéricos de un `VectorNode`; cada componente puede ser un nodo de expresión.
* `left` y `right`: operandos de una expresión binaria.
* `operator`: operador utilizado en una expresión.
* `condition`: expresión que debe evaluarse como booleana.
* `parameters`: lista de nodos `ParameterNode` declarados por una función.
* `arguments`: valores o expresiones enviados al llamar una función.
* `return_type`: tipo de retorno declarado por una función.
* `cases`: lista de nodos `CaseNode` pertenecientes a una estructura `segun`.
* `position`: nodo `VectorNode` que representa una posición `[x, y, z]`.
* `rotation`: vector que representa una rotación.
* `properties`: propiedades asociadas a un elemento espacial.
* `direction`: dirección de una pared, puerta o ventana.
* `file_name`: nombre del archivo `.lumi` que se desea importar.
* `symbol_name`: símbolo solicitado mediante `usar`.
* `object_type`: tipo de objeto perteneciente inicialmente al catálogo incorporado de objetos de Lumi.

Las propiedades cuyo contenido represente otra construcción del lenguaje deberán contener otros nodos AST. Por ejemplo, `value`, `condition`, `left`, `right` y los elementos de `body` podrán contener nodos correspondientes a expresiones o instrucciones.

### 4.2 Clasificación conceptual de nodos

Esta clasificación es conceptual y no obliga todavía a implementar herencia de clases.

**Expresiones:**

* `LiteralNode`
* `IdentifierNode`
* `ListNode`
* `VectorNode`
* `BinaryExpressionNode`
* `UnaryExpressionNode`
* `FunctionCallNode`
* `ReadNode`

**Declaraciones / instrucciones:**

* `VariableDeclarationNode`
* `AssignmentNode`
* `IfNode`
* `SwitchNode`
* `ForNode`
* `WhileNode`
* `RepeatNode`
* `FunctionDeclarationNode`
* `ReturnNode`
* `ShowNode`
* `ImportNode`
* `RoomNode`
* `FloorNode`
* `WallNode`
* `DoorNode`
* `WindowNode`
* `PlaceObjectNode`
* `MoveObjectNode`
* `RotateObjectNode`

**Nodos auxiliares:**

* `ParameterNode`
* `CaseNode`

Las propiedades `VariableDeclarationNode.value`, `AssignmentNode.value`, `IfNode.condition`, `BinaryExpressionNode.left` y `BinaryExpressionNode.right` deben contener nodos de expresión compatibles.

Los nodos `RoomNode`, `FloorNode`, `WallNode`, `DoorNode` y `WindowNode` deben conservar la información sintáctica necesaria para que posteriormente el intérprete y la capa espacial puedan generar y validar `ScenePlan`. Este contrato no define la estructura interna de `ScenePlan`.

## 5. Contrato de Diagnostic

`Diagnostic` será la estructura común utilizada por Lumi para representar los errores detectados durante las diferentes etapas del procesamiento de un proyecto.

Su objetivo es permitir que el lexer, parser, analizador semántico, sistema de importaciones, intérprete y validador espacial reporten los problemas utilizando una estructura uniforme.

### 5.1 Propiedades mínimas

| Propiedad     | Descripción                                                               |
| ------------- | ------------------------------------------------------------------------- |
| `category`    | Categoría a la que pertenece el diagnóstico.                              |
| `code`        | Código único que identifica el tipo de error.                             |
| `file`        | Archivo `.lumi` donde se detectó el problema.                             |
| `line`        | Línea donde se detectó el problema.                                       |
| `column`      | Columna donde se detectó el problema.                                     |
| `description` | Explicación comprensible del error.                                       |
| `suggestion`  | Información opcional que puede orientar al usuario sobre la causa o posible corrección del problema. |

### 5.2 Categorías

Los valores iniciales permitidos para `category` serán:

* `LEXICAL`
* `SYNTACTIC`
* `SEMANTIC`
* `IMPORT`
* `RUNTIME`
* `SPATIAL`

Estas categorías corresponden respectivamente a errores léxicos, sintácticos, semánticos, de importación, de ejecución y espaciales.

### 5.3 Convención para códigos

Los códigos utilizarán un prefijo que permita identificar rápidamente la categoría del diagnóstico:

| Prefijo   | Categoría   |
| --------- | ----------- |
| `LEX_`    | Léxico      |
| `SYN_`    | Sintáctico  |
| `SEM_`    | Semántico   |
| `IMPORT_` | Importación |
| `RUN_`    | Ejecución   |
| `SPA_`    | Espacial    |

Ejemplos:

* `LEX_UNKNOWN_SYMBOL`
* `SYN_EXPECTED_TERMINATOR`
* `SEM_UNDECLARED_VARIABLE`
* `IMPORT_FILE_NOT_FOUND`
* `RUN_DIVISION_BY_ZERO`
* `SPA_OBJECT_OUT_OF_BOUNDS`

### 5.4 Ejemplo de Diagnostic

Un error producido por el uso de una variable no declarada podría representarse conceptualmente de la siguiente manera:

Diagnostic

* `category`: `SEMANTIC`
* `code`: `SEM_UNDECLARED_VARIABLE`
* `file`: `principal.lumi`
* `line`: 8
* `column`: 5
* `description`: `La variable 'cantidad' no ha sido declarada.`
* `suggestion`: `Declare la variable antes de utilizarla.`

El contrato de `Diagnostic` será compartido por los distintos módulos del lenguaje para evitar que cada componente utilice una representación diferente de los errores.
## 6. Contrato de SymbolTable

`SymbolTable` será la estructura utilizada durante el análisis semántico para registrar y consultar los símbolos declarados en un programa Lumi.

Permitirá controlar la existencia de variables y funciones, sus tipos y el alcance en el que fueron declaradas.

### 6.1 Símbolos

Cada símbolo almacenado deberá contener como mínimo:

| Propiedad   | Descripción                                                 |
| ----------- | ----------------------------------------------------------- |
| `name`      | Nombre del símbolo.                                         |
| `kind`      | Tipo de símbolo, por ejemplo variable, función o parámetro. |
| `data_type` | Tipo de dato asociado al símbolo.                           |
| `file`      | Archivo donde fue declarado.                                |
| `line`      | Línea donde fue declarado.                                  |
| `column`    | Columna donde fue declarado.                                |

Como metadatos opcionales, un símbolo también podrá conservar:

| Propiedad     | Descripción                                                    |
| ------------- | -------------------------------------------------------------- |
| `source_file` | Archivo Lumi de origen en el que fue definido el símbolo.      |
| `is_imported` | Indica si el símbolo proviene de otro archivo Lumi.            |

Estos metadatos permiten identificar símbolos provenientes de otro archivo Lumi sin definir todavía la resolución completa de importaciones.

Para símbolos correspondientes a funciones también deberá conservarse:

| Propiedad     | Descripción                                    |
| ------------- | ---------------------------------------------- |
| `parameters`  | Lista de parámetros de la función y sus tipos. |
| `return_type` | Tipo de retorno declarado por la función.      |

### 6.2 Alcances

Lumi utilizará alcance léxico por bloques.

Cada `SymbolTable` representará un alcance y podrá mantener una referencia a su alcance padre.

Conceptualmente:

Global
└── principal
├── variable ancho
└── bloque si
└── variable mensaje

Una variable declarada dentro de un bloque únicamente podrá utilizarse dentro de ese bloque y sus bloques internos.

Cuando finalice el bloque, dicha variable dejará de estar disponible fuera de ese alcance.

### 6.3 Operaciones mínimas

`SymbolTable` deberá permitir conceptualmente las siguientes operaciones:

| Operación              | Propósito                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `define`               | Registrar un nuevo símbolo en el alcance actual.                                         |
| `resolve`              | Buscar un símbolo comenzando en el alcance actual y continuando por los alcances padres. |
| `exists_current_scope` | Comprobar si un símbolo ya está declarado en el alcance actual.                          |
| `create_child_scope`   | Crear un nuevo alcance hijo asociado al alcance actual.                                  |

Estas operaciones representan el contrato esperado y no obligan todavía a una implementación específica.

### 6.4 Ejemplo de alcance

Para el siguiente código Lumi:

entero cantidad = 4>>

si cantidad > 2 {
texto mensaje = "Habitación amplia">>
mostrar(mensaje)>>
}

`cantidad` pertenece al alcance exterior y puede utilizarse dentro del bloque `si`.

`mensaje` pertenece al alcance del bloque `si`, por lo que podrá utilizarse dentro de ese bloque, pero no deberá estar disponible fuera de él.

Si se intenta utilizar un símbolo que no puede resolverse en el alcance actual ni en sus alcances padres, el analizador semántico podrá generar un `Diagnostic` con código `SEM_UNDECLARED_VARIABLE`.
## 7. Ejemplos de AST

Los siguientes ejemplos muestran cómo las construcciones del lenguaje Lumi pueden representarse utilizando los nodos definidos en este contrato. Estos ejemplos funcionan como referencia para el parser, el analizador semántico y el intérprete.

Para facilitar la lectura, los campos comunes `file`, `line` y `column` pueden mostrarse únicamente en el nodo raíz de cada representación conceptual. Todos los nodos anidados, incluidos los nodos `LiteralNode`, conservan igualmente estos campos conforme a la sección 2.

### 7.1 AST de ejemplo 1: declaración de variable

Código Lumi:

```lumi
entero cantidad = 4>>
```

Representación conceptual:

```text
VariableDeclarationNode
├── type: "entero"
├── name: "cantidad"
├── value:
│   └── LiteralNode
│       ├── value: 4
│       └── literal_kind: "entero"
├── file: "principal.lumi"
├── line: 1
└── column: 1
```

Este AST permite representar una declaración de variable, su tipo, su nombre y la expresión utilizada como valor inicial.

---

### 7.2 AST de ejemplo 2: estructura condicional

Código Lumi:

```lumi
si ancho >= 5 {
    mostrar("La habitación es amplia")>>
} sino {
    mostrar("La habitación es compacta")>>
}
```

Representación conceptual:

```text
IfNode
├── condition:
│   └── BinaryExpressionNode
│       ├── left:
│       │   └── IdentifierNode
│       │       └── name: "ancho"
│       ├── operator: ">="
│       └── right:
│           └── LiteralNode
│               ├── value: 5
│               └── literal_kind: "entero"
│
├── then_body:
│   └── ShowNode
│       └── expression:
│           └── LiteralNode
│               ├── value: "La habitación es amplia"
│               └── literal_kind: "texto"
│
├── else_body:
│   └── ShowNode
│       └── expression:
│           └── LiteralNode
│               ├── value: "La habitación es compacta"
│               └── literal_kind: "texto"
│
├── file: "principal.lumi"
├── line: 1
└── column: 1
```

Este ejemplo muestra cómo los nodos pueden anidarse. La condición del `IfNode` contiene una expresión binaria y sus bloques contienen instrucciones.

---

### 7.3 AST de ejemplo 3: habitación y colocación de objeto

Código Lumi:

```lumi
habitacion sala(5, 4, 2.7) {
    colocar mesa en [0, 0, 0]>>
}
```

Representación conceptual:

```text
RoomNode
├── name: "sala"
├── width:
│   └── LiteralNode
│       ├── value: 5
│       └── literal_kind: "entero"
├── length:
│   └── LiteralNode
│       ├── value: 4
│       └── literal_kind: "entero"
├── height:
│   └── LiteralNode
│       ├── value: 2.7
│       └── literal_kind: "decimal"
│
├── body:
│   └── PlaceObjectNode
│       ├── object_type: "mesa"
│       └── position:
│           └── VectorNode
│               ├── x:
│               │   └── LiteralNode
│               │       ├── value: 0
│               │       └── literal_kind: "entero"
│               ├── y:
│               │   └── LiteralNode
│               │       ├── value: 0
│               │       └── literal_kind: "entero"
│               └── z:
│                   └── LiteralNode
│                       ├── value: 0
│                       └── literal_kind: "entero"
│
├── file: "principal.lumi"
├── line: 1
└── column: 1
```

Este ejemplo representa una construcción propia del dominio de Lumi. `RoomNode` almacena las dimensiones de la habitación y su cuerpo contiene las instrucciones espaciales que deben procesarse dentro de ella.

### 7.4 Uso de los ejemplos

Estos AST constituyen fixtures conceptuales iniciales para comprobar que los módulos principales compartan la misma estructura.

El parser deberá producir estructuras compatibles con este contrato, mientras que el analizador semántico y el intérprete deberán poder consumirlas sin depender de detalles internos del parser.
