# Entrada y salida en Lumi

Estos ejemplos se verificaron en `feature/lumi-ide-testing` mediante
`CompilerService` y `ExecutionService`. Para los archivos con `leer()` se
inyectó deliberadamente un proveedor de entrada controlado que devuelve
`"Grei"`; no se leyó desde la terminal ni se simuló una capacidad del IDE.

## 1. Mostrar texto

Archivo: `01_show_text.lumi`

Objetivo: escribir dos literales de texto en la salida del programa.

```lumi
principal {
    mostrar("Bienvenida a Lumi")>>
    mostrar("Este mensaje viene de mostrar")>>
}
```

Resultado real: compilación y ejecución `completed`, sin diagnósticos. Salida:

1. `Bienvenida a Lumi`
2. `Este mensaje viene de mostrar`

Código Python: `Parser.parse_show()` en `lumi_language/parser.py` crea un
`ShowNode`; `Interpreter._execute_node()` evalúa su expresión y agrega el texto
a `InterpreterResult.output`.

Para la defensa: `mostrar()` recibe una expresión, no solamente texto, y `>>`
termina la instrucción.

Pregunta: **¿`mostrar` escribe directamente en la consola del sistema?**  
Respuesta: no. El intérprete agrega valores formateados a su resultado y el
servicio o el IDE decide cómo presentarlos.

## 2. Mostrar variables

Archivo: `02_show_variables.lumi`

Objetivo: presentar variables `texto`, `entero`, `decimal` y `booleano`.

Resultado real: compilación y ejecución `completed`, sin diagnósticos. Salida:
`Lumi`, `4`, `2.5` y `verdadero`.

Código Python: `SemanticAnalyzer._infer_expression()` resuelve el tipo del
identificador; `Interpreter._evaluate()` obtiene el valor del entorno y
`Interpreter._format_value()` produce la representación de salida.

Para la defensa: explicar que el valor booleano se representa con la palabra de
Lumi `verdadero`, no con el texto interno de Python `True`.

Pregunta: **¿Qué ocurre al mostrar una variable inexistente?**  
Respuesta: el análisis genera `SEM_UNDECLARED_VARIABLE` y bloquea la ejecución.

## 3. Mostrar el resultado de una función

Archivo: `03_show_function_result.lumi`

Objetivo: utilizar una llamada como expresión de `mostrar()`.

```lumi
funcion decimal calcular_area(decimal ancho, decimal largo) {
    retornar ancho * largo>>
}

principal {
    mostrar("Area calculada:")>>
    mostrar(calcular_area(5, 4))>>
}
```

Resultado real: compilación y ejecución `completed`, sin diagnósticos. Salida:
`Area calculada:` y `20`.

Código Python: `SemanticAnalyzer._infer_function_call()` aporta el tipo de
retorno a la expresión; `Interpreter._evaluate_function_call()` ejecuta la
función y entrega el valor a `mostrar()`.

Para la defensa: explicar que `mostrar` no conoce cómo se calculó el valor; solo
recibe el resultado ya evaluado.

Pregunta: **¿Puede mostrarse una llamada anidada?**  
Respuesta: sí, siempre que las llamadas sean válidas y produzcan tipos
compatibles.

## 4. Mostrar expresiones

Archivo: `04_show_expressions.lumi`

Objetivo: demostrar expresiones aritméticas, relacionales y lógicas.

```lumi
principal {
    mostrar(2 + 3 * 4)>>
    mostrar(10 / 4)>>
    mostrar(5 > 3)>>
    mostrar(verdadero y falso)>>
}
```

Resultado real: compilación y ejecución `completed`, sin diagnósticos. Salida:
`14`, `2.5`, `verdadero` y `falso`.

Código Python: `TypeChecker.check_binary_operation()` valida las operaciones;
`Interpreter._evaluate_binary()` las calcula respetando el AST producido por el
parser.

Para la defensa: usar `2 + 3 * 4 = 14` para explicar que el parser conserva la
precedencia de operadores.

Pregunta: **¿Qué ocurre con `4 / 0`?**  
Respuesta: la ejecución produce el diagnóstico controlado
`RUN_DIVISION_BY_ZERO`.

## 5. Leer texto

Archivo: `05_read_text.lumi`

Objetivo: solicitar un texto y almacenarlo sin producir salida adicional.

```lumi
principal {
    texto nombre = leer("Nombre para la defensa:")>>
}
```

Resultado real con proveedor controlado:

- Compilación: `completed`, sin diagnósticos.
- Prompt recibido por el proveedor: `Nombre para la defensa:`.
- Valor devuelto por el proveedor: `Grei`.
- Ejecución: `completed`; la salida queda vacía porque el programa no llama a
  `mostrar()`.

Código Python:

- `Parser.parse_read()` crea un `ReadNode`.
- `SemanticAnalyzer._infer_expression()` asigna a `leer()` el tipo `texto`.
- `Interpreter._evaluate()` llama a `input_provider` con el mensaje evaluado.

Para la defensa: destacar que `leer()` no accede directamente a `input()` de
Python; depende de un proveedor suministrado por el host.

Pregunta: **¿El análisis solicita el dato?**  
Respuesta: no. El proveedor se invoca únicamente durante la ejecución.

## 6. Leer y mostrar

Archivo: `06_read_and_show.lumi`

Objetivo: recorrer el flujo completo prompt → valor → variable → salida.

```lumi
principal {
    texto nombre = leer("Escriba su nombre:")>>
    mostrar("Nombre recibido:")>>
    mostrar(nombre)>>
}
```

Resultado real con proveedor controlado:

- Prompt: `Escriba su nombre:`.
- Respuesta inyectada: `Grei`.
- Compilación y ejecución: `completed`, sin diagnósticos.
- Salida: `Nombre recibido:` y `Grei`.

Código Python: además de los métodos anteriores,
`ExecutionService.__init__()` permite inyectar una fábrica de intérpretes. La
prueba usó conceptualmente:

```python
ExecutionService(
    interpreter_factory=lambda: Interpreter(
        input_provider=lambda prompt: "Grei"
    )
)
```

Para la defensa: aclarar que este es un caso auténtico del backend con una
dependencia controlada, no una lectura interactiva demostrada en el IDE.

Pregunta: **¿Qué pasa si el host no ofrece entrada?**  
Respuesta: el `ExecutionService` predeterminado lanza
`InputUnavailableError`; no bloquea esperando `stdin` ni inventa un diagnóstico
del estudiante.

## 7. Tipo incompatible de entrada

Archivo: `07_input_type_mismatch.lumi`

Objetivo: demostrar que `leer()` devuelve `texto`, aunque el mensaje solicite
conceptualmente un número.

```lumi
principal {
    entero edad = leer("Edad:")>>
    mostrar(edad)>>
}
```

Resultado real:

- Compilación: `failed` en semántica.
- Único diagnóstico: `SEM_TYPE_MISMATCH`, línea 2, columna 5.
- Descripción: no puede asignarse `texto` a una variable `entero`.
- Ejecución: `blocked`; el proveedor de entrada no se invoca.

Código Python: `SemanticAnalyzer._infer_expression()` devuelve
`DataType.STRING` para `ReadNode`; el `TypeChecker` rechaza la asignación a
`entero`.

Para la defensa: el texto del prompt `"Edad:"` no cambia el tipo de retorno. En
esta versión Lumi no hay una conversión automática de texto a entero.

Pregunta: **¿Se solucionaría devolviendo `"25"` desde el proveedor?**  
Respuesta: no en el análisis; `"25"` continúa siendo texto y la incompatibilidad
se detecta antes de ejecutar.

## Limitación real de `leer()` en el IDE

En esta rama, el backend directo admite `leer()` solo cuando el host configura
un `input_provider`. El `ExecutionService` usado por el worker no configura uno:
su proveedor predeterminado genera `InputUnavailableError`. Además, el protocolo
publica `capabilities.interactiveInput: false` en
`services/protocol/adapters.py` y `services/protocol/models.py`.

Por ello, estos ejemplos **no prueban entrada interactiva F6 en Lumi Studio**.
Los archivos 05 y 06 están verificados mediante backend con entrada inyectada y
son apropiados para explicar diseño y pruebas automatizadas. No deben presentarse
como una interacción funcional del IDE en esta rama.

## Estado de `seleccionar`

`seleccionar` no aparece como palabra reservada en
`lumi_language/lexer_config.py`, no tiene `TokenType`, nodo AST ni método de
parser. Por tanto, no existe actualmente como instrucción del lenguaje Lumi y no
se creó un ejemplo ejecutable ficticio. No debe confundirse con funciones que un
programador podría nombrar `seleccionar` ni con seleccionar objetos en el visor
3D.

Pregunta: **¿Por qué no se incluyó un archivo de `seleccionar`?**  
Respuesta: porque la defensa debe demostrar únicamente sintaxis implementada;
crear ese archivo produciría una afirmación falsa sobre el lenguaje.

## Pruebas relacionadas

- `tests/parser/test_parser.py`: AST de `leer()` y `mostrar()`.
- `tests/interpreter/test_interpreter.py`: valor retornado por un proveedor de
  entrada y salida de `mostrar()`.
- `tests/services/test_execution_service.py`: proveedor inyectado, ausencia de
  entrada del host y propagación de fallos de infraestructura.
- `tests/protocol/test_dispatcher.py` y `tests/protocol/test_worker.py`: el
  análisis no solicita entrada y el worker no lee accidentalmente su `stdin` de
  protocolo.
