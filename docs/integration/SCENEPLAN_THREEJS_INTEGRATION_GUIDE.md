# Guía de integración de ScenePlan con Three.js

## Objetivo

La integrante 3 debe consumir la escena resuelta por Python, no construir otra desde el código Lumi. La ruta vigente es:

```text
Python worker
  -> PythonCompilerService
  -> validateProtocolResponse
  -> adaptProtocolResult
  -> useCompiler.scenePlan
  -> App / Viewport3D
  -> ThreeSceneManager
  -> RoomFactory + FurnitureFactory + OpeningFactory
```

## Flujo paso a paso

1. El IDE envía una operación `execute` mediante `PythonCompilerService`.
2. `responseValidator.ts` valida la respuesta completa; `scenePayload.ts` revisa la coherencia de la escena y `sceneStructure.ts` su estructura.
3. `resultAdapter.ts`, función `adaptProtocolResult`, convierte el payload al `CompileResult` de dominio y asigna `scenePlan: payload.scenePlan ?? null`.
4. `useCompiler.ts` guarda `scenePlan` y su origen (`python` o `simulation`).
5. `App.tsx` y `ConsolePanel.tsx` entregan el estado a `Viewport3D.tsx`.
6. `Viewport3D` vuelve a validar la escena, selecciona una habitación y entrega el modelo a `ThreeSceneManager`.
7. `RoomFactory` crea piso y cerramiento visual; `FurnitureFactory` crea y transforma muebles; `OpeningFactory` maneja puertas/ventanas cuando el DTO dispone de su geometría.

## Qué reutilizar

- Los tipos de `types/domain/spatial.ts`.
- Los validadores `responseValidator`, `scenePayload` y `sceneStructure`.
- `resultAdapter.ts`; no crear un segundo adaptador del protocolo.
- El estado `scenePlan` de `useCompiler.ts`.
- `Viewport3D`, `ThreeSceneManager`, `RoomFactory`, `FurnitureFactory` y `OpeningFactory`.
- `LumicFileService` para importar/exportar el contenedor persistente.

## Qué no duplicar

- Lexer, parser, intérprete o evaluación de expresiones.
- Reglas de `ScenePlanBuilder` para declarar, colocar, mover y rotar.
- Validaciones L-026.
- Conversión Python interno -> DTO (`scene_plan_dto`).
- Generación de IDs o dimensiones visuales en otro punto del frontend.
- Reglas L-035 todavía no implementadas.

## Consumo seguro

Usar `result.scenePlan` solo cuando la respuesta haya pasado el validador. No inferir disponibilidad a partir de `analysisStatus`: en programas espaciales exitosos puede ser `incomplete`. La señal de transporte es la combinación validada de:

```text
operation = execute
status = completed
capabilities.scenePlan = true
scenePlan presente
```

Si `scenePlan` es `null` o está ausente, el visor debe mostrar su estado sin escena y conservar los diagnósticos. Nunca renderizar el último plan como resultado de una ejecución fallida.

## Convenciones que debe respetar el visor

- Habitación: `dimensions = [X ancho, Z largo, Y alto]`.
- Objeto: `dimensions = [ancho, alto, profundidad]`.
- Posición: `[x, y, z]` local al centro del piso de la habitación.
- Rotación: grados `[rx, ry, rz]`; convertir a radianes una sola vez antes de asignar a Three.js.
- No aplicar un factor de escala adicional.
- Usar `id` para selección y `sourceRef` para navegación al editor.
- No analizar el texto del ID como API de ubicación; para objetos existe `sourceRef` explícito.

## Selección y navegación al código

`Viewport3D` ya trabaja con IDs de objeto. Para “ir a definición”, tomar `SpatialObject.sourceRef.file`, `.line` y `.column` y activar el archivo/posición del editor. Si no existe `sourceRef`, deshabilitar esa acción. Las habitaciones carecen actualmente de `sourceRef` explícito.

## `.lumic`

Una importación válida entrega `artifact.scenePlan` con el mismo tipo TypeScript usado por el viewport. Debe entrar al mismo estado y renderizador, sin recompilar ni reinterpretar el archivo. La exportación requiere un `CompileResult` exitoso con al menos una habitación.

## Trabajo frontend recomendado

1. Mantener una sola entrada de escena (`ScenePlan`) tanto para Python como para `.lumic`.
2. Confirmar visualmente habitación, piso y muebles con posiciones/rotaciones del ejemplo B.
3. Implementar navegación `sourceRef` sin cambiar el DTO.
4. Mantener selector de habitaciones mientras no exista una disposición global aprobada.
5. Posponer paredes declaradas, puertas y ventanas hasta aprobar su geometría.
6. Agregar E2E Electron cuando el binario esté disponible: ejecutar código, recibir payload, renderizar y verificar transformaciones.

## Estrategia para minimizar conflictos de ramas

- Backend: propietaria de L-029 mantiene intérprete, builder, validación, servicio, protocolo y adaptador Python.
- Frontend: integrante 3 mantiene estado del IDE, viewport y fábricas Three.js.
- Archivos de contrato TypeScript y validadores se coordinan antes de editarse porque son la frontera compartida.
- Integrar mediante commits pequeños: contrato/validación, transporte, consumo del estado y finalmente prueba E2E.
- No copiar el generador experimental al frontend; comparar comportamientos y conservar únicamente componentes visuales o de protocolo compatibles.

## Manejo de limitaciones

Una declaración `pared`, `puerta` o `ventana` produce actualmente un error controlado de serialización porque el backend no puede construir los campos geométricos del DTO. No crear geometría heurística en Three.js ni confundir las cuatro paredes visuales derivadas con `WallNode`. Esta decisión requiere contrato compartido.
