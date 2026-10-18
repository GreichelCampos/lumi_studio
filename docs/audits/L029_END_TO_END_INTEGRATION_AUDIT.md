# L-029 — Auditoría de integración ScenePlan extremo a extremo

## A. Resumen ejecutivo

Estado: **PARCIALMENTE COMPLETADA**.

La integración utiliza como única fuente espacial el estado producido por la
ejecución real de Lumi:

```text
Lexer → Parser → análisis semántico → Interpreter → ScenePlanBuilder
→ ScenePlan → SpatialValidator → InterpreterResult → ExecutionService
→ ExecutionResult → DTO → protocolo JSON → adaptador TypeScript → Three.js
```

El backend transporta escenas válidas de habitaciones, pisos y muebles colocados.
Las posiciones y rotaciones reflejan el estado final producido por variables,
expresiones, condiciones, ciclos y funciones. Las escenas inválidas o ejecuciones
fallidas no se publican. Los programas no espaciales mantienen el contrato previo.

Paredes declaradas, puertas y ventanas no pueden publicarse todavía: el AST y
`ScenePlan` no contienen orientación de pared, desplazamiento, ancho y alto que el
DTO exige. Se rechazan mediante `SERIALIZATION_ERROR`; nunca se omiten ni se les
inventa geometría. La prueba Electron/Three.js real quedó preparada, pero su
ejecución está pendiente porque el binario de Electron no pudo descargarse en el
entorno. Por esas dos razones L-029 no se declara completa.

## B. Estado inicial

- Rama base: `feature/l029-scene-plan-generator`.
- Commit base: `0338fd9b0949108da9bfe1bd33473a1f934e9f47`.
- Rama de trabajo: `feature/l029-end-to-end-integration`.
- Referencia experimental leída: `0b1a9efb7c65b06a25af781e93addedcb2c7b4e8`.
- Suite Python inicial: 528 pruebas.
- `InterpreterResult.scene_plan`, `ScenePlanBuilder` y `SpatialValidator` ya existían.
- `ExecutionService`, protocolo e IDE no transportaban el plan.
- La rama experimental tenía transporte para habitaciones literales y un piso,
  pero empleaba un productor estático incompatible con la ejecución real.

Los archivos `CambiosLumi (1).pdf` y `Paradigmas_StudyLab.html` permanecieron
sin seguimiento e intactos.

## C. Decisiones arquitectónicas

### Una sola fuente espacial

- Problema: las ramas contenían productores distintos.
- Alternativas: conservar ambos; reemplazar el builder de ejecución; adoptar la
  ejecución como fuente única.
- Elección: conservar `ScenePlanBuilder` basado en ejecución.
- Motivo: es el único que respeta control de flujo, funciones y operaciones.
- Consecuencia: no se incorporó el `SceneBuilder` estático experimental.

### Separar análisis incompleto de ejecución exitosa

- Problema: la limitación semántica espacial hacía que una ejecución válida
  terminara como `INCOMPLETE` y no pudiera publicar una escena.
- Elección: conservar `CompilationResult.status == INCOMPLETE` y sus limitaciones,
  pero permitir `ExecutionResult.status == COMPLETED` cuando el runtime y la
  validación espacial terminan sin diagnósticos.
- Motivo: no se afirma que el análisis sea completo, pero tampoco se falsea el
  resultado real de la ejecución.
- Riesgo: consumidores deben distinguir `analysisStatus` de `status`.

### Publicación de escenas

- `analyze`: nunca publica escena.
- `execute` exitoso con habitaciones: publica escena y activa `scenePlan`.
- Programa no espacial o escena vacía: no publica DTO; mantiene compatibilidad.
- Error runtime, builder o espacial: no publica escena.
- Escena interna inválida: puede permanecer en `InterpreterResult` para inspección,
  pero `ExecutionResult.scene_plan` es `None`.
- Error de adaptación: respuesta de infraestructura `SERIALIZATION_ERROR`.

### Geometría visual

- Habitación: dimensiones resueltas del lenguaje.
- Piso ausente: superficie neutral necesaria para representar la habitación.
- Paredes visuales de cerramiento: estilos neutrales del viewport; no representan
  declaraciones `WallNode`.
- Muebles: catálogo `STANDARD_FURNITURE_DIMS` ya existente en el IDE, copiado como
  configuración de presentación en la frontera Python. Tipo desconocido usa caja
  visual genérica `[1, 1, 1]` y no modifica el modelo interno.
- Rotación ausente: representación visual `[0, 0, 0]`.
- Objeto no colocado: no es publicable.
- Pared, puerta o ventana declarada: no publicable hasta disponer de geometría.

### Representabilidad JSON

`SpatialValidator` permite enteros Python arbitrariamente grandes. El adaptador
comprueba adicionalmente que dimensiones, vectores, área y volumen puedan cruzar
JSON como números JavaScript finitos. Esta es una regla de transporte, no una
regla espacial de L-026.

## D. Inventario de cambios

| Archivo | Cambio | Responsabilidad | Riesgo | Evidencia |
|---|---|---|---|---|
| `services/results.py` | Modificado | `ExecutionResult.scene_plan` | Bajo | pruebas de servicio |
| `services/execution_service.py` | Modificado | Propagación y política de estado | Medio | pruebas de servicio/protocolo |
| `services/protocol/scene_adapter.py` | Nuevo | ScenePlan → DTO | Alto | pruebas de respuesta runtime |
| `services/protocol/models.py` | Modificado | DTO opcional y capacidad | Medio | protocolo/cross-language |
| `services/protocol/adapters.py` | Modificado | Publicación exclusiva desde ejecución | Medio | dispatcher |
| `services/protocol/dispatcher.py` | Modificado | Error controlado de adaptación | Bajo | prueba no representable |
| `sceneStructure.ts` | Modificado | Import ejecutable por Node | Bajo | prueba cruzada/build |
| `protocol/types.ts` | Modificado | Tipo de escena recibido | Medio | typecheck |
| `scenePayload.ts` | Nuevo | Validación estructural | Medio | Vitest/cross-language |
| `responseValidator.ts` | Modificado | Coherencia execute/analyze | Alto | pruebas contractuales |
| `resultAdapter.ts` | Modificado | Entrega al estado del IDE | Medio | prueba de servicio TS |
| `test_execution_service.py` | Modificado | Política de ejecución | Bajo | pytest |
| `test_dispatcher.py` | Modificado | Política del protocolo | Bajo | pytest |
| `test_runtime_scene_response.py` | Nuevo | Flujo real Python/JSON | Bajo | pytest |
| `protocolResponse.test.ts` | Modificado | Contrato TypeScript | Bajo | Vitest |
| `PythonCompilerService.test.ts` | Modificado | ScenePlan en IDE | Bajo | Vitest |
| `runtime-scene.integration.mjs` | Nuevo | Prueba Electron/Three.js real | Medio | pendiente por binario |

## E. Reutilización de la rama experimental

Se reutilizaron selectivamente los diseños de:

- `services/protocol/scene_adapter.py`.
- `scenePayload.ts`.
- Campo opcional `scenePlan` y capacidad del protocolo.
- Validación estructural previa al viewport.
- Adaptación de la respuesta Python al resultado del IDE.

Se adaptaron para tomar la escena desde `ExecutionResult`, aceptar ejecución
completada con análisis espacial incompleto y transportar muebles con estado final.

No se incorporaron:

- El `SceneBuilder` estático experimental.
- La generación de escena dentro de `CompilerService`.
- La publicación desde `CompilationResult`.
- La restricción a dimensiones literales y un único piso.

No se fusionó el builder estático porque produciría una escena distinta de la
ejecutada cuando existan variables, funciones, condiciones o ciclos.

## F. Contratos

### ScenePlan interno

Permanece inmutable, independiente del IDE y conserva ubicaciones por valor.
Contiene habitaciones ordenadas y elementos con tipo, propiedades, posición y
rotación finales opcionales.

### ExecutionResult

Agrega `scene_plan: ScenePlan | None`. Solo contiene plan publicable cuando la
ejecución no produjo diagnósticos.

### DTO y JSON

El DTO mantiene `version: "1.0.0"`, habitaciones, dimensiones, piso, paredes,
aberturas, objetos, área y volumen. Los IDs deterministas combinan clase, archivo,
línea, columna y nombre. `sourceRef` conserva archivo, línea y columna.

### TypeScript

`ProtocolResult.scenePlan` es opcional. `capabilities.scenePlan` indica presencia
real. `scenePayload.ts` valida la estructura y prohíbe escenas en resultados que
no estén completados.

### Diagnósticos

Los diagnósticos `RUNTIME` y `SPATIAL` cruzan el protocolo sin modificar código,
categoría ni ubicación. Los defectos de representabilidad del DTO son errores de
infraestructura `SERIALIZATION_ERROR`, no diagnósticos inventados del lenguaje.

## G. Geometría y convenciones

- Habitación: `[ancho X, largo Z, altura Y]`.
- Posición: `[x, y, z]` centrada según el contrato visual existente.
- Rotación: grados; Three.js realiza la conversión a radianes.
- Muebles: dimensiones visuales `[ancho, alto, profundidad]` tomadas del catálogo
  preexistente del IDE.
- IDs: deterministas para una fuente sin cambios, pero no estables tras mover una
  declaración a otra ubicación.
- Área y volumen: derivados de dimensiones validadas.
- Colisión, límites y puertas bloqueadas: no calculados; pertenecen a L-035.
- Estilos neutrales: decisiones de presentación, no semántica Lumi.

## H. Evidencia de funcionamiento

Comandos y resultados:

```text
python -m pytest
535 passed

npm run test:run                 (renderer)
58 archivos, 741 pruebas aprobadas

npm run lint                     (renderer)
tsc de producción y pruebas aprobado

npm run build                    (renderer)
build Vite aprobado; advertencia no bloqueante por chunk >500 kB

npm test                         (desktop)
6 archivos, 50 pruebas aprobadas

npm run build                    (desktop + renderer)
aprobado
```

La prueba cruzada invoca el worker Python real y valida sus respuestas cargando
directamente `responseValidator.ts` con Node 24.

La prueba `runtime-scene.integration.mjs` recorre código Lumi real, worker,
protocolo, React y `ThreeSceneManager`; verifica piso, mueble, posición final,
rotación final, llamada real de render y limpieza tras error. No pudo completarse
porque el entorno no logró descargar el binario de Electron. Por tanto, la
verificación visual/WebGL real permanece pendiente y no se afirma como aprobada.

## I. Riesgos y pendientes

### Pendientes de L-029

- Definir geometría de paredes declaradas.
- Definir pared, posición, ancho y alto de puertas y ventanas.
- Ejecutar la prueba Electron real en un entorno con el binario disponible.
- Acordar formalmente el catálogo visual y el fallback genérico.
- Acordar estabilidad de IDs entre ediciones.

### Bloqueo contractual verificado para paredes y aberturas

La revisión final de `ast_nodes.py`, `parser.py` y `ast_contract.md` confirmó que
`WallNode`, `DoorNode` y `WindowNode` exponen únicamente:

```text
name, properties, file, line, column
```

`properties` admite exclusivamente `color` y `material`. No existe sintaxis ni
campo para orientación de pared, pared asociada, desplazamiento, ancho o alto.
El DTO del IDE requiere esos valores para puertas y ventanas, y las fábricas
Three.js los utilizan para segmentar las paredes y posicionar las aberturas.

Por tanto, representar esas declaraciones exigiría una decisión nueva de lenguaje.
Las alternativas que requieren aprobación conjunta son:

1. Extender la gramática y los nodos con campos explícitos para orientación,
   desplazamiento y dimensiones.
2. Aprobar nuevas propiedades espaciales además de `color` y `material`.
3. Definir un contrato geométrico independiente que derive esos datos de comandos
   existentes; actualmente no existe tal comando.

Hasta que se apruebe una alternativa, el adaptador devuelve
`SERIALIZATION_ERROR`. Las cuatro paredes visuales que `RoomFactory` deriva de las
dimensiones de una habitación son cerramientos de presentación y no equivalen a
declaraciones `WallNode`.

### L-026

No hay cambios pendientes introducidos aquí. Continúa validando dimensiones,
vectores y propiedades.

### L-035

Colisiones, límites, puertas bloqueadas e indicadores geométricos permanecen fuera
de alcance y no fueron simulados.

### Riesgos de integración

- El cambio de política de `ExecutionStatus` debe comunicarse a consumidores.
- El catálogo visual está duplicado entre Python y TypeScript hasta acordar una
  fuente de configuración compartida.
- `SERIALIZATION_ERROR` impide publicar toda la escena cuando contiene un elemento
  no representable; es preferible a omitirlo silenciosamente.
- IDs basados en ubicación cambian cuando cambia el texto fuente.

## J. Guía para las compañeras

1. Ejecutar Lumi mediante `ExecutionService`, no mediante un builder estático.
2. Revisar `InterpreterResult.scene_plan` en `lumi_language/interpreter.py`.
3. Revisar la propagación en `services/execution_service.py` y `services/results.py`.
4. Revisar la traducción visual en `services/protocol/scene_adapter.py`.
5. Revisar publicación JSON en `services/protocol/adapters.py`.
6. Revisar validación del IDE en `scenePayload.ts` y `responseValidator.ts`.
7. Revisar consumo en `resultAdapter.ts`; el estado existente del IDE entrega el
   plan a `Viewport3D` y `ThreeSceneManager`.

Reproducción backend:

```powershell
.\.venv\Scripts\python.exe -m pytest tests\protocol\test_runtime_scene_response.py -v
```

Reproducción frontend:

```powershell
npm.cmd --prefix apps/desktop/renderer run test:run
npm.cmd --prefix apps/desktop/renderer run lint
npm.cmd --prefix apps/desktop/renderer run build
```

Reproducción E2E cuando Electron esté instalado:

```powershell
cd apps\desktop
node tests\runtime-scene.integration.mjs
```

## K. Estado final de Git

- Rama: `feature/l029-end-to-end-integration`.
- Base: `0338fd9b0949108da9bfe1bd33473a1f934e9f47`.
- No se creó commit.
- No se hizo push, merge, rebase ni cherry-pick.
- La rama experimental permaneció intacta.
- Los dos archivos ajenos sin seguimiento permanecieron intactos.

El inventario y los resultados definitivos deben actualizarse en este apartado al
momento de la revisión previa al commit.

## L. Continuación y verificación del 18 de octubre de 2026

### Inventario preservado

La reanudación encontró 13 archivos tracked modificados y cuatro archivos
funcionales/de prueba nuevos de L-029: 17 archivos de integración en total. La
referencia a "16 archivos" corresponde a contratos, transporte y pruebas sin
contar `runtime-scene.integration.mjs`, la evidencia Electron E2E preparada
posteriormente. Además existen esta auditoría y cuatro documentos bajo
`docs/integration/`.

Los archivos ajenos `CambiosLumi (1).pdf` y `Paradigmas_StudyLab.html` continúan
sin seguimiento, no se leyeron ni modificaron. No se descartó ni sobrescribió
ningún cambio previo.

### Partes implementadas

- `ExecutionResult` transporta el `ScenePlan` publicable.
- `ExecutionService` separa el estado del análisis de la ejecución real.
- `scene_plan_dto` adapta el plan interno al contrato visual versionado.
- El protocolo publica una escena solo en una ejecución correcta con habitaciones.
- TypeScript valida la coherencia de capacidad, estado y estructura.
- `resultAdapter` entrega el plan al estado existente del IDE.
- `Viewport3D` y `ThreeSceneManager` consumen la estructura sin otro generador.
- Diagnósticos runtime y espaciales impiden publicar escenas inválidas.
- Habitaciones, piso y muebles colocados incluyen el estado final y su trazabilidad.

La prueba E2E se reforzó para inspeccionar el objeto Three.js real por su ID y
comprobar su posición `[3, 0, -1]` y la conversión de `90°` en Y a `PI / 2`
radianes. Esto no modifica producción.

### Resultados repetidos desde cero

```text
Python pytest:                 535 passed
Renderer Vitest:              58 archivos, 741 pruebas passed
Renderer TypeScript lint:     aprobado
Desktop Vitest:               6 archivos, 50 pruebas passed
Renderer build:               aprobado
Desktop + renderer build:     aprobado
git diff --check:             aprobado
```

Vitest informa que `HTMLCanvasElement.getContext` no está implementado en el DOM
simulado, sin fallar pruebas. Vite advierte que el chunk principal supera 500 kB;
es una recomendación de optimización, no un fallo de L-029. Pytest no puede crear
su caché por permisos, pero la suite completa termina correctamente.

### Verificación Electron/Three.js

`runtime-scene.integration.mjs` recorre la cadena real y ahora comprueba también
el mueble creado por `FurnitureFactory`. La ejecución sigue bloqueada en este
equipo: `apps/desktop/node_modules/electron/dist/electron.exe` no existe. El
instalador intentó descargar el binario, pero la descarga no produjo progreso y
fue cancelada después de dos minutos. El fallo ocurre antes de iniciar la
aplicación y no demuestra un defecto del código.

Por ello se verifica mediante pruebas automatizadas la frontera Python/JSON,
validación TypeScript, adaptación al estado del IDE y las fábricas/gestor Three.js,
pero no se declara aprobada la ejecución visual Electron E2E.

### Estado y criterio de cierre

L-029 permanece **parcialmente completada**. No hay otra funcionalidad segura que
pueda implementarse sin una decisión de contrato: pared, puerta y ventana carecen
de geometría en la gramática y AST. Tampoco corresponde anticipar L-035.

Para cerrar L-029 se requiere:

1. Aprobar el contrato geométrico de pared, puerta y ventana, o excluir formalmente
   esas entidades del criterio de aceptación de esta entrega.
2. Ejecutar `node tests/runtime-scene.integration.mjs` en un entorno con el binario
   Electron 44.8.0 instalado.
3. Revisar las decisiones de `docs/integration/SCENEPLAN_OPEN_DECISIONS.md`.

No se hizo commit, push, merge, rebase, cherry-pick ni cambio de rama.
