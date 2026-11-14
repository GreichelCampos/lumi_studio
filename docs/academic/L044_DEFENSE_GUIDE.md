# L-044 — Guion de defensa y ejercicios

## Guion técnico

1. **Semántica:** explicar que el parser crea estructura, mientras el analizador
   resuelve símbolos, tipos y contextos sin ejecutar instrucciones.
2. **Funciones:** describir predeclaración, parámetros, retorno, llamadas antes de
   la declaración y alcances léxicos.
3. **Importaciones:** explicar archivo principal explícito, resolver en memoria,
   símbolo solicitado, catálogo transitivo y detección de ciclos.
4. **Intérprete:** mostrar entornos independientes, control de flujo y evaluación
   de expresiones.
5. **Escena:** explicar que `ScenePlanBuilder` conserva estado final, no historial;
   `SpatialValidator` trabaja con valores ya resueltos.
6. **IDE:** distinguir Compilar de Ejecutar Python y describir la frontera DTO.

## Ejercicio 1 — Tipos y diagnóstico

```lumi
entero cantidad = 4>>
cantidad = "cuatro">>
```

Resultado esperado: `SEM_TYPE_MISMATCH`, con archivo, línea y columna. El programa
no debe ejecutarse.

## Ejercicio 2 — Función importada

`principal.lumi`:

```lumi
importar "calculos.lumi" usar doble>>
mostrar(doble(6))>>
```

`calculos.lumi`:

```lumi
funcion entero doble(entero valor) {
    retornar valor * 2>>
}
```

Resultado esperado: salida `12`, sin diagnósticos.

## Ejercicio 3 — Estado espacial final

```lumi
habitacion sala(5, 4, 3) {
    mesa centro { color "cafe">> }
    colocar centro [0, 0, 0]>>
    mover centro [1.5, 0, -1]>>
    rotar centro [0, 90, 0]>>
}
```

Resultado esperado: una habitación y una mesa con posición final
`[1.5, 0, -1]` y rotación `[0, 90, 0]`. `mover` y `rotar` son absolutos.

## Preguntas posibles del tribunal

- ¿Por qué Compilar no genera una escena?
- ¿Por qué el análisis espacial aún puede indicar `incomplete`?
- ¿Cómo se evita ejecutar un archivo diferente al principal?
- ¿Cómo se conserva la ubicación de un error importado?
- ¿Qué diferencia existe entre AST, ScenePlan interno y DTO?
- ¿Por qué no se usan valores por defecto para geometría no acordada?
- ¿Cómo se detecta una dependencia circular?
- ¿Qué parte corresponde a L-035?

## Demostración recomendada

1. Abrir `examples/CasaEjemplo` y marcar `principal.lumi`.
2. Compilar y explicar honestamente la limitación espacial existente.
3. Ejecutar Python y mostrar `Area de sala:` y `30.0`.
4. Seleccionar `sala` y `estudio` en Three.js.
5. Mostrar una prueba automatizada y un diagnóstico con ubicación.
6. Cerrar indicando los bloqueos geométricos que no se presentan como completos.
