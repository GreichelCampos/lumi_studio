# `.lumic`: referencia del candidato v1.0.0

Contrato candidato v1.0.0, pendiente de revisión y acuerdo con Gaby y Grei.

El [JSON Schema Draft 7](lumic.schema.json) define la estructura existente del IDE.
La [propuesta](../../../lumic_contract_proposal.md) registra decisiones pendientes;
la [guía para Python](../../../lumic_python_handoff.md) explica la adaptación.

## Contenedor

El archivo es JSON con extensión `.lumic`, descargado como `application/json`, sin
compresión. No contiene AST ni una respuesta del worker. `?` indica un campo
opcional; todos los demás campos de las tablas son obligatorios.

| Campo | Tipo |
|---|---|
| `format` | Literal `"lumic"` |
| `schemaVersion`, `compiledAt` | string |
| `compiler` | `{name: string, version: string, target: string}` |
| `project` | `{id: string, name: string, entryFile: string, sourceFilesCount: number, sourceChecksum?: string}` |
| `scenePlan` | ScenePlan de intercambio |
| `diagnosticsSummary` | `{totalErrors: number, totalWarnings: number, totalSpatialIssues: number, hasBlockingErrors: boolean}` |
| `debugSteps?` | `DebugStep[]` |
| `metadata?` | `Record<string, unknown>` |

El exportador actual escribe `schemaVersion: "1.0.0"` y productor `lumi-compiler`,
versión `1.0.0`, target `lumi-3d-scene`. No calcula `sourceChecksum`. Estos valores
no implican que Python ya produzca el archivo. `diagnosticsSummary` guarda un
resumen, no diagnósticos completos ni una equivalencia de severidad con el núcleo.

## ScenePlan de intercambio

| Modelo | Campos |
|---|---|
| `ScenePlan` | `version: string`, `rooms: RoomModel[]`, `metadata?: Record<string, unknown>`, `debugInfo?: ScenePlanDebugInfo` |
| `RoomModel` | `id`, `name`: string; `dimensions`: tupla numérica; `floor`, `walls`, `doors[]`, `windows[]`, `objects[]`; `calculatedArea`, `calculatedVolume`: number; `originOffset?`: tupla numérica |
| Piso | `material: string`, `color?: string` |
| `walls` | `north`, `south`, `east`, `west`, cada una con `color: string`, `material?: string` |
| Objeto | `id`, `type`, `name`: string; `position`, `rotation`, `dimensions`: tuplas numéricas; `color?`, `material?`, `roomId?`: string; `sourceRef?`; `hasCollision?`, `isOutOfBounds?`, `hasError?`, `hasWarning?`: boolean |
| Puerta o ventana | `id: string`, `wall: "norte" \| "sur" \| "este" \| "oeste"`; `position`, `width`, `height`: number; `sourceRef?` |
| `ScenePlanDebugInfo` | `totalEntities`, `collisionCount`, `warningsCount`: number; `compiledAt: string` |

Los tipos y campos exactos están en el esquema. Todos los objetos admiten
propiedades adicionales. Los opcionales pueden omitirse; `null` no sustituye
valores de otro tipo.

## Unidades y coordenadas

| Dato | Convención del visor |
|---|---|
| Posición de objeto | `[x, y, z]`, origen en el centro del suelo |
| Rotación | `[rx, ry, rz]` en grados; el renderer convierte a radianes |
| Dimensiones de objeto | `[ancho X, altura Y, profundidad Z]`, metros |
| Dimensiones de habitación | `[ancho X, largo Z, altura Y]` |
| Orientación | Norte hacia -Z, sur hacia +Z, oeste hacia -X, este hacia +X |
| Paredes y aberturas | Claves inglesas en `walls`; valores españoles en `wall` |

Las tuplas tienen tres números finitos. Las dimensiones y los tamaños de aberturas
son estrictamente positivos. Posición, rotación y desplazamientos admiten números
finitos. Las unidades de habitación deben ser coherentes con el visor; falta
acordar su correspondencia con Python y el origen del desplazamiento de aberturas.

## Identificadores y origen del código

Los IDs de habitaciones, objetos y pasos son strings no vacíos. Los IDs de
aberturas, proyecto y las referencias entre entidades se comprueban como strings.
No se exige todavía unicidad o estabilidad ni se resuelven `roomId` y
`activeObjectId`: pueden aceptarse IDs repetidos o referencias sin destino.

En `SourceReference`, `file` y `line` son obligatorios; `column` es opcional.
`file` debe ser texto no vacío y las ubicaciones, enteros >= 1. No se normalizan
rutas ni se comprueba acceso a archivos. La identidad entre archivos, importaciones
y snapshots requiere acuerdo con el núcleo.

## Depuración

`debugSteps` es opcional. Cada `DebugStep` requiere `id`, `stepIndex` entero >= 0,
`eventType`, `description`, `sourceRef`, `lineNumber` entero >= 1, `codeLine`,
`actionDescription` y `sceneSnapshot`. Este último cumple el mismo ScenePlan,
incluidas las escenas vacías. `description` y `id` no pueden estar vacíos;
`codeLine` y `actionDescription` son strings. Los opcionales son `roomId`,
`activeObjectId`, `assistantMessage` como strings y `spatialState` como objeto.

`eventType` admite `start`, `declaration`, `assignment`, `condition`, `loop`,
`room_create`, `place_object`, `move_object`, `rotate_object`, `spatial_warning`,
`spatial_error` y `end`.

`lineNumber` y `actionDescription` conservan su función de alias de `sourceRef.line`
y `description`. Se verifican sus tipos, sin exigir aún igualdad, continuidad de
índices, orden temporal ni resolución de entidades entre snapshots.

## Compatibilidad y límites de validación

| Área | Comprobación actual y límite |
|---|---|
| Versiones | Se conserva el prefijo numérico de versión mayor 1: admite `1.0`, `01.0` y `1legacy`. No es SemVer estricto. `schemaVersion` y `scenePlan.version` se comprueban por separado. |
| Fechas | Strings, sin exigir ISO 8601. |
| Conteos, área y volumen | Números finitos, sin fórmulas, rangos ni consistencia de totales. |
| Materiales y colores | Strings, sin catálogo adicional. |
| Extensiones | Se aceptan campos desconocidos; checksum y límites de tamaño/profundidad no están definidos. |
| Escenas vacías | Se aceptan al importar; `LumicFileService` solo exporta resultados exitosos con al menos una habitación. |

La carpeta versiona el candidato, no fija una política final de negociación.
SemVer estricto, versiones exactas, igualdad entre versiones, diagnósticos
espaciales y las demás reglas pendientes requieren acuerdo con el equipo.

## Ejemplos y comprobación

Los ejemplos son datos de demostración, no salidas espaciales de Python.

| Archivo | Resultado estructural |
|---|---|
| [valid-basic.lumic](examples/valid-basic.lumic) | Válido; copia del ejemplo existente |
| [valid-debug.lumic](examples/valid-debug.lumic) | Válido; pasos y snapshots de fixtures existentes |
| [invalid-envelope.lumic](examples/invalid-envelope.lumic) | Inválido: falta fecha; productor es un arreglo |
| [invalid-dimensions.lumic](examples/invalid-dimensions.lumic) | Inválido: dimensión cero |
| [invalid-source-reference.lumic](examples/invalid-source-reference.lumic) | Inválido: línea cero y columna de texto |
| [invalid-debug.lumic](examples/invalid-debug.lumic) | Inválido: evento desconocido |

Desde `apps/desktop/renderer`:

```powershell
npm.cmd run test:run -- src/tests/contracts/lumicStructure.test.ts --maxWorkers=2
```

La suite comprueba campos del esquema, ausencias, valores `null`, geometría,
referencias de origen, depuración, compatibilidad, roundtrip y referencias locales
del esquema. Falta contrastarlo con un motor estándar de JSON Schema; la suite no
lo sustituye y no hay uno instalado en este entorno.
