# Paredes, puertas y ventanas

Estos ejemplos fueron comprobados con el pipeline real
`CompilerService → ExecutionService → Interpreter → ScenePlanBuilder → SpatialValidator`.
Los casos válidos también se enviaron por `RequestDispatcher` para comprobar el
DTO que consume Electron/Three.js. Las unidades geométricas son metros.

## Contrato demostrado

- Una habitación aporta cuatro paredes implícitas: `north`, `south`, `east` y
  `west` en el DTO. No tienen identidad ni referencia de fuente porque no
  corresponden a declaraciones del programa.
- Una `pared` explícita exige `orientacion`; `color` y `material` son opcionales.
  Personaliza una cara implícita, no crea una quinta cara.
- Una `puerta` exige `orientacion`, `ancho`, `alto` y `desplazamiento`.
- Una `ventana` exige además `elevacion`, medida desde el piso hasta su borde
  inferior.
- Las orientaciones válidas son `norte`, `sur`, `este` y `oeste`.
- El desplazamiento va desde el inicio de la pared hasta el borde inicial de la
  abertura. El adaptador lo convierte a la posición centrada usada por el visor.
- Una puerta o ventana utiliza la cara implícita; no necesita una declaración
  explícita de `pared`.

## Resultados por ejemplo

### 1. Habitación con paredes implícitas

Archivo: `01_room_with_implicit_walls.lumi`

```lumi
principal { habitacion sala(6, 5, 3) { } }
```

Compilación y ejecución: `completed`, sin diagnósticos. El ScenePlan interno no
inventa elementos; el DTO publica las cuatro paredes neutras sin `id`.

### 2. Pared explícita

Archivo: `02_explicit_wall.lumi`

```lumi
principal {
    habitacion sala(6, 5, 3) {
        pared pared_norte {
            orientacion "norte">> color "azul">> material "concreto">>
        }
    }
}
```

Resultado: `completed`. La cara `north` conserva `id`, nombre `pared_norte`,
color, material y `sourceRef`; las otras tres caras siguen siendo implícitas.

### 3. Puerta válida

Archivo: `03_valid_door.lumi`

```lumi
principal {
    habitacion sala(6, 5, 3) {
        puerta entrada {
            orientacion "norte">> ancho 0.9>> alto 2.1>>
            desplazamiento 0.5>> color "cafe">> material "madera">>
        }
    }
}
```

Resultado: `completed`. El DTO conserva el nombre y publica la posición centrada
`-2.05`, calculada desde el desplazamiento declarado.

### 4. Ventana válida

Archivo: `04_valid_window.lumi`

```lumi
principal {
    habitacion sala(6, 5, 3) {
        ventana ventana_sur {
            orientacion "sur">> ancho 1.2>> alto 1>>
            desplazamiento 2>> elevacion 0.9>>
            color "blanco">> material "vidrio">>
        }
    }
}
```

Resultado: `completed`. El DTO publica `wall: "sur"`, posición `-0.4` y
`elevation: 0.9`.

### 5. Dos aberturas válidas en la misma pared

Archivo: `05_door_and_window_same_wall.lumi`

```lumi
principal {
    habitacion sala(6, 5, 3) {
        puerta entrada {
            orientacion "norte">> ancho 1>> alto 2>> desplazamiento 1>>
        }
        ventana ventana_norte {
            orientacion "norte">> ancho 1>> alto 1>>
            desplazamiento 2>> elevacion 1>>
        }
    }
}
```

Resultado: `completed`. Las aberturas solo se tocan en sus bordes; el contacto
superficial no se considera superposición.

### 6. Aberturas superpuestas

Archivo: `06_overlapping_openings.lumi`

```lumi
principal {
    habitacion sala(6, 5, 3) {
        puerta entrada {
            orientacion "norte">> ancho 1>> alto 2>> desplazamiento 1>>
        }
        ventana ventana_norte {
            orientacion "norte">> ancho 1>> alto 1>>
            desplazamiento 1.5>> elevacion 0.5>>
        }
    }
}
```

Compilación: `completed`. Ejecución: `failed` con
`SPA_OBJECT_COLLISION` en línea 9, columna 9. No se publica ScenePlan parcial.

### 7. Puerta fuera de la pared

Archivo: `07_door_out_of_wall_bounds.lumi`

```lumi
principal {
    habitacion sala(6, 5, 3) {
        puerta entrada {
            orientacion "norte">> ancho 1>> alto 2>> desplazamiento 5.5>>
        }
    }
}
```

Compilación: `completed`. Ejecución: `failed` con
`SPA_OBJECT_OUT_OF_BOUNDS` en línea 7, columna 13. El ancho de la abertura más
su desplazamiento supera los 6 m de esa cara.

### 8. Ventana fuera de la pared

Archivo: `08_window_out_of_wall_bounds.lumi`

```lumi
principal {
    habitacion sala(6, 5, 3) {
        ventana ventana_alta {
            orientacion "este">> ancho 1>> alto 1.5>>
            desplazamiento 1>> elevacion 2>>
        }
    }
}
```

Compilación: `completed`. Ejecución: `failed` con
`SPA_OBJECT_OUT_OF_BOUNDS` en línea 8, columna 13: elevación más altura excede
los 3 m de la habitación.

### 9. Orientación inválida

Archivo: `09_invalid_wall_orientation.lumi`

```lumi
principal {
    habitacion sala(6, 5, 3) {
        pared pared_diagonal { orientacion "diagonal">> }
    }
}
```

Compilación: `failed` con `SEM_INVALID_SPATIAL_ORIENTATION` en línea 4,
columna 25. La ejecución queda `blocked` y no existe escena.

### 10. Dimensiones inválidas

Archivo: `10_invalid_opening_dimensions.lumi`

```lumi
principal {
    habitacion sala(6, 5, 3) {
        puerta entrada {
            orientacion "norte">> ancho 0>> alto 2>> desplazamiento 1>>
        }
    }
}
```

Compilación: `completed`. Ejecución: `failed` con `SPA_INVALID_PROPERTY` en
línea 5, columna 13 porque una dimensión física debe ser positiva.

### 11. Habitación completa

Archivo: `11_valid_complete_room.lumi`. Declara piso, una pared explícita,
puerta, ventana, mesa y silla; coloca los muebles y rota la mesa 45 grados.

Resultado: `completed`, sin diagnósticos. El ScenePlan contiene seis elementos;
el DTO contiene cuatro paredes, una puerta, una ventana y dos muebles. La cara
norte es explícita y las otras tres son implícitas.

### 12. Arquitectura declarada desde una función

Archivo: `12_wall_door_window_in_function.lumi`. La función `vacio`
`configurar_arquitectura()` declara una pared sur, una puerta norte y una
ventana este. Se llama dentro de la habitación activa.

Resultado: `completed`, sin diagnósticos. Los tres efectos aparecen en el
ScenePlan y en el DTO. Esto demuestra que las funciones comparten el builder de
la ejecución y que el análisis semántico propaga sus efectos espaciales.

## Código Python relacionado

- `lumi_language/semantic_analyzer.py`:
  `_validate_required_spatial_properties()` comprueba propiedades obligatorias
  y la validación de orientación produce `SEM_INVALID_SPATIAL_ORIENTATION`.
- `lumi_language/interpreter.py`: `_execute_room()` mantiene la habitación
  activa y `_execute_node()` registra declaraciones y operaciones en el builder.
- `spatial/scene_builder.py`: conserva los elementos declarados y su estado.
- `spatial/spatial_validator.py`: `_validate_opening()` comprueba dimensiones y
  límites; `_validate_opening_overlaps()` detecta superposiciones.
- `services/protocol/scene_adapter.py`: `_room_dto()` aporta las cuatro caras;
  `_wall_dto()`, `_door_dto()` y `_window_dto()` publican la geometría al IDE.

## Qué mostrar durante la defensa

1. Ejecutar primero `01` para señalar las cuatro paredes neutras del visor.
2. Comparar `01` con `02` y mostrar que la pared explícita personaliza solo la
   cara norte.
3. Ejecutar `03`, `04` y `05` para explicar orientación, desplazamiento y
   elevación.
4. Ejecutar `06`, `07`, `08` y `10` para mostrar diagnósticos espaciales sin
   publicar una escena inválida.
5. Mostrar `11` como escena integral y `12` como integración con funciones.

La representación visual debe comprobarse abriendo estos archivos en Lumi
Studio; la verificación automatizada realizada aquí confirma el DTO y las
pruebas del renderer, pero no sustituye una inspección visual manual del IDE.

## Preguntas posibles del profesor

**¿Las paredes implícitas existen en el AST?**  No. El programa declara la
habitación y el adaptador completa las cuatro caras requeridas por el visor.

**¿Una pared explícita crea una pared adicional?**  No. Sustituye la apariencia
y agrega identidad y referencia de fuente a una de las cuatro caras.

**¿Una puerta necesita declarar primero una pared?**  No. Su orientación la
asocia directamente con una cara implícita de la habitación.

**¿Qué significa desplazamiento?**  Es la distancia desde el inicio de la pared
hasta el borde inicial de la abertura. El adaptador calcula su centro para
Three.js con `-largo/2 + desplazamiento + ancho/2`.

**¿Por qué el ejemplo 05 es válido y el 06 no?**  En el 05 las aberturas solo
comparten un borde. En el 06 sus intervalos horizontal y vertical se cruzan con
área positiva.

**¿Dónde se detecta una orientación inválida?**  Durante el análisis semántico,
antes de ejecutar. En cambio, límites y superposición se comprueban sobre el
ScenePlan resuelto durante la validación espacial.

**¿Por qué una escena inválida no llega al IDE?**  `ExecutionService` solo
publica el ScenePlan cuando la ejecución termina sin diagnósticos; los errores
espaciales dejan el resultado sin escena publicable.
