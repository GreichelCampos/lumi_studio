# Parámetros y llamadas de funciones

Estos ejemplos fueron verificados en `feature/lumi-ide-testing` mediante el
pipeline público `CompilerService → ExecutionService`. Los cuatro primeros son
programas válidos; los cuatro últimos aíslan un diagnóstico semántico concreto.

## 1. Un parámetro

Archivo: `01_single_parameter.lumi`

Objetivo: recibir un `entero`, usarlo en una expresión y devolver el resultado.

```lumi
funcion entero duplicar(entero valor) {
    retornar valor * 2>>
}

principal {
    mostrar("Doble de 7:")>>
    mostrar(duplicar(7))>>
}
```

Resultado real: compilación y ejecución `completed`, sin diagnósticos. La salida
es `Doble de 7:` y `14`.

Métodos relacionados:

- `SemanticAnalyzer._register_function()` registra el parámetro y su tipo.
- `SemanticAnalyzer._infer_function_call()` comprueba el argumento.
- `Interpreter._evaluate_function_call()` enlaza el argumento con el parámetro
  dentro de un alcance local.

Para la defensa: explicar que `valor` recibe `7` solamente durante esa llamada.

Pregunta: **¿El parámetro modifica una variable externa?**  
Respuesta: no; cada llamada crea su propio entorno local.

## 2. Varios parámetros de tipos distintos

Archivo: `02_multiple_parameters.lumi`

Objetivo: demostrar una firma con `texto`, `entero` y `booleano`.

```lumi
funcion vacio describir(texto nombre, entero cantidad, booleano disponible) {
    mostrar(nombre)>>
    mostrar(cantidad)>>
    mostrar(disponible)>>
}

principal {
    describir("sillas", 4, verdadero)>>
}
```

Resultado real: compilación y ejecución `completed`, sin diagnósticos. Salida:
`sillas`, `4` y `verdadero`.

Métodos relacionados:

- `SemanticAnalyzer._analyze_function_body()` declara cada parámetro en el
  alcance de la función.
- `Interpreter._evaluate_function_call()` asigna los argumentos por posición.

Para la defensa: relacionar cada argumento con el parámetro correspondiente y
señalar que tanto la cantidad como los tipos se validan antes de ejecutar.

Pregunta: **¿Importa el orden de los argumentos?**  
Respuesta: sí; Lumi los asocia con los parámetros según su posición.

## 3. Llamadas anidadas

Archivo: `03_nested_function_calls.lumi`

Objetivo: utilizar el valor de una llamada como argumento de otra llamada.

```lumi
funcion entero siguiente(entero valor) {
    retornar valor + 1>>
}

funcion entero duplicar(entero valor) {
    retornar valor * 2>>
}

principal {
    mostrar("Doble del siguiente de 4:")>>
    mostrar(duplicar(siguiente(4)))>>
}
```

Resultado real: compilación y ejecución `completed`, sin diagnósticos. Salida:
`Doble del siguiente de 4:` y `10`.

Métodos relacionados:

- `SemanticAnalyzer._infer_expression()` infiere primero el tipo de la llamada
  interior.
- `SemanticAnalyzer._infer_function_call()` devuelve el tipo declarado de cada
  función para que la llamada pueda formar parte de otra expresión.
- `Interpreter._evaluate_function_call()` evalúa `siguiente(4)` antes de llamar
  a `duplicar(5)`.

Para la defensa: recorrer el orden `4 → siguiente → 5 → duplicar → 10`.

Pregunta: **¿Cómo sabe la llamada externa qué tipo recibe?**  
Respuesta: la llamada interior tiene el tipo de retorno `entero` de `siguiente`.

## 4. Parámetros aplicados a una escena

Archivo: `04_spatial_function_parameters.lumi`

Objetivo: usar parámetros para determinar posición y rotación de un mueble.

```lumi
funcion vacio ubicar_mesa(decimal x, decimal z, decimal giro) {
    mesa mesa_parametrizada {
        color "naranja">>
        material "madera">>
    }
    colocar mesa_parametrizada [x, 0, z]>>
    rotar mesa_parametrizada [0, giro, 0]>>
}

principal {
    habitacion sala(7, 6, 3) {
        ubicar_mesa(1.5, -1, 45)>>
    }
}
```

Resultado real: compilación y ejecución `completed`, sin diagnósticos. El
`ScenePlan` contiene `mesa_parametrizada` en `[1.5, 0, -1]`, con rotación
`[0, 45, 0]`.

Métodos relacionados:

- `SpatialSemanticAnalyzer.apply_function_effects()` sustituye los parámetros
  en el resumen espacial durante el análisis.
- `Interpreter._evaluate_vector()` resuelve las coordenadas en ejecución.
- `Interpreter._place_spatial_element()` y `_rotate_spatial_element()` envían
  los valores resueltos al `ScenePlanBuilder`.

Para la defensa: diferenciar la firma de la función, los argumentos concretos y
el estado final observado en el `ScenePlan`.

Pregunta: **¿Se copian los nombres `x`, `z` y `giro` al ScenePlan?**  
Respuesta: no; el ScenePlan conserva los valores numéricos ya resueltos.

## 5. Cantidad incorrecta de argumentos

Archivo: `05_wrong_argument_count.lumi`

Objetivo: aislar una llamada que entrega un argumento a una función que espera
dos.

Resultado real:

- Compilación: `failed` en semántica.
- Único diagnóstico: `SEM_ARGUMENT_COUNT_MISMATCH`, línea 6, columna 13.
- Ejecución: `blocked`.

Método relacionado: `SemanticAnalyzer._infer_function_call()` compara
`len(arguments)` con la cantidad de parámetros de la firma.

Para la defensa: indicar que la función existe y sus tipos son conocidos; el
problema es exclusivamente la aridad de la llamada.

Pregunta: **¿Por qué el intérprete no intenta completar el argumento faltante?**  
Respuesta: Lumi no define argumentos predeterminados; ejecutar esa llamada sería
ambiguo.

## 6. Tipo incompatible de argumento

Archivo: `06_wrong_argument_type.lumi`

Objetivo: llamar una función que espera `entero` utilizando un valor `texto`.

Resultado real:

- Compilación: `failed` en semántica.
- Único diagnóstico: `SEM_ARGUMENT_TYPE_MISMATCH`, línea 6, columna 22.
- Ejecución: `blocked`.

Métodos relacionados:

- `SemanticAnalyzer._infer_function_call()` infiere el tipo de cada argumento.
- `TypeChecker.is_assignable()` determina si el argumento puede asignarse al
  tipo del parámetro.

Para la defensa: explicar que `"siete"` es texto aunque su contenido represente
conceptualmente un número; Lumi no realiza esa conversión implícita.

Pregunta: **¿Cambiar las comillas solucionaría el error?**  
Respuesta: sí; `duplicar(7)` entrega un literal `entero` compatible.

## 7. Función inexistente

Archivo: `07_undefined_function.lumi`

Objetivo: demostrar la resolución de nombres de funciones.

Resultado real:

- Compilación: `failed` en semántica.
- Único diagnóstico: `SEM_UNDECLARED_FUNCTION`, línea 2, columna 13.
- Ejecución: `blocked`.

Método relacionado: `SemanticAnalyzer._infer_function_call()` consulta la tabla
de símbolos del alcance actual y sus padres.

Para la defensa: señalar que `calcular_total` no posee una firma registrada, por
lo que tampoco puede conocerse su tipo de retorno.

Pregunta: **¿Una función puede llamarse antes de aparecer en el archivo?**  
Respuesta: sí. Lumi registra previamente las funciones; este error ocurre porque
la función no está declarada en ninguna parte, no por el orden.

## 8. Alcance de parámetros

Archivo: `08_parameter_scope.lumi`

Objetivo: comprobar que un parámetro existe dentro de su función, pero no se
filtra al programa principal.

```lumi
funcion entero identidad(entero valor_local) {
    retornar valor_local>>
}

principal {
    mostrar(identidad(9))>>
    mostrar(valor_local)>>
}
```

Resultado real:

- La referencia interna es válida.
- Compilación: `failed` por la referencia externa.
- Único diagnóstico: `SEM_UNDECLARED_VARIABLE`, línea 7, columna 13.
- Ejecución: `blocked`.

Métodos relacionados:

- `SemanticAnalyzer._analyze_function_body()` crea un alcance hijo y registra
  allí `valor_local` como `SymbolKind.PARAMETER`.
- `SymbolTable.resolve()` busca solamente en el alcance actual y sus padres; el
  programa principal no es hijo del alcance local de la función.
- `Interpreter._evaluate_function_call()` restaura el entorno del llamador al
  finalizar cada llamada.

Para la defensa: dibujar dos cajas de alcance: `principal` y `identidad`. El
parámetro está en la segunda y desaparece al regresar.

Pregunta: **¿Por qué la llamada `identidad(9)` sí puede usar el parámetro?**  
Respuesta: porque durante la llamada el intérprete crea el entorno local,
registra `valor_local = 9` y ejecuta allí el cuerpo.

## Pruebas del repositorio relacionadas

- `tests/semantic/test_function_semantics.py`: funciones inexistentes, aridad,
  tipos de argumentos y llamadas anidadas.
- `tests/interpreter/test_function_runtime.py`: uno o varios argumentos,
  llamadas anidadas y aislamiento de parámetros.
- `tests/semantic/test_spatial_function_application.py`: sustitución de
  argumentos en efectos espaciales.
- `tests/semantic/test_spatial_function_linking_order.py`: orden de llamadas y
  efectos anidados.

La verificación de estos archivos utiliza `CompilerService.compile()` y
`ExecutionService.execute()`. Los cuatro ejemplos incorrectos deben quedar
bloqueados por su único diagnóstico documentado.
