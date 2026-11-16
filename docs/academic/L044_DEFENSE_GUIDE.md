# L-044 — Guion de defensa y ejercicios

## Guion técnico

1. **Semántica:** explicar que el parser crea estructura, mientras el analizador
   resuelve símbolos, tipos y contextos sin ejecutar instrucciones.
2. **Funciones:** describir predeclaración, parámetros, retorno, llamadas antes de
   la declaración y alcances léxicos.
3. **Importaciones:** abrir `principal.lumi` y mostrar cómo se resuelve una función
   de otro archivo. Probar un nombre de archivo incorrecto y ver el diagnóstico.
4. **Intérprete:** mostrar entornos independientes, control de flujo y evaluación
   de expresiones.
5. **Escena:** explicar que `ScenePlanBuilder` conserva estado final, no historial;
   `SpatialValidator` trabaja con valores ya resueltos.
6. **IDE:** usar **Compilar** para analizar y **Ejecutar Lumi** para ejecutar
   el archivo principal del proyecto. El visor recibe la escena resultante.

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

Marcar `principal.lumi` como principal, abrir `calculos.lumi` y ejecutar.
La consola muestra `12` aunque la pestaña activa sea la del módulo.

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
- ¿Cómo se elige qué archivo ejecuta el IDE si hay varios abiertos?
- ¿Cómo se conserva la ubicación de un error importado?
- ¿Qué diferencia existe entre AST, ScenePlan interno y DTO?
- ¿Qué propiedades hacen falta para declarar una puerta o una ventana?
- ¿Cómo se detecta una dependencia circular?
- ¿Qué parte corresponde a L-035?

## Demostración recomendada

1. Abrir `examples/CasaEjemplo` y seleccionar la pestaña `principal.lumi`.
2. Pulsar F5 para analizar y F6 para ejecutar. Mostrar la salida de consola y
   seleccionar las habitaciones `sala` y `estudio` en el visor.
3. Abrir `examples/OficinaEjemplo` para mostrar paredes, puertas, ventanas y
   muebles. Seleccionar un elemento y abrir su declaración con **Ir al código**.
4. Probar `leer` con `examples/03_Input_And_Output/06_read_and_show.lumi`.
   Responder en el formulario y mostrar la salida en la consola.
5. Mostrar un diagnóstico con archivo y línea usando uno de los ejemplos de
   errores. Ejecutar una escena y avanzar por los pasos espaciales de Python
   en el depurador.
