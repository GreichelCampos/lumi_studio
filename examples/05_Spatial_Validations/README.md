# Validaciones espaciales de Lumi

Estos diez programas se verificaron mediante el pipeline real
`CompilerService → ExecutionService → Interpreter → ScenePlanBuilder → SpatialValidator`.
Todos superan el análisis semántico. Los ejemplos físicamente inválidos fallan
después de construir la escena interna, reciben un diagnóstico `SPATIAL` y no
publican un `ScenePlan` parcial mediante `ExecutionService`.

## Contrato físico utilizado

Las dimensiones oficiales están en `spatial/furniture_catalog.py` y usan metros
en el orden `(ancho X, alto Y, profundidad Z)`:

- Mesa: `1.2 × 0.5 × 0.8`.
- Silla: `0.55 × 0.85 × 0.55`.
- Sofá: `2.0 × 0.85 × 0.9`.

Las posiciones representan el centro inferior del mueble. Una habitación de
ancho 6 y largo 5 ocupa X entre `-3` y `3`, Z entre `-2.5` y `2.5`, y Y entre
`0` y su altura.

## 1. Habitación y muebles válidos

Archivo: `01_valid_room_and_furniture.lumi`

```lumi
principal {
    habitacion sala(8, 6, 3) {
        mesa mesa_centro { color "azul">> material "madera">> }
        silla silla_lectura { color "verde">> }
        sofa sofa_descanso { material "tela">> }
        colocar mesa_centro [-1.5, 0, 0]>>
        colocar silla_lectura [1, 0, 1]>>
        colocar sofa_descanso [1.5, 0, -1.5]>>
    }
}
```

Resultado real: compilación y ejecución `completed`, sin diagnósticos. Se
publicó una habitación `8×6×3` con los tres muebles en las posiciones indicadas.

Responsables: `ScenePlanBuilder.declare_element()` y `place_element()` conservan
el estado; `SpatialValidator._validate_object_bounds()` y
`_validate_object_collisions()` confirman que es válido.

En el IDE: ejecutar, seleccionar `sala` y comprobar los tres muebles separados.

Pregunta: **¿De dónde salen las dimensiones si no aparecen en Lumi?**  
Respuesta: del catálogo físico oficial, según el `object_type` de cada elemento.

## 2. Colisión de muebles

Archivo: `02_furniture_collision.lumi`

```lumi
principal {
    habitacion sala(6, 5, 3) {
        mesa mesa_izquierda { }
        mesa mesa_derecha { }
        colocar mesa_izquierda [0, 0, 0]>>
        colocar mesa_derecha [0.8, 0, 0]>>
    }
}
```

Cada mesa tiene 1,20 m de ancho. Sus centros están separados solo 0,80 m, por lo
que sus volúmenes se superponen 0,40 m sobre X.

Resultado real: compilación `completed`; ejecución `failed` con
`SPA_OBJECT_COLLISION`, línea 6, columna 30. No se publicó ScenePlan.

Responsable: `SpatialValidator._validate_object_collisions()` construye las
cajas y llama a `geometry.boxes_intersect()`.

En el IDE: mostrar el diagnóstico; no debe conservarse una escena anterior ni
presentarse esta escena como válida.

Pregunta: **¿Por qué el diagnóstico apunta a la segunda mesa?**  
Respuesta: el validador recorre en orden y reporta el elemento actual que
colisiona con uno previamente registrado.

## 3. Objeto fuera de los límites

Archivo: `03_object_out_of_bounds.lumi`

```lumi
principal {
    habitacion sala(6, 5, 3) {
        sofa sofa_fuera { }
        colocar sofa_fuera [2.5, 0, 0]>>
    }
}
```

La habitación termina en X=3. El sofá mide 2 m de ancho, por lo que colocado en
X=2.5 llega hasta X=3.5.

Resultado real: compilación `completed`; ejecución `failed` con
`SPA_OBJECT_OUT_OF_BOUNDS`, línea 4, columna 28. No se publicó ScenePlan.

Responsable: `geometry.box_vertices()` transforma los ocho vértices y
`box_within_bounds()` exige que todos estén dentro de la habitación.

En el IDE: enseñar el diagnóstico y explicar que se valida el volumen completo,
no solamente el punto central.

Pregunta: **¿Por qué X=2.5 no basta si está dentro de -3 a 3?**  
Respuesta: porque ese es solo el pivote; la mitad derecha del sofá sobresale.

## 4. Puerta bloqueada

Archivo: `04_blocked_door.lumi`

```lumi
principal {
    habitacion sala(6, 5, 3) {
        puerta entrada {
            orientacion "norte">>
            ancho 1>>
            alto 2>>
            desplazamiento 2.5>>
        }
        silla silla_bloqueando { }
        colocar silla_bloqueando [0, 0, -2.2]>>
    }
}
```

La puerta norte ocupa un vano de 1 m centrado horizontalmente. Lumi reserva una
caja de paso con todo el ancho del vano y 0,80 m hacia el interior. La silla
intersecta esa caja.

Resultado real: compilación `completed`; ejecución `failed` con
`SPA_BLOCKED_DOOR`, línea 10, columna 34. No se publicó ScenePlan.

Responsable: `SpatialValidator._door_clearance_box()` construye la zona de 0,80
m y `_validate_blocked_doors()` prueba la intersección.

En el IDE: mostrar la puerta y explicar la zona conceptual; la escena inválida no
debe publicarse como correcta.

Pregunta: **¿El contacto con el borde bloquea la puerta?**  
Respuesta: no; esta comprobación usa `touching_counts=False`, por lo que exige
superposición física con la zona libre.

## 5. Contacto sin colisión

Archivo: `05_touching_without_collision.lumi`

```lumi
principal {
    habitacion sala(6, 5, 3) {
        mesa mesa_uno { }
        mesa mesa_dos { }
        colocar mesa_uno [0, 0, 0]>>
        colocar mesa_dos [1.2, 0, 0]>>
    }
}
```

Las mesas tienen 1,20 m de ancho y sus centros están separados exactamente 1,20
m: sus superficies se tocan, pero sus interiores no se superponen.

Resultado real: compilación y ejecución `completed`, sin diagnósticos. El
ScenePlan conserva ambas mesas.

Responsable: `boxes_intersect(..., touching_counts=False)` considera un eje
separador cuando la distancia es igual a la suma de proyecciones.

En el IDE: observar las mesas contiguas y contrastarlas con el archivo 02.

Pregunta: **¿La política de contacto es accidental?**  
Respuesta: no; el parámetro explícito del algoritmo establece que el contacto
superficial no cuenta como colisión de muebles.

## 6. Colisión con rotación

Archivo: `06_rotated_furniture_collision.lumi`

```lumi
principal {
    habitacion sala(6, 5, 3) {
        mesa mesa_fija { }
        mesa mesa_rotada { }
        colocar mesa_fija [0, 0, 0]>>
        colocar mesa_rotada [0.8, 0, 0]>>
        rotar mesa_rotada [0, 45, 0]>>
    }
}
```

Resultado real: compilación `completed`; ejecución `failed` con
`SPA_OBJECT_COLLISION`, línea 6, columna 29. No se publicó ScenePlan.

Responsable: `geometry.box_axes()` calcula los ejes rotados y SAT incluye los
ejes de ambas cajas y sus productos cruzados.

En el IDE: explicar que no se usa solo un rectángulo alineado con los ejes; la
rotación de 45° forma parte del volumen probado.

Pregunta: **¿Cambiar la rotación puede crear o eliminar una colisión?**  
Respuesta: sí; cambia las proyecciones y vértices físicos del mueble.

## 7. Muebles rotados válidos

Archivo: `07_valid_rotated_furniture.lumi`

Resultado real: compilación y ejecución `completed`, sin diagnósticos. Se
publicó una mesa en `[-1.5,0,0]` rotada `[0,45,0]` y una silla en `[1.5,0,0]`
rotada `[0,-30,0]`.

Responsable: `geometry.box_from_floor_pivot()` construye cada caja orientada;
los validadores de límites y colisiones aceptan la separación.

En el IDE: seleccionar ambos objetos y comprobar sus rotaciones finales.

Pregunta: **¿La rotación es relativa?**  
Respuesta: no; `rotar` reemplaza la rotación absoluta del elemento.

## 8. Dimensión de abertura inválida

Archivo: `08_invalid_dimensions.lumi`

```lumi
principal {
    habitacion sala(6, 5, 3) {
        puerta entrada_invalida {
            orientacion "norte">>
            ancho 0>>
            alto 2>>
            desplazamiento 1>>
        }
    }
}
```

No existe sintaxis para asignar dimensiones arbitrarias a un mueble: estas
provienen del catálogo. Por eso el ejemplo usa `ancho`, una propiedad geométrica
real y obligatoria de las puertas.

Resultado real: compilación `completed`; ejecución `failed` con
`SPA_INVALID_PROPERTY`, línea 5, columna 13. No se publicó ScenePlan.

Responsable: `normalize_spatial_geometry()` interpreta la propiedad y
`SpatialValidator` exige dimensiones finitas y mayores que cero.

En el IDE: mostrar que la sintaxis y el tipo numérico son correctos, pero el
valor físico cero es inválido.

Pregunta: **¿Por qué no es `SEM_TYPE_MISMATCH`?**  
Respuesta: `0` sí es numérico y compatible; la regla infringida es espacial y
se comprueba sobre el valor resuelto.

## 9. Efecto espacial dentro de una función

Archivo: `09_spatial_effect_inside_function.lumi`

```lumi
funcion vacio centrar_mesa() {
    mover mesa_funcion [0, 0, 0]>>
    rotar mesa_funcion [0, 90, 0]>>
}

principal {
    habitacion sala(7, 5, 3) {
        mesa mesa_funcion { }
        colocar mesa_funcion [2, 0, 1]>>
        centrar_mesa()>>
    }
}
```

Resultado real: compilación y ejecución `completed`, sin diagnósticos. El estado
final publicado contiene la mesa en `[0,0,0]`, rotada `[0,90,0]`; no conserva un
historial de posiciones anteriores.

Responsables: `SpatialSemanticAnalyzer.apply_function_effects()` anticipa el
efecto; `Interpreter._evaluate_function_call()` comparte el builder de la
ejecución y `ScenePlanBuilder.move_element()` reemplaza la posición absoluta.

En el IDE: seleccionar la mesa y mostrar posición y rotación finales.

Pregunta: **¿La función crea otra escena?**  
Respuesta: no; usa el mismo ScenePlanBuilder de la ejecución y la habitación
activa del llamador.

## 10. Error espacial dentro de una función

Archivo: `10_spatial_error_inside_function.lumi`

```lumi
funcion vacio sacar_sofa() {
    mover sofa_funcion [2.5, 0, 0]>>
}

principal {
    habitacion sala(6, 5, 3) {
        sofa sofa_funcion { }
        colocar sofa_funcion [0, 0, 0]>>
        sacar_sofa()>>
    }
}
```

Resultado real: la compilación semántica queda `completed`; la ejecución termina
`failed` con `SPA_OBJECT_OUT_OF_BOUNDS` en la operación de la función, línea 2,
columna 24. `ExecutionService` no publica el ScenePlan inválido.

Responsables: la llamada modifica el estado real mediante
`ScenePlanBuilder.move_element()`; al finalizar, `_validate_object_bounds()` usa
las dimensiones del sofá y detecta que llega hasta X=3.5.

En el IDE: enseñar la ubicación exacta del diagnóstico dentro de la función y
confirmar que no queda una escena parcial visible.

Pregunta: **¿Por qué el análisis no lo rechaza primero?**  
Respuesta: el análisis valida nombres, tipos y orden de operaciones. La
comprobación física usa el ScenePlan resuelto y las dimensiones del catálogo al
ejecutar.

## Cómo funciona SAT en este proyecto

El teorema del eje separador indica que dos cajas convexas no colisionan si
existe al menos un eje sobre el cual sus proyecciones no se superponen.
`boxes_intersect()` prueba:

1. Los tres ejes locales de la primera caja.
2. Los tres ejes locales de la segunda.
3. Los nueve productos cruzados entre esos ejes.

Para cada eje calcula la distancia entre centros y la suma de los radios
proyectados. Si la distancia alcanza o supera esa suma con
`touching_counts=False`, existe separación: puede haber contacto, pero no
penetración. Si ningún eje separa las cajas, existe colisión. Incluir los ejes
locales rotados permite evaluar correctamente el archivo 06.

## Cómo se verifican los límites

`SpatialValidator._object_boxes()` combina posición, rotación y dimensiones del
catálogo. `box_vertices()` calcula los ocho vértices transformados.
`box_within_bounds()` comprueba que cada vértice esté dentro de:

- X: `[-ancho/2, ancho/2]`.
- Y: `[0, altura]`.
- Z: `[-largo/2, largo/2]`.

Así se evita el error de aceptar un mueble solo porque su punto central está
dentro de la habitación.

## Pruebas relacionadas

- `tests/spatial/test_geometry.py`: cajas rotadas, vértices, límites, SAT y
  política de contacto.
- `tests/spatial/test_l035_geometry_validation.py`: catálogo, colisiones,
  límites, aberturas y puertas bloqueadas.
- `tests/spatial/test_spatial_validator.py`: dimensiones, vectores, propiedades
  y acumulación de diagnósticos.
- `tests/spatial/test_scene_builder.py` y `test_scene_plan.py`: contratos y
  transiciones del ScenePlan.
- `tests/semantic/test_spatial_function_control_flow.py` y pruebas de integración
  espacial: efectos de funciones y estado final.
