# Interoperabilidad `.lumic` entre Python y el IDE

Contrato candidato v1.0.0. Su adopción como contrato canónico requiere validación
de interoperabilidad entre el núcleo Python y el IDE.

## Referencias y modelos

La [referencia del formato](contracts/lumic/v1.0.0/README.md) describe los campos,
convenciones y límites de validación. Incluye el JSON Schema y seis ejemplos.

| Estructura | Función |
|---|---|
| `.lumic` | Contenedor JSON persistente: versión, productor, proyecto, escena, resumen diagnóstico y pasos opcionales. |
| ScenePlan de intercambio | Modelo TypeScript consumido por el visor y los snapshots. |
| ScenePlan interno Python | Dataclasses de valores resueltos y ubicaciones de origen; requieren adaptación al intercambio. |
| AST serializado | Construcciones y expresiones del lenguaje; no representa una escena resuelta. |
| Diagnósticos | Problemas de análisis o ejecución. El contenedor guarda solo un resumen. |
| Eventos de depuración | Secuencia opcional de `DebugStep`, con `sourceRef` y `sceneSnapshot`, separada del AST y del protocolo del worker. |

Las definiciones están en el [contrato AST](ast_contract.md), el
[modelo espacial Python](../spatial/scene_plan.py) y los tipos TypeScript de
[escena](../apps/desktop/renderer/src/types/domain/spatial.ts),
[contenedor](../apps/desktop/renderer/src/types/domain/contracts.ts) y
[depuración](../apps/desktop/renderer/src/types/domain/debug.ts). La
[arquitectura general](../README.md) describe los componentes del sistema.

El formato candidato utiliza `LumiCompiledArtifact` y el ScenePlan TypeScript
existentes para conservar la compatibilidad con el visor, los archivos válidos y
los snapshots. La adaptación desde el modelo Python es una capa separada; no
incluye compilación ni generación de escenas desde AST en TypeScript.

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

## Adaptación del modelo Python

| Modelo interno | Intercambio y requisito |
|---|---|
| `ScenePlan.rooms` | Arreglo `scenePlan.rooms`, conservando el orden. |
| `RoomPlan.name` | `RoomModel.name`; el adaptador runtime genera `id` a partir de archivo, línea, columna y nombre. Su estabilidad contractual sigue pendiente. |
| `width.value`, `length.value`, `height.value` | `[ancho X, largo Z, altura Y]`, tras acordar unidades. |
| `elements` y `element_kind` | El adaptador publica un piso y objetos colocados. Rechaza paredes y aberturas declaradas y más de un piso. |
| `object_type` | Tipo del visor y catálogo visual provisional de dimensiones; requiere ratificación. |
| `properties` | Color y material del piso/objetos; hay estilos neutrales de presentación para superficies ausentes. No se escriben como semántica en ScenePlan interno. |
| Vectores de `SpatialNumber` | Tuplas numéricas finitas; rotación ausente se presenta como cero, posición indefinida impide publicar el objeto. Acordar unidades y política completa. |
| `SourceLocation` | Se publica `sourceRef` de declaración en objetos; los valores conservan sus fuentes en el modelo interno. La habitación no tiene sourceRef explícito en el DTO. |

`asdict(ScenePlan)` y la serialización del AST no producen este contenedor. No se
implementa generación desde AST en TypeScript ni se modifica unilateralmente el
núcleo Python. Los diagnósticos completos siguen separados del resumen: el núcleo
no declara severidad o bloqueo equivalentes a la UI y no deben inferirse por el
código. Tampoco se generan eventos a partir de una escena estática.

## Estado de la integración

`ExecutionService` devuelve la escena producida por el intérprete cuando la
ejecución es correcta. [scene_adapter.py](../services/protocol/scene_adapter.py)
convierte el plan interno al DTO; el protocolo publica `scenePlan` y
`capabilities.scenePlan: true` si hay habitaciones. El IDE valida y conserva ese
resultado. Sin escena el campo se omite y se adapta a `null`. Compilar solo analiza;
`debugTrace` sigue en `false` y no se generan eventos desde un plan final.

El IDE valida campos, ubicaciones, dimensiones y snapshots. Esa validación
estructural no garantiza integridad referencial ni validez semántica espacial.
El E2E de Electron de desarrollo comprobó escena real, transformaciones y limpieza
tras error. No demuestra exportación/reimportación del contenedor `.lumic`, trazas
Python, geometría de aberturas declaradas ni aceptación del instalador combinado.
Los siguientes acuerdos siguen pendientes; importar fixtures no los ratifica.

## Requisitos de interoperabilidad

Estas reglas requieren especificación y validación antes de considerar canónico
el contrato candidato. No describen garantías adicionales de los validadores actuales.

| Área | Definición requerida |
|---|---|
| Contenedor | Confirmar la compatibilidad de la base TypeScript con los productores y consumidores Python. |
| Identidad | Ámbito y unicidad de IDs, estabilidad entre recompilaciones y resolución de entidades en escenas y snapshots. |
| Aberturas | Origen y signo de `position` según pared. |
| Datos espaciales | Ratificar unidades y catálogo visual provisional, separar estilos neutrales de semántica y definir tamaños/ubicación de aberturas sin fabricar datos faltantes. |
| Versiones | Compatibilidad por versión mayor, SemVer estricto o versiones publicadas, y relación entre versiones del contenedor y de la escena. |
| Origen del código | Identidad de archivo, ámbito de nombres y conservación de ubicaciones entre archivos e importaciones, sin normalización implícita de rutas. |
| Diagnósticos | Alcance del resumen y posible intercambio de diagnósticos completos; la severidad no se infiere de los códigos del núcleo. |
| Depuración | Eventos opcionales, orden, continuidad, alias y política de snapshots; no se fabrican trazas desde escenas estáticas. |
| Extensibilidad | Tratamiento de campos desconocidos y `metadata`, y límites de tamaño y profundidad al importar. |
| Consistencia | Reglas para escenas vacías, conteos, área, volumen, fechas y checksum. |

El esquema debe contrastarse con un motor estándar de JSON Schema Draft 7 además
de las pruebas estructurales del IDE.
