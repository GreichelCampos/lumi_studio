# L-009: propuesta de contrato de intercambio `.lumic`

Estado: propuesta para revisión. No aprobada por Gaby y Grei. Este documento no
introduce reglas nuevas de aceptación en el IDE. El cierre de L-009 está pendiente.

## Base documental

- [README: formato y arquitectura objetivo](../README.md).
- [Contrato AST](ast_contract.md): separa expresamente el AST de ScenePlan.
- [ScenePlan interno Python](../spatial/scene_plan.py).
- [ScenePlan del visor](../apps/desktop/renderer/src/types/domain/spatial.ts).
- [Contenedor del IDE](../apps/desktop/renderer/src/types/domain/contracts.ts).
- [Eventos de depuración](../apps/desktop/renderer/src/types/domain/debug.ts).
- [Validadores actuales](../apps/desktop/renderer/src/services/compiler/contracts/contractValidator.ts).
- [Exportación e importación](../apps/desktop/renderer/src/services/storage/LumicFileService.ts).
- [Ejemplo JSON existente](../apps/desktop/renderer/src/data/contracts/sampleLumicArtifact.json).

El repositorio no contiene las fichas oficiales identificadas como L-028 y L-029.
Los efectos descritos abajo corresponden al consumo de escenas y a la depuración;
deben contrastarse con los criterios de aceptación de esas fichas.

## Estructuras que deben permanecer separadas

| Estructura | Responsabilidad y situación actual |
|---|---|
| `.lumic` | Contenedor JSON persistente: versión, productor, proyecto, escena, resumen diagnóstico y pasos opcionales. Está implementado en el IDE. |
| ScenePlan de intercambio | Datos concretos consumidos por el visor. La propuesta reutiliza el modelo TypeScript existente, sujeto a aprobación. |
| ScenePlan interno Python | Dataclasses con valores resueltos y ubicaciones de origen. No se propone modificarlo. |
| AST serializado | Construcciones y expresiones del lenguaje, con ubicación. No sustituye una escena resuelta ni el contenedor compilado. |
| Diagnósticos | Problemas de análisis o ejecución. El contenedor actual solo incluye un resumen, no los diagnósticos completos. |
| Eventos de depuración | Secuencia opcional de `DebugStep`, con referencia de origen y `sceneSnapshot`. No es un AST ni una respuesta del protocolo del worker. |

## Alternativas de formato para decidir antes de implementar

| Alternativa | Consumo de escenas / L-028 | Depuración / L-029 |
|---|---|---|
| A. Reutilizar `LumiCompiledArtifact` y ScenePlan TypeScript como candidato v1.0.0 | Conserva los nombres, el visor y los archivos válidos actuales. Requiere un adaptador futuro desde Python y acordar la procedencia de campos ausentes. | Conserva `DebugStep`, `sourceRef` y `sceneSnapshot`. Requiere acordar identidad y referencias entre escenas. |
| B. Definir un DTO nuevo basado en ScenePlan Python | Conserva la cercanía con el modelo interno, pero exige adaptar el visor y decidir migración/versionado de archivos existentes. | Exige adaptar también snapshots y referencias de los eventos. |

Se recomienda A para reducir cambios. Es una propuesta, no una decisión del equipo.
Ninguna alternativa autoriza generar escenas desde el AST en TypeScript ni modificar
unilateralmente el núcleo Python.

## Contenido declarado existente

La exportación actual escribe `format: "lumic"`, `schemaVersion: "1.0.0"` y
metadatos de productor `lumi-compiler`, versión `1.0.0`, target `lumi-3d-scene`.
Esos valores describen el exportador del IDE, no prueban la existencia de un
productor `.lumic` en Python.

| Campo del contenedor | Tipo declarado | Obligatorio |
|---|---|---|
| `format` | literal `"lumic"` | Sí |
| `schemaVersion` | string | Sí |
| `compiledAt` | string | Sí |
| `compiler` | `{name: string, version: string, target: string}` | Sí |
| `project` | `{id: string, name: string, entryFile: string, sourceFilesCount: number, sourceChecksum?: string}` | Sí |
| `scenePlan` | ScenePlan de intercambio | Sí |
| `debugSteps` | `DebugStep[]` | No |
| `diagnosticsSummary` | `{totalErrors: number, totalWarnings: number, totalSpatialIssues: number, hasBlockingErrors: boolean}` | Sí |
| `metadata` | `Record<string, unknown>` | No |

El ejemplo enlazado es JSON válido del formato existente; todavía no certifica un
esquema formal completo. El generador no calcula `sourceChecksum`. El validador
actual no verifica todos los campos declarados, por lo que su aceptación no basta
para demostrar conformidad con esta tabla.

## Convenciones existentes y límites

- Objetos: `position = [x, y, z]`, origen en el centro del suelo;
  `rotation = [rx, ry, rz]` en grados;
  `dimensions = [ancho, altura, profundidad]` en metros.
- Habitaciones: `dimensions = [ancho X, largo Z, altura Y]`. El modelo interno
  Python conserva dimensiones por nombre, con ubicaciones de origen.
- Paredes: claves `north`, `south`, `east`, `west`. Las aberturas usan valores
  `norte`, `sur`, `este`, `oeste` en `wall`.
- Fuente: el IDE declara `file`, `line` y `column` opcional en `SourceReference`.
  Python conserva `file`, `line`, `column` en `SourceLocation`, incluso por valor.
- Los objetos y las aberturas tienen IDs; las habitaciones también. Python no
  declara IDs equivalentes en su ScenePlan interno.
- Los eventos conservan `lineNumber` y `actionDescription` como alias existentes
  de `sourceRef.line` y `description`.
- El modelo interno Python no fija unidades ni origen mediante sus tipos. No se
  debe asumir una conversión implícita.
- El validador de versiones actual admite `1.0` y extrae solo la versión mayor.
  Cambiarlo a SemVer estricto o a una versión exacta requiere decidir compatibilidad.

## Decisiones pendientes del equipo

| Decisión | Alternativas y consecuencias |
|---|---|
| Base del contenedor | Elegir A o B antes de publicar un esquema canónico. |
| Identidad | IDs únicos por escena o por habitación; estabilidad entre recompilaciones y snapshots. Cambia cómo resolver selección y eventos. |
| Aberturas | Formalizar el origen y signo del desplazamiento `position` según pared. Una interpretación distinta desplaza geometría. |
| Datos faltantes | Determinar quién suministra dimensiones de objetos, piso, paredes y tamaños de aberturas. Un catálogo y sus valores por defecto no pueden inventarse en el adaptador. |
| Versiones | Conservar compatibilidad mayor, exigir SemVer o aceptar solo versiones publicadas. Acordar relación entre versión del contenedor y de escena. |
| Referencias de origen | Identidad de archivo, ámbito de nombres y conservación de ubicaciones; no normalizar rutas unilateralmente. |
| Diagnósticos | Mantener resumen o añadir lista completa. Python no aporta severidad equivalente a la UI; no inferirla a partir del código. |
| Depuración | Presencia opcional, orden/continuidad de pasos, alcance de referencias y política de snapshots. No fabricar eventos desde escenas estáticas. |
| Extensibilidad | Política de campos desconocidos y metadata; impacto en compatibilidad futura y límites de importación. |
| Consistencia | Escenas vacías, conteos derivados, área/volumen, fechas y checksum: definir restricciones más allá de los tipos existentes. |

## Entrega preliminar para Gaby y Grei

Compartir este documento, el ejemplo JSON existente y las definiciones TypeScript
del contenedor, escena, referencias de origen y depuración.

Si se elige A, un productor Python futuro deberá entregar el contenedor y los
campos concretos de escena declarados arriba y en los tipos enlazados. No basta
con `asdict(ScenePlan)` ni con serializar el AST. El consumidor podrá separar
`scenePlan` para visualizar y `debugSteps` para depurar, después de validar ambos.

El protocolo actual anuncia `scenePlan: false` y `debugTrace: false`; las fachadas
no devuelven escenas y el adaptador del renderer mantiene `scenePlan: null`.
La conexión real, la generación desde AST y la disponibilidad de los datos
espaciales siguen siendo dependencias pendientes, no funciones que este documento
declare implementadas.

## Criterios para completar la parte IDE de L-009

1. Registrar la decisión de base y las reglas pendientes con el equipo.
2. Publicar el JSON Schema versionado y ejemplos positivos y negativos.
3. Completar la validación de todos los campos y las referencias acordadas.
4. Verificar compatibilidad con los archivos actuales, visor y depurador.
5. Probar rechazo de datos inválidos y concordancia entre esquema y validador.
6. Entregar especificación y ejemplos a Gaby y Grei, distinguiendo el contrato
   acordado de la implementación Python todavía pendiente.

No se puede declarar cerrado L-009 ni aprobado el formato únicamente con esta
propuesta. No se continúa con L-030 ni con otra responsabilidad.
