# Ejemplos de funciones para la defensa de Grei

Estos programas usan la sintaxis real de Lumi disponible en
`feature/lumi-ide-testing`. Se verificaron el 15 de noviembre de 2026 mediante
`CompilerService` y `ExecutionService`, es decir, con el flujo real
Lexer → Parser → SemanticAnalyzer → Interpreter.

## 1. Función con retorno

Archivo: `01_function_with_return.lumi`

Objetivo: demostrar un parámetro, una expresión aritmética, el retorno tipado y
el uso del valor retornado para inicializar una variable.

```lumi
funcion entero cuadrado(entero valor) {
    retornar valor * valor>>
}

principal {
    entero resultado = cuadrado(6)>>
    mostrar("Resultado del cuadrado:")>>
    mostrar(resultado)>>
}
```

Resultado esperado y obtenido:

- Compilación: `completed`, sin diagnósticos.
- Ejecución: `completed`, sin diagnósticos.
- Salida: `Resultado del cuadrado:` y `36`.

Código Python relacionado:

- `SemanticAnalyzer._register_function()`, `_analyze_function()` e
  `_infer_function_call()` en `lumi_language/semantic_analyzer.py`.
- `Interpreter._evaluate_function_call()` en
  `lumi_language/interpreter.py`.

Durante la defensa: explicar que la firma registra el nombre, el parámetro y el
tipo de retorno antes de analizar el cuerpo. La llamada crea un alcance local,
asigna `6` a `valor` y `retornar` entrega `36` al llamador.

Pregunta posible: **¿Qué ocurre si se pasa un texto?**  
Respuesta: el análisis genera `SEM_ARGUMENT_TYPE_MISMATCH` antes de ejecutar.

## 2. Función sin retorno

Archivo: `02_function_without_return.lumi`

Objetivo: demostrar una función `vacio` utilizada como instrucción y confirmar
que el programa continúa después de la llamada.

```lumi
funcion vacio saludar() {
    mostrar("Hola desde una funcion vacio")>>
}

principal {
    saludar()>>
    mostrar("La ejecucion continua")>>
}
```

Resultado esperado y obtenido:

- Compilación: `completed`, sin diagnósticos.
- Ejecución: `completed`, sin diagnósticos.
- Salida: `Hola desde una funcion vacio` y `La ejecucion continua`.

Código Python relacionado:

- `SemanticAnalyzer._analyze_function_body()` valida que una función `vacio`
  no necesite retornar un valor.
- `Interpreter._evaluate_function_call()` termina con `None` cuando el cuerpo
  finaliza normalmente.

Durante la defensa: explicar que `vacio` describe una acción y no un valor para
una expresión. La función puede producir salida, pero no declara un resultado.

Pregunta posible: **¿Puede una función `vacio` usar `retornar 1`?**  
Respuesta: no; genera `SEM_RETURN_TYPE_MISMATCH`.

## 3. Función con efecto espacial

Archivo: `03_function_with_spatial_effect.lumi`

Objetivo: demostrar que una función llamada dentro de una habitación puede
declarar, colocar y rotar un mueble en el `ScenePlan`.

```lumi
funcion vacio preparar_mesa() {
    mesa mesa_defensa {
        color "azul">>
        material "madera">>
    }
    colocar mesa_defensa [0, 0, 0]>>
    rotar mesa_defensa [0, 90, 0]>>
}

principal {
    habitacion sala(6, 5, 3) {
        preparar_mesa()>>
    }
}
```

Resultado esperado y obtenido:

- Compilación: `completed`, sin diagnósticos.
- Ejecución: `completed`, sin diagnósticos.
- Escena: habitación `sala`, elemento `mesa_defensa`, posición `[0, 0, 0]` y
  rotación `[0, 90, 0]`.

Código Python relacionado:

- `SpatialSemanticAnalyzer.apply_function_effects()` en
  `lumi_language/spatial_semantic_analyzer.py` aplica el resumen espacial de la
  función durante el análisis.
- `Interpreter._declare_spatial_element()`, `_place_spatial_element()` y
  `_rotate_spatial_element()` en `lumi_language/interpreter.py` producen el
  estado espacial real durante la ejecución.

Durante la defensa: diferenciar el análisis, que anticipa los efectos, de la
ejecución, que construye la escena final. Ambos reconocieron la misma mesa.

Pregunta posible: **¿Por qué se llama dentro de una habitación?**  
Respuesta: porque la declaración y las operaciones necesitan una habitación
activa a la cual pertenecer.

## 4. Función con condición

Archivo: `04_function_with_condition.lumi`

Objetivo: demostrar que el flujo de control decide si ocurre un efecto espacial.

```lumi
funcion vacio agregar_silla(booleano permitida) {
    si permitida {
        silla silla_defensa {
            color "verde">>
            material "madera">>
        }
        colocar silla_defensa [1, 0, 0]>>
    }
}

principal {
    habitacion estudio(6, 5, 3) {
        agregar_silla(verdadero)>>
    }
}
```

Resultado esperado y obtenido:

- Compilación: `completed`, sin diagnósticos.
- Ejecución: `completed`, sin diagnósticos.
- Escena: habitación `estudio` con `silla_defensa` en `[1, 0, 0]`.

Código Python relacionado:

- `SemanticAnalyzer._infer_function_call()` comprueba el argumento booleano.
- `SpatialSemanticAnalyzer._apply_effect_alternatives()` conserva correctamente
  los caminos posibles durante el análisis.
- `Interpreter._execute_node()` evalúa la condición y ejecuta solamente el
  cuerpo seleccionado.

Durante la defensa: señalar que el analizador no debe presentar como obligatorio
un efecto de una ruta opcional; el intérprete sí conoce el valor real y en este
caso ejecuta la rama verdadera.

Pregunta posible: **¿Qué cambia con `falso`?**  
Respuesta: la ejecución no crea la silla; no se simula el efecto de una rama que
no fue tomada.

## 5. Retorno incompatible

Archivo: `05_invalid_return_type.lumi`

Objetivo: mostrar un error semántico aislado: la función promete `entero`, pero
retorna `texto`.

```lumi
funcion entero cantidad_muebles() {
    retornar "cuatro">>
}

principal {
    mostrar(cantidad_muebles())>>
}
```

Resultado esperado y obtenido:

- Compilación: `failed` en la etapa semántica.
- Diagnóstico: `SEM_RETURN_TYPE_MISMATCH`, línea 2, columna 5.
- Ejecución: `blocked`; no se ejecuta un programa semánticamente inválido.

Código Python relacionado:

- `SemanticAnalyzer._analyze_return()` infiere el tipo de la expresión y usa
  `TypeChecker` para compararlo con el tipo declarado.
- `ExecutionService.execute()` bloquea la ejecución cuando la compilación no es
  ejecutable.

Durante la defensa: explicar que el parser acepta la estructura, pero la
semántica detecta que `"cuatro"` no cumple el contrato `entero`.

Pregunta posible: **¿Por qué no es un error sintáctico?**  
Respuesta: porque la escritura es gramaticalmente válida; el problema es la
incompatibilidad de tipos.

## 6. Función recursiva

Archivo: `06_recursive_function.lumi`

Objetivo: demostrar recursión directa con un caso base que garantiza la
terminación para el valor utilizado.

```lumi
funcion entero factorial(entero valor) {
    si valor <= 1 {
        retornar 1>>
    }
    retornar valor * factorial(valor - 1)>>
}

principal {
    mostrar("Factorial de 5:")>>
    mostrar(factorial(5))>>
}
```

Resultado esperado y obtenido:

- Análisis: `incomplete`, sin diagnósticos. Esta es una limitación conservadora
  real del análisis de efectos recursivos, no un error del programa.
- Ejecución: `completed`, sin diagnósticos.
- Salida: `Factorial de 5:` y `120`.

Código Python relacionado:

- `SemanticAnalyzer._infer_function_call()` resuelve la llamada recursiva.
- El análisis iterativo de componentes recursivos está coordinado con
  `SpatialSemanticAnalyzer.apply_unknown_function_effects()`.
- `Interpreter._evaluate_function_call()` crea un alcance por llamada; el
  `ReturnNode` detiene cada invocación y devuelve su valor.

Durante la defensa: recorrer `factorial(5)` hasta el caso base y luego explicar
el retorno acumulado `5 × 4 × 3 × 2 × 1`. También aclarar honestamente que el
compilador conserva `incomplete` cuando no puede certificar todos los efectos de
un ciclo recursivo, aunque el intérprete ejecute correctamente este caso.

Pregunta posible: **¿Qué evita una recursión infinita aquí?**  
Respuesta: la condición `valor <= 1` y la llamada con `valor - 1`. Además, el
intérprete tiene límites de seguridad para recursiones que no terminan.

## Pruebas automatizadas relacionadas

- `tests/semantic/test_function_semantics.py`: firmas, argumentos, retornos y
  retornos faltantes.
- `tests/interpreter/test_function_runtime.py`: funciones `vacio`, valores de
  retorno, alcances y factorial recursivo.
- `tests/semantic/test_spatial_function_control_flow.py`: efectos espaciales de
  funciones bajo condiciones y ciclos.
- `tests/semantic/test_spatial_recursive_function_effects.py`: análisis seguro
  de recursión directa y mutua, incluidas rutas inalcanzables.

Para repetir la comprobación se debe compilar cada archivo con
`CompilerService.compile()` y ejecutar el resultado con
`ExecutionService.execute()`. El quinto archivo debe fallar con el diagnóstico
documentado; los demás deben ejecutarse sin diagnósticos.
