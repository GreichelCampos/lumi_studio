# L-009: propuesta de contrato de intercambio `.lumic`

Contrato candidato v1.0.0, pendiente de revisión y acuerdo con Gaby y Grei.

Este documento registra la base elegida y las decisiones pendientes. Los campos,
convenciones, ejemplos y comprobaciones están en la
[referencia técnica](contracts/lumic/v1.0.0/README.md); la adaptación desde Python,
en la [guía de integración](lumic_python_handoff.md).

## Estructuras y fuentes

| Estructura | Función |
|---|---|
| `.lumic` | Contenedor JSON persistente implementado en el IDE: versión, productor, proyecto, escena, resumen diagnóstico y pasos opcionales. |
| ScenePlan de intercambio | Modelo TypeScript que consume el visor, usado como base candidata. |
| ScenePlan interno Python | Dataclasses de valores resueltos con ubicaciones de origen; requiere adaptación al intercambio. |
| AST serializado | Construcciones y expresiones del lenguaje; no representa una escena resuelta. |
| Diagnósticos | Problemas de análisis o ejecución. El archivo actual guarda solo un resumen. |
| Eventos de depuración | Secuencia opcional de `DebugStep`, con `sourceRef` y `sceneSnapshot`, separada del AST y del protocolo del worker. |

La propuesta se apoya en la [arquitectura del proyecto](../README.md), el
[contrato AST](ast_contract.md), el [modelo espacial Python](../spatial/scene_plan.py)
y los tipos TypeScript de [escena](../apps/desktop/renderer/src/types/domain/spatial.ts),
[contenedor](../apps/desktop/renderer/src/types/domain/contracts.ts) y
[depuración](../apps/desktop/renderer/src/types/domain/debug.ts).

## Base elegida

La responsable del IDE autorizó reutilizar `LumiCompiledArtifact` y el ScenePlan
TypeScript. Esto conserva nombres, archivos válidos, visor y snapshots, y requiere
un adaptador futuro desde Python. Falta ratificar esta base con Gaby y Grei.

La alternativa de crear un DTO basado en Python acercaría el intercambio al modelo
interno, pero exigiría adaptar el visor, los eventos y la compatibilidad de archivos.
Ninguna opción incluye generar escenas desde el AST en TypeScript ni modificar
unilateralmente el núcleo Python.

Las fichas oficiales de L-028 y L-029 no están disponibles en el repositorio. El
impacto sobre consumo de escenas y depuración debe contrastarse con esas fichas;
este documento no les asigna responsabilidades.

## Decisiones pendientes del equipo

| Tema | Acuerdo necesario |
|---|---|
| Contenedor | Ratificar la base TypeScript candidata antes de declararla canónica. |
| Identidad | Definir ámbito y unicidad de IDs, estabilidad entre recompilaciones y resolución de entidades en escenas y snapshots. |
| Aberturas | Fijar origen y signo de `position` según pared. |
| Datos espaciales | Acordar unidades y quién proporciona dimensiones de objetos, piso, paredes, tamaños de aberturas y catálogo; no inventar valores por defecto en el adaptador. |
| Versiones | Elegir compatibilidad mayor, SemVer estricto o versiones publicadas, y la relación entre versión del contenedor y de escena. |
| Origen del código | Acordar identidad de archivo, ámbito de nombres y conservación de ubicaciones entre archivos e importaciones, sin normalizar rutas unilateralmente. |
| Diagnósticos | Decidir si conservar solo el resumen o añadir diagnósticos completos; no inferir severidad de los códigos del núcleo. |
| Depuración | Ratificar eventos opcionales, orden y continuidad, alias y política de snapshots; no fabricar trazas desde escenas estáticas. |
| Extensibilidad | Acordar campos desconocidos, `metadata` y límites de tamaño y profundidad de importación. |
| Consistencia | Definir reglas para escenas vacías, conteos, área, volumen, fechas y checksum. |

## Avance y cierre de L-009

| Estado | Trabajo |
|---|---|
| Implementado en el IDE | Esquema versionado, ejemplos válidos e inválidos, validación estructural y pruebas de rechazo, compatibilidad y roundtrip. |
| Pendiente para cerrar el contrato | Revisar y registrar los acuerdos con Gaby y Grei, ajustar esquema y pruebas a ellos y contrastar el esquema con un motor estándar de JSON Schema. |
| Dependencia del núcleo | Producción de ScenePlan y eventos reales, y adaptación de los datos espaciales faltantes. |

Electron ya se comunica con Python. Sigue pendiente que el backend produzca y
entregue ScenePlan y eventos de depuración: el protocolo anuncia `scenePlan: false`
y `debugTrace: false`, y el adaptador IDE conserva `scenePlan: null`.

La guía de integración y los ejemplos permiten revisar el intercambio, pero no
demuestran que el compilador Python ya produzca `.lumic` ni cierran L-009.
