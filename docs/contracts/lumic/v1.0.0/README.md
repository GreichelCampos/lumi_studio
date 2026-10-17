# `.lumic`: candidato estructural v1.0.0

Estado: base TypeScript autorizada por la responsable del IDE; pendiente de
validación por Gaby y Grei. No equivale al cierre completo de L-009.

El [JSON Schema Draft 7](lumic.schema.json) describe todos los campos del contenedor
existente. No incluye AST ni una respuesta del worker. Los ejemplos son datos de
demostración; no son evidencia de compilación espacial Python.

## Contenedor y datos

El archivo es un documento JSON con extensión `.lumic`. El IDE lo descarga como
`application/json`, sin compresión. Los campos obligatorios son `format`,
`schemaVersion`, `compiledAt`, `compiler`, `project`, `scenePlan` y
`diagnosticsSummary`. `debugSteps` y `metadata` son opcionales.

- `format` es exactamente `lumic`.
- `compiler` declara `name`, `version` y `target`, todos strings.
- `project` declara `id`, `name`, `entryFile` como strings y `sourceFilesCount`
  como número. `sourceChecksum` es un string opcional, sin algoritmo acordado.
- `scenePlan` declara `version` y `rooms`. `metadata` y `debugInfo` son opcionales.
- Cada habitación declara `id`, `name`, `dimensions`, `floor`, las cuatro `walls`,
  arreglos `doors`, `windows`, `objects`, y `calculatedArea`, `calculatedVolume`.
  `originOffset` es opcional.
- Cada objeto declara `id`, `type`, `name`, `position`, `rotation`, `dimensions`.
  Color, material, referencias de origen, flags y `roomId` son opcionales.
- Cada abertura declara `id`, `wall`, `position`, `width`, `height`; `sourceRef`
  es opcional. `floor.material` y el color de cada pared son obligatorios.
- `diagnosticsSummary` contiene números `totalErrors`, `totalWarnings`,
  `totalSpatialIssues` y booleano `hasBlockingErrors`. No contiene diagnósticos
  completos. Los números no sustituyen decisiones sobre severidad del núcleo.

Las propiedades, tipos y campos obligatorios exactos de cada nivel están en el
esquema. Los objetos admiten propiedades adicionales, conservando el comportamiento
anterior y los archivos con extensiones. No se interpretan como capacidades nuevas.
Los opcionales pueden omitirse; `null` no sustituye un campo de otro tipo.

## Unidades y coordenadas existentes

| Dato | Convención del visor |
|---|---|
| Posición de objeto | `[x, y, z]`, origen en el centro del suelo |
| Rotación | `[rx, ry, rz]` en grados; el renderer convierte a radianes |
| Tamaño de objeto | `[ancho X, altura Y, profundidad Z]`, metros |
| Tamaño de habitación | `[ancho X, largo Z, altura Y]` |
| Orientación de paredes | Norte hacia -Z, sur hacia +Z, oeste hacia -X, este hacia +X |
| Paredes | Claves `north`, `south`, `east`, `west` |
| Pared de una abertura | Valores `norte`, `sur`, `este`, `oeste` |

Las dimensiones deben ser tres números finitos estrictamente positivos; posición,
rotación y desplazamientos son números finitos. Las unidades de habitación deben
ser coherentes con las del visor; su correspondencia con el modelo Python aún debe
acordarse. No se convierte una unidad ni se inventa el origen de aberturas.

## Identificadores y referencias

Los IDs de habitaciones y objetos son strings no vacíos, igual que en el validador
anterior. IDs de aberturas, proyecto y referencias entre entidades se comprueban
como strings conforme a sus interfaces. La unicidad, ámbito, estabilidad y
resolución de referencias permanecen pendientes: el perfil estructural no rechaza
IDs repetidos ni garantiza que `roomId` o `activeObjectId` existan.

`SourceReference` conserva `file` no vacío, `line` entero >= 1 y `column` opcional
entero >= 1. No se normalizan rutas ni se comprueba acceso al archivo. La identidad
entre archivos, importaciones y snapshots requiere acuerdo con el núcleo.

## Depuración

`debugSteps`, cuando está presente, es un arreglo. Cada paso requiere `id`,
`stepIndex` entero >= 0, `eventType`, `description`, `sourceRef`, `lineNumber`,
`codeLine`, `actionDescription` y `sceneSnapshot`. Este último debe cumplir el mismo
ScenePlan estructural, incluso si todavía no hay habitaciones.

`eventType` conserva los valores `start`, `declaration`, `assignment`, `condition`,
`loop`, `room_create`, `place_object`, `move_object`, `rotate_object`,
`spatial_warning`, `spatial_error`, `end`. Los opcionales son `roomId`,
`activeObjectId`, `spatialState` y `assistantMessage`.

Los alias `lineNumber` y `actionDescription` se conservan. Se comprueban sus tipos,
sin imponer todavía igualdad con `sourceRef.line` y `description`, continuidad de
índices, orden temporal ni resolución de entidades entre snapshots.

## Versiones, fechas y consistencia pendiente

El exportador actual produce `schemaVersion: "1.0.0"`. El nombre de esta carpeta
versiona el candidato, no declara una política final de negociación.

El esquema reproduce la compatibilidad mayor heredada: el prefijo numérico debe
representar 1. Por eso también se aceptan `1.0`, `01.0` y cadenas como `1legacy`.
Esto es una limitación preservada de forma deliberada, no una definición de SemVer.
`scenePlan.version` se comprueba por separado. Exigir SemVer estricto, una versión
exacta o igualdad entre ambas versiones queda pendiente del equipo.

Las fechas son strings, sin imponer todavía ISO 8601. Conteos, áreas y volúmenes
son números finitos, sin imponer fórmulas, rangos o igualdad de totales. Materiales
y colores son strings sin catálogo adicional. El esquema no fija checksum,
límites de tamaño/profundidad ni políticas de diagnóstico espacial.

Se aceptan escenas vacías al importar, como antes. `LumicFileService` mantiene su
regla separada de exportar solo resultados exitosos con al menos una habitación.

## Ejemplos y comprobación

| Archivo | Resultado estructural |
|---|---|
| [valid-basic.lumic](examples/valid-basic.lumic) | Válido; copia del ejemplo existente |
| [valid-debug.lumic](examples/valid-debug.lumic) | Válido; pasos y snapshots de fixtures existentes |
| [invalid-envelope.lumic](examples/invalid-envelope.lumic) | Inválido: falta fecha; productor es un arreglo |
| [invalid-dimensions.lumic](examples/invalid-dimensions.lumic) | Inválido: dimensión cero |
| [invalid-source-reference.lumic](examples/invalid-source-reference.lumic) | Inválido: línea cero y columna de texto |
| [invalid-debug.lumic](examples/invalid-debug.lumic) | Inválido: evento desconocido |

Desde `apps/desktop/renderer`, ejecutar:

```powershell
npm.cmd run test:run -- src/tests/contracts/lumicStructure.test.ts --maxWorkers=2
```

La suite genera un documento con todos los campos del esquema y verifica rechazo
de campos obligatorios ausentes y valores null, además de geometría, referencias,
depuración, compatibilidad y roundtrip. Comprueba referencias locales del esquema.
No es un motor general de JSON Schema ni sustituye su validación con una herramienta
estándar: no hay tal motor instalado en este entorno y no se instalaron dependencias.
