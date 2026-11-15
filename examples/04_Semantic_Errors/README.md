# Errores semánticos de Lumi

Cada programa incorrecto de esta carpeta contiene un solo error principal. Se
verificaron con `CompilerService → ExecutionService`: el compilador llegó a la
etapa semántica, produjo el diagnóstico documentado y bloqueó la ejecución. El
archivo 10 es el caso válido de comparación.

## 1. Variable no declarada

Archivo: `01_undeclared_variable.lumi`

```lumi
principal {
    mostrar(no_declarada)>>
}
```

Objetivo: usar un identificador que no existe en ningún alcance visible.

Resultado real: `SEM_UNDECLARED_VARIABLE`, línea 2, columna 13. Compilación
`failed`; ejecución `blocked`.

Responsable: `SemanticAnalyzer._infer_expression()` busca el identificador y
`SemanticAnalyzer._undefined()` crea el diagnóstico cuando
`SymbolTable.resolve()` devuelve `None`.

Para la defensa: el parser reconoce correctamente un identificador; el problema
aparece cuando la semántica intenta asociarlo con una declaración.

Pregunta: **¿Por qué no es un error sintáctico?**  
Respuesta: porque `mostrar(identificador)>>` tiene una estructura gramatical
válida, aunque ese nombre no haya sido declarado.

## 2. Variable duplicada

Archivo: `02_duplicate_variable.lumi`

```lumi
principal {
    entero cantidad = 4>>
    entero cantidad = 6>>
}
```

Resultado real: `SEM_DUPLICATE_SYMBOL` en la segunda declaración, línea 3,
columna 5. Compilación `failed`; ejecución `blocked`.

Responsable: `SemanticAnalyzer._analyze_variable_declaration()` intenta
registrar el segundo símbolo; `SymbolTable.define()` lo rechaza en el mismo
alcance.

Para la defensa: señalar que el diagnóstico apunta a la declaración repetida,
no a la primera declaración válida.

Pregunta: **¿Se prohíbe siempre repetir un nombre?**  
Respuesta: se prohíbe dentro del mismo alcance; un alcance hijo puede sombrear
un nombre externo, como demuestra el archivo 10.

## 3. Asignación incompatible

Archivo: `03_assignment_type_mismatch.lumi`

```lumi
principal {
    entero cantidad = 4>>
    cantidad = "cuatro">>
}
```

Resultado real: `SEM_TYPE_MISMATCH`, línea 3, columna 5. Compilación `failed`;
ejecución `blocked`.

Responsable: `SemanticAnalyzer._analyze_assignment()` recupera el tipo
`entero`; `TypeChecker.check_assignment()` rechaza el valor `texto`.

Para la defensa: la variable conserva el tipo declarado durante todo su alcance;
asignar otro tipo no cambia dinámicamente su contrato.

Pregunta: **¿Lumi convierte `"cuatro"` automáticamente?**  
Respuesta: no; no existe una conversión implícita de texto a entero.

## 4. Operación binaria inválida

Archivo: `04_invalid_binary_operation.lumi`

```lumi
principal {
    mostrar("Lumi" - 1)>>
}
```

Resultado real: `SEM_INVALID_BINARY_OPERATION`, línea 2, columna 13.
Compilación `failed`; ejecución `blocked`.

Responsable: `SemanticAnalyzer._infer_expression()` obtiene `texto` y `entero`;
`TypeChecker.check_binary_operation()` determina que `-` no está definido para
esa pareja.

Para la defensa: distinguir el tipo de cada operando del operador solicitado.

Pregunta: **¿La suma tendría el mismo resultado?**  
Respuesta: debe consultarse la tabla de operaciones del `TypeChecker`; no debe
suponerse que todos los operadores aceptan texto.

## 5. Condición no booleana

Archivo: `05_invalid_condition_type.lumi`

```lumi
principal {
    si 1 {
        mostrar("Esta condicion no es booleana")>>
    }
}
```

Resultado real: `SEM_CONDITION_NOT_BOOLEAN`, línea 2, columna 8. Compilación
`failed`; ejecución `blocked`.

Responsable: `SemanticAnalyzer._require_boolean()` infiere el tipo de la
condición y exige `booleano`.

Para la defensa: Lumi no usa la regla de Python donde algunos números se tratan
como verdaderos o falsos; la condición debe ser explícitamente booleana.

Pregunta: **¿Cómo se corrige?**  
Respuesta: usando una comparación, por ejemplo `si cantidad > 0`.

## 6. Variable fuera de alcance

Archivo: `06_variable_out_of_scope.lumi`

```lumi
principal {
    si verdadero {
        texto mensaje_local = "Visible dentro del bloque">>
        mostrar(mensaje_local)>>
    }
    mostrar(mensaje_local)>>
}
```

Resultado real: la referencia interna es válida; la externa produce solamente
`SEM_UNDECLARED_VARIABLE`, línea 6, columna 13. Compilación `failed`; ejecución
`blocked`.

Responsable: `SemanticAnalyzer._analyze_block()` crea un alcance hijo para el
bloque. Al salir restaura el alcance padre, desde el cual `mensaje_local` no es
visible.

Para la defensa: dibujar un alcance exterior y otro interior; la búsqueda puede
ir del hijo al padre, pero no del padre hacia los hijos.

Pregunta: **¿La variable desaparece físicamente?**  
Respuesta: su declaración deja de ser visible fuera del bloque tanto para el
análisis como para el entorno de ejecución correspondiente.

## 7. Retorno fuera de una función

Archivo: `07_return_outside_function.lumi`

Este caso sustituye el escenario solicitado de tipo desconocido.

```lumi
principal {
    retornar 1>>
}
```

Resultado real: `SEM_RETURN_OUTSIDE_FUNCTION`, línea 2, columna 5. Compilación
`failed`; ejecución `blocked`.

Responsable: `SemanticAnalyzer._analyze_return()` comprueba que
`current_function` no sea `None`.

Motivo de la sustitución: la gramática fuente solo reconoce los tipos oficiales.
La prueba directa `numero valor = 1>>` terminó en etapa sintáctica con
`SYN_UNEXPECTED_TOKEN`; nunca puede producir `SEM_UNKNOWN_TYPE` desde un archivo
Lumi normal. `SEM_UNKNOWN_TYPE` existe como protección para AST externos o
construidos manualmente.

Para la defensa: explicar que `retornar` necesita el contexto y el contrato de
una función.

Pregunta: **¿El intérprete también se protege?**  
Respuesta: sí, dispone de `RUN_RETURN_OUTSIDE_FUNCTION`, pero el pipeline normal
lo bloquea antes mediante semántica.

## 8. Retorno obligatorio ausente

Archivo: `08_missing_return.lumi`

```lumi
funcion entero calcular() {
    mostrar("La funcion termina sin retornar un entero")>>
}

principal {
    mostrar(calcular())>>
}
```

Resultado real: `SEM_MISSING_RETURN`, línea 1, columna 1. Compilación `failed`;
ejecución `blocked`.

Responsable: `SemanticAnalyzer._analyze_function_body()` llama a
`_block_guarantees_return()` para comprobar que una función no `vacio` tenga un
retorno garantizado.

Para la defensa: la función promete un `entero`; finalizar sin valor viola su
firma aunque su cuerpo contenga otras instrucciones válidas.

Pregunta: **¿Una función `vacio` necesita retornar?**  
Respuesta: no; precisamente declara que no entrega un valor.

## 9. Función duplicada

Archivo: `09_duplicate_function.lumi`

Objetivo: declarar dos firmas con el mismo nombre en el mismo alcance.

Resultado real: `SEM_DUPLICATE_SYMBOL` en la segunda función, línea 5, columna
1. Compilación `failed`; ejecución `blocked`.

Responsable: `SemanticAnalyzer._predeclare_functions()` registra anticipadamente
las firmas y `_register_function()` usa `SymbolTable.define()` para detectar el
conflicto.

Para la defensa: el registro previo permite llamar funciones antes de su
declaración, pero también detecta nombres duplicados de manera determinista.

Pregunta: **¿Lumi implementa sobrecarga por parámetros?**  
Respuesta: no en este contrato; el nombre ya ocupado produce duplicación.

## 10. Sombreado válido

Archivo: `10_valid_shadowing.lumi`

```lumi
entero valor = 10>>

funcion entero duplicar(entero valor) {
    retornar valor * 2>>
}

principal {
    mostrar(valor)>>
    mostrar(duplicar(3))>>
}
```

Resultado real: compilación y ejecución `completed`, sin diagnósticos. Salida:
`10` y `6`.

Responsable: `SemanticAnalyzer._analyze_function_body()` crea un alcance hijo
para la función. El parámetro `valor` sombrea al global sin modificarlo.

Para la defensa: contrastar este caso con la duplicación del archivo 02. Los
nombres coinciden, pero pertenecen a alcances diferentes.

Pregunta: **¿Cuál `valor` usa `duplicar`?**  
Respuesta: el parámetro local, por ser el símbolo visible más cercano.

## 11. Aislamiento de una función importada

Programa principal: `11_import_scope_isolation.lumi`  
Módulo auxiliar: `11_import_scope_module.lumi`

Principal:

```lumi
entero secreto = 99>>
importar "11_import_scope_module.lumi" usar revelar>>

principal {
    mostrar(revelar())>>
}
```

Módulo:

```lumi
funcion entero revelar() {
    retornar secreto>>
}
```

Objetivo: demostrar que una función importada no captura accidentalmente una
variable privada del módulo llamador.

Resultado real: `SEM_UNDECLARED_VARIABLE` en
`11_import_scope_module.lumi`, línea 2, columna 14. Compilación `failed`;
ejecución `blocked`.

Responsable: `SemanticAnalyzer._ensure_module_scope()` analiza el módulo en su
propia tabla de símbolos. Las funciones importadas conservan el alcance de su
módulo de declaración.

Para ejecutarlo correctamente con el pipeline, ambos archivos deben entregarse
en el mapa `sources` y `11_import_scope_isolation.lumi` debe ser el archivo
principal. El módulo auxiliar no es un programa principal independiente.

Para la defensa: explicar que las importaciones son léxicas, no una mezcla de
variables globales entre archivos.

Pregunta: **¿Cómo podría acceder legítimamente a un valor externo?**  
Respuesta: recibiéndolo como parámetro o declarándolo/importándolo explícitamente
según los contratos del módulo.

## Diferencia entre categorías de error

- **Léxico:** el Lexer no puede formar tokens válidos, por ejemplo ante un
  carácter no reconocido.
- **Sintáctico:** los tokens existen, pero no cumplen la gramática; por ejemplo,
  falta `>>` o una llave. El intento de declarar un tipo inventado en fuente
  también queda detenido por la gramática actual.
- **Semántico:** la estructura es válida, pero viola tipos, alcances, firmas o
  reglas del lenguaje. Todos los ejemplos inválidos de esta carpeta llegan a
  esta categoría.
- **Ejecución:** el programa superó el análisis, pero falla al evaluar un caso
  concreto, como dividir entre cero. El diagnóstico suele usar el prefijo
  `RUN_`.

`CompilerService` asigna la etapa correspondiente. `ExecutionService.execute()`
no invoca al intérprete cuando `compilation.can_execute` es falso; por eso los
casos semánticos aparecen como `blocked` y no generan errores secundarios de
runtime.

## Pruebas relacionadas

- `tests/integration/test_language_pipeline.py`: variables duplicadas, no
  declaradas, tipos y ubicaciones.
- `tests/semantic/test_type_checker.py`: asignaciones y operaciones inválidas.
- `tests/semantic/test_function_semantics.py`: retornos, funciones duplicadas y
  protección ante tipos desconocidos del AST.
- `tests/semantic/test_symbol_table.py`: alcances hijos y sombreado.
- `tests/integration/test_import_scope_isolation.py`: aislamiento semántico y de
  ejecución entre módulos.
