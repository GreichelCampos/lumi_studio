# Contrato ScenePlan de integración

## Resumen para el equipo

La fuente de verdad espacial es la ejecución Python:

`Interpreter -> ScenePlanBuilder -> SpatialValidator -> ExecutionService -> scene_plan_dto -> protocolo JSON`

El IDE no debe reconstruir la escena desde el AST. Recibe un `ScenePlan` de intercambio ya resuelto. Este documento describe la implementación integrada; no amplía el lenguaje ni ratifica las decisiones abiertas del contrato.

## Modelos y transformaciones

| Etapa | Tipo o función | Archivo |
|---|---|---|
| Estado interno resuelto | `ScenePlan`, `RoomPlan`, `SpatialElement`, `Vector3` | `spatial/scene_plan.py` |
| Construcción durante la ejecución | `ScenePlanBuilder` | `spatial/scene_builder.py` |
| Validación L-026 | `SpatialValidator.validate` | `spatial/spatial_validator.py` |
| Resultado del intérprete | `InterpreterResult.scene_plan` | `lumi_language/interpreter.py` |
| Resultado del servicio | `ExecutionResult.scene_plan` | `services/results.py`, `services/execution_service.py` |
| Adaptación al DTO | `scene_plan_dto` | `services/protocol/scene_adapter.py` |
| Publicación | `RequestDispatcher._result_response` | `services/protocol/dispatcher.py` |
| Contrato Python del wire | `ScenePlanDTO` y tipos relacionados | `services/protocol/scene_adapter.py` |
| Validación TypeScript | `scenePayload`, `sceneStructure` | `apps/desktop/renderer/src/services/integration/protocol/scenePayload.ts`, `services/compiler/contracts/sceneStructure.ts` |
| Tipo de dominio | `ScenePlan` | `apps/desktop/renderer/src/types/domain/spatial.ts` |

El modelo Python interno conserva valores y ubicaciones individuales y usa dataclasses inmutables. El DTO es deliberadamente distinto: agrega identificadores, dimensiones visuales, valores por defecto de presentación y campos calculados.

## DTO JSON publicado

```ts
interface ScenePlan {
  version: string;
  rooms: RoomModel[];
  metadata?: Record<string, unknown>; // aceptado por TypeScript; Python no lo emite
  debugInfo?: ScenePlanDebugInfo;     // aceptado por TypeScript; Python no lo emite
}

interface RoomModel {
  id: string;
  name: string;
  dimensions: [number, number, number];
  floor: { material: string; color?: string };
  walls: { north: WallFace; south: WallFace; east: WallFace; west: WallFace };
  doors: DoorModel[];
  windows: WindowModel[];
  objects: SpatialObject[];
  calculatedArea: number;
  calculatedVolume: number;
  originOffset?: [number, number, number]; // no emitido actualmente por Python
}

interface SpatialObject {
  id: string;
  type: string;
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  dimensions: [number, number, number];
  color?: string;
  material?: string;
  sourceRef?: { file: string; line: number; column: number };
  roomId?: string;
}
```

Los campos de la definición TypeScript relacionados con L-035 (`hasCollision`, `isOutOfBounds`, `hasError`, `hasWarning`) son opcionales y el backend L-029 no los produce.

## Reglas de serialización actuales

- `version` es `1.0.0`.
- Las habitaciones y elementos conservan su orden de ejecución.
- `dimensions` de habitación significa `[ancho X, largo Z, altura Y]`.
- `calculatedArea = width * length`; `calculatedVolume = width * length * height`.
- Los valores del wire deben poder representarse como números JSON finitos.
- Todo objeto publicable debe haber sido colocado. Una rotación ausente se serializa como `[0, 0, 0]`.
- `color` y `material` se copian cuando existen.
- El piso declarado reemplaza los valores visuales predeterminados. Sin piso declarado se usa `material: standard`, `color: #e2e8f0`.
- Se generan cuatro caras visuales neutrales (`north`, `south`, `east`, `west`). No representan declaraciones `WallNode`.
- El catálogo visual de `scene_adapter.py` aporta dimensiones para los tipos conocidos. Un tipo desconocido recibe `[1, 1, 1]`. Esto es presentación, no semántica del lenguaje.
- Más de un piso, elementos no colocados, tipos espaciales desconocidos y declaraciones de pared/puerta/ventana no representables provocan `SceneAdapterError`.

## Identidad y trazabilidad

Los IDs se forman así:

```text
room:<file>:<line>:<column>:<name>
element:<file>:<line>:<column>:<name>
```

Son deterministas para el mismo archivo, ubicación y nombre. Cambiar el archivo, mover la declaración o renombrarla cambia el ID. No son UUID ni garantizan estabilidad frente a ediciones. Los objetos incluyen `sourceRef`, por lo que el IDE puede seleccionar un objeto y localizar su declaración. La habitación no incluye actualmente `sourceRef`; su ID contiene la ubicación, pero no debe analizarse como sustituto formal de ese campo.

## Convenciones espaciales verificadas

| Tema | Estado actual |
|---|---|
| Longitud | El tipo TypeScript documenta metros. El backend transmite el valor Lumi sin aplicar escala. Falta una declaración normativa equivalente en el contrato Python/formal. |
| Superficie y volumen | El IDE trata los derivados como m² y m³; se calculan directamente, sin conversión. |
| Ejes | X = ancho, Z = largo y Y = vertical. |
| Origen | El visor centra cada habitación en `[0,0,0]`, sobre el centro del piso. Las posiciones de objetos son locales a la habitación. |
| Escala | El visor pasa los valores directamente a Three.js; no existe factor de escala adicional. |
| Rotación | El DTO usa grados `[rx, ry, rz]`; `FurnitureFactory` convierte cada componente con `grados * PI / 180`. |
| Orden | `THREE.Group.rotation.set(rx, ry, rz)` usa el orden Euler predeterminado de Three.js (`XYZ` mientras no se cambie). |
| Sentido | Se observa la convención positiva del sistema diestro de Three.js. No está declarada como regla normativa de Lumi. |
| Varias habitaciones | El DTO admite `originOffset`, pero Python no lo emite y el visor selecciona una habitación a la vez. No hay disposición global acordada. |

## Validación TypeScript

`responseValidator.ts` valida la envoltura, capacidades y coherencia de la operación. `scenePayload.ts` exige que una escena esté acompañada por `capabilities.scenePlan=true` y que el estado sea publicable. `sceneStructure.ts` valida, entre otros aspectos:

- versión compatible;
- habitaciones y campos requeridos;
- dimensiones positivas y finitas;
- vectores de posición/rotación finitos;
- dimensiones visuales de objetos positivas;
- cuatro caras de pared;
- estructura de puertas y ventanas.

Esta validación es estructural. No reemplaza `SpatialValidator` ni implementa colisiones, límites o puertas bloqueadas de L-035.

## Publicación, estados y errores

- Solo `execute` puede publicar una escena.
- La ejecución, construcción y validación espacial deben terminar sin diagnósticos.
- Debe existir al menos una habitación; un `ScenePlan` interno vacío no se envía.
- `capabilities.scenePlan` es `true` exactamente cuando el payload contiene `scenePlan`.
- Un programa espacial ejecutado correctamente puede tener `status: completed` y `analysisStatus: incomplete` con la limitación `spatial_semantics_unavailable`.
- Un diagnóstico runtime o espacial produce `status: failed`, `scenePlan` ausente y capacidad `false`.
- Un fallo de adaptación produce una respuesta de infraestructura `SERIALIZATION_ERROR`; no se publica una escena parcial.
- `analyze` nunca ejecuta ni publica una escena.

## Entidades soportadas

| Entidad interna | Publicación actual |
|---|---|
| Habitación | Sí |
| Piso | Sí, como estilo de `floor` |
| Mueble/objeto genérico colocado | Sí |
| Pared declarada | No: falta geometría en AST/ScenePlan |
| Puerta declarada | No: falta pared, posición y tamaño |
| Ventana declarada | No: falta pared, posición y tamaño |

Las paredes visuales derivadas de las dimensiones de la habitación sí se renderizan, pero no equivalen a una declaración `pared` del programa.

## Relación con `.lumic`

`.lumic` es un contenedor JSON persistente `LumiCompiledArtifact`, no el modelo interno Python y no código fuente. Contiene `format`, `schemaVersion`, fecha, productor, metadatos del proyecto, el mismo `ScenePlan` de intercambio del IDE, un resumen de diagnósticos y pasos de depuración opcionales.

`LumicFileService` crea, valida, exporta, lee e importa el contenedor. `createLumicArtifactFromCompileResult` inserta el `scenePlan` de un resultado exitoso; `parseAndValidateLumicArtifact` lo valida al importar. Por tanto:

- Python `ScenePlan` necesita `scene_plan_dto` para llegar al contrato de intercambio.
- El `scenePlan` ya contenido en `.lumic` no necesita otro adaptador para el visor.
- El archivo persistente y el protocolo del worker son envolturas distintas y pueden coexistir sin duplicar la generación espacial.

## Limitaciones explícitas

- `WallNode`, `DoorNode` y `WindowNode` solo contienen nombre, propiedades y ubicación; no aportan la geometría exigida por el DTO.
- Falta acordar unidades como contrato transversal, disposición global de varias habitaciones y estabilidad requerida de IDs.
- El catálogo de dimensiones de muebles es una decisión de presentación provisional.
- L-035 sigue siendo responsable de colisiones, fuera de límites y puertas bloqueadas.
- La cadena Python-JSON-TypeScript-Three.js se verificó en Electron de desarrollo mediante [runtime-scene.integration.mjs](../../apps/desktop/tests/runtime-scene.integration.mjs), con escena real y limpieza tras error. Falta validar el instalador combinado y Windows limpio; no se declara soporte de trazas ni geometría de aberturas declaradas.
