# L-009: entrega de integración para Gaby y Grei

Estado: candidato estructural v1.0.0 basado en TypeScript, autorizado para trabajo
del IDE. Falta la validación conjunta del equipo y las decisiones indicadas abajo.
No se declara cerrada L-009 ni se asignan responsabilidades nuevas del núcleo.

## Archivos para compartir

Compartir completa la carpeta [contracts/lumic/v1.0.0](contracts/lumic/v1.0.0/README.md):
el esquema `lumic.schema.json`, su explicación y los seis ejemplos `.lumic`.
Adjuntar este documento y la [propuesta y alternativas](lumic_contract_proposal.md).

## Qué producir y consumir

El productor futuro entrega un contenedor JSON `.lumic`; el consumidor valida el
contenedor antes de extraer `scenePlan` para el visor y `debugSteps` para depurar.
El nombre y versión del productor deben describir la implementación real, no
copiar una identidad de compilador solo porque aparece en un fixture.

En el IDE, la entrada completa es `validateLumicArtifact` o
`parseAndValidateLumicArtifact`, utilizadas por `LumicFileService`. Los validadores
históricos independientes de resultados del mock no sustituyen esta entrada.
Este archivo persistente no se agrega al protocolo actual del worker.

Este es un ejemplo mínimo estructural, sin escena construida ni eventos:

```json
{
  "format": "lumic",
  "schemaVersion": "1.0.0",
  "compiledAt": "2026-10-17T00:00:00Z",
  "compiler": {"name": "example-producer", "version": "1.0.0", "target": "lumi-3d-scene"},
  "project": {"id": "project-1", "name": "Ejemplo", "entryFile": "principal.lumi", "sourceFilesCount": 1},
  "scenePlan": {"version": "1.0.0", "rooms": []},
  "diagnosticsSummary": {"totalErrors": 0, "totalWarnings": 0, "totalSpatialIssues": 0, "hasBlockingErrors": false}
}
```

Importar esta estructura vacía es válido; el IDE no la exporta desde una compilación
sin habitaciones. Para una escena completa, usar [valid-basic.lumic](contracts/lumic/v1.0.0/examples/valid-basic.lumic).
Para eventos con referencias y snapshots, usar [valid-debug.lumic](contracts/lumic/v1.0.0/examples/valid-debug.lumic).
Son ejemplos de intercambio, no salidas reales del compilador Python actual.

## Adaptación desde Python, todavía pendiente

| Python interno | Intercambio y decisión necesaria |
|---|---|
| `ScenePlan.rooms` | Arreglo `scenePlan.rooms`; conservar orden |
| `RoomPlan.name` | `RoomModel.name`; falta política para `id` |
| `width.value`, `length.value`, `height.value` | `[ancho X, largo Z, altura Y]`, tras acordar unidades |
| `elements` y `element_kind` | Clasificar en piso, paredes, aberturas y objetos; falta acordar mapeo completo |
| `object_type` | Tipo de objeto del visor; faltan dimensiones resueltas/catálogo acordado |
| `properties` | Color y material, sin inventar valores ausentes ni asumir equivalencias |
| Vectores de `SpatialNumber` | Tuplas numéricas; falta política para valores opcionales y unidades |
| `SourceLocation` | Referencias de origen, conservando identidad exacta de archivo y ubicación |

`asdict(ScenePlan)` no produce este contenedor. El AST conserva expresiones y
construcciones; serializarlo tampoco produce una escena resuelta. La generación
desde AST no se implementa en TypeScript ni se cambia unilateralmente en Python.

Los diagnósticos completos permanecen separados del resumen del archivo. El núcleo
no declara severidad/bloqueo equivalentes a los de la UI; no inferirlos por prefijos
del código. No fabricar trazas a partir de una escena estática.

## Bloqueos y decisiones conjuntas

- El protocolo real todavía anuncia `scenePlan: false` y `debugTrace: false`.
  Las fachadas no devuelven ScenePlan y el adaptador IDE conserva `scenePlan: null`.
- Acordar generación, ámbito, unicidad y estabilidad de IDs, y resolución de
  `roomId`/`activeObjectId` entre escenas y snapshots.
- Acordar origen/signo de aberturas, unidades, dimensiones faltantes, superficies
  y catálogo. La validación estructural no resuelve esos datos.
- Acordar versiones admitidas, fechas, checksum, extensiones y límites de importación.
- Acordar diagnóstico persistido, coherencia de resúmenes, orden de eventos y alias.
- Confirmar las fichas oficiales de L-028 y L-029: no están disponibles en el repositorio.

El IDE ya verifica la estructura declarada, referencias de código, dimensiones y
snapshots, sin afirmar integridad referencial ni semántica espacial. Para cerrar
L-009 falta revisar y registrar estos acuerdos, ajustar esquema y pruebas a ellos,
y verificar la conformidad con un motor estándar de JSON Schema. La disponibilidad
del productor Python se documenta como dependencia separada de la parte IDE.
