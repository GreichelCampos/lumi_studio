# L-009: integración `.lumic` con Python

Contrato candidato v1.0.0, pendiente de revisión y acuerdo con Gaby y Grei.

## Archivos para compartir

Entregar la carpeta completa [contracts/lumic/v1.0.0](contracts/lumic/v1.0.0/README.md),
con el esquema y los seis ejemplos, junto con esta guía y la
[propuesta de contrato](lumic_contract_proposal.md).

## Producción y consumo

El productor entrega un contenedor JSON `.lumic`. El consumidor valida el archivo
antes de extraer `scenePlan` para visualizar y `debugSteps` para depurar. El nombre
y la versión del productor deben identificar la implementación real.

En el IDE, `LumicFileService` utiliza `validateLumicArtifact` y
`parseAndValidateLumicArtifact`. Los validadores históricos de resultados del mock
no sustituyen esta entrada. El archivo persistente no forma parte del protocolo
actual del worker.

Ejemplo mínimo estructural, sin habitaciones ni eventos:

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

Esta escena vacía puede importarse; el IDE no la exporta desde una compilación sin
habitaciones. Los ejemplos [valid-basic.lumic](contracts/lumic/v1.0.0/examples/valid-basic.lumic)
y [valid-debug.lumic](contracts/lumic/v1.0.0/examples/valid-debug.lumic) muestran una
escena completa y eventos con snapshots. Son datos de demostración, no salidas del
compilador Python actual.

## Adaptación pendiente desde Python

| Modelo interno | Intercambio y acuerdo necesario |
|---|---|
| `ScenePlan.rooms` | Arreglo `scenePlan.rooms`, conservando el orden. |
| `RoomPlan.name` | `RoomModel.name`; falta definir `id`. |
| `width.value`, `length.value`, `height.value` | `[ancho X, largo Z, altura Y]`, tras acordar unidades. |
| `elements` y `element_kind` | Clasificar piso, paredes, aberturas y objetos; falta el mapeo completo. |
| `object_type` | Tipo del objeto del visor; faltan dimensiones resueltas o catálogo acordado. |
| `properties` | Color y material, sin inventar valores ausentes ni asumir equivalencias. |
| Vectores de `SpatialNumber` | Tuplas numéricas; acordar unidades y tratamiento de valores opcionales. |
| `SourceLocation` | Conservar `file`, `line` y `column`, incluso las ubicaciones por valor; acordar su correspondencia con `SourceReference`. |

`asdict(ScenePlan)` y la serialización del AST no producen este contenedor. No se
implementa generación desde AST en TypeScript ni se modifica unilateralmente el
núcleo Python. Los diagnósticos completos siguen separados del resumen: el núcleo
no declara severidad o bloqueo equivalentes a la UI y no deben inferirse por el
código. Tampoco se generan eventos a partir de una escena estática.

## Estado de la integración

Electron ya se comunica con Python, pero las fachadas aún no devuelven escenas ni
trazas. El protocolo anuncia `scenePlan: false` y `debugTrace: false`; el adaptador
del IDE mantiene `scenePlan: null`.

El IDE valida campos, ubicaciones, dimensiones y snapshots. La integridad
referencial y la semántica espacial siguen pendientes. Antes de implementar el
adaptador deben revisarse las [decisiones del equipo](lumic_contract_proposal.md#decisiones-pendientes-del-equipo).
La producción real desde Python es una dependencia separada del cierre de la parte
IDE de L-009.
