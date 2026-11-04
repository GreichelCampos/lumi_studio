# Fase 7A — Auditoría del depurador y preparación del frontend

Verificación: 4 de noviembre de 2026, America/Costa_Rica.

## Base y alcance

Rama: `feature/architectural-elements-integration`. HEAD inicial: `52f4cf4a19afff14ea23366a9ba86a618ab07e6c`. El cierre L038/5B-B3 existe en `31b02176d9e992751d152fd3ef43e21b7184047e`. El árbol estaba limpio al comenzar. La caché `.vite/`, ahora versionada, se conserva sin cambios.

Se completó la inspección de componentes, hooks, contratos TypeScript, IPC Electron y productor Python antes de cambiar producción. No se modificaron Python, parser, AST, contratos del protocolo, `.lumic` ni recursos Three.js. No se instalaron dependencias.

## Auditoría de capacidades

| Capacidad | Estado real |
| --- | --- |
| Colocar/quitar breakpoints | Marcas locales del editor. Coinciden por archivo y línea en la reproducción; no se envían a Python. |
| Paso siguiente/anterior, reproducir, pausar, reiniciar | Operan sobre `DebugStep[]` importado o simulado. No controlan el intérprete. |
| Continuar/detener Python | No hay operaciones públicas. `cancellation: false`. La invalidación local descarta respuestas tardías, sin detener el proceso Python. |
| Línea actual | Disponible para el paso importado con `sourceRef` válido. Python no publica una ubicación de ejecución pausada. Los diagnósticos tienen ubicación propia. |
| Variables y valores | Python no publica inspección de variables. `spatialState` es un estado opcional del paso importado; no se interpreta como un contrato de variables. |
| Pila de llamadas | Ausente en ambos contratos actuales. |
| Escena por paso | El reproductor utiliza `sceneSnapshot` validado. Python solo publica el ScenePlan final de una ejecución satisfactoria. |
| Navegación entre archivos | Ya existe resolución segura de referencias y apertura de pestañas. Se conserva; los breakpoints ahora utilizan la ruta relativa completa. |
| Errores de ejecución | Python publica diagnósticos auténticos con archivo/línea/columna. Se muestran y pueden abrirse desde el panel del depurador, sin simular una pausa. |

Componentes principales: `useSpatialDebugger`, `DebuggerControls`, `SpatialDebuggerView`, `ConsolePanel`, `CodeEditor`, `useEditorState`, `useCompiler`, `App` y `services/editor/debugStepNavigation.ts`. `MockCompilerService` genera datos de demostración; los artefactos `.lumic` pueden incluir pasos guardados. Ninguno demuestra trazas reales de Python.

`services/protocol/models.py` declara `debugTrace: Literal[False]` y las operaciones `analyze`/`execute`. `adapters.py` emite esas capacidades. El IPC y preload de Electron exponen analizar, ejecutar y consultar disponibilidad. La terminación del worker por timeout/cierre es infraestructura, no un control de depuración. `adaptBackendResult` devuelve `debugSteps: []` para Python; no se cambió esa decisión ni se relajó el validador.

## Evidencia real de Python

Se ejecutó el worker NDJSON de la base propia sin modificarlo. `debugCapabilities.real.json` conserva procedencia, fuentes y diez respuestas, decodificadas explícitamente como UTF-8:

- Proyecto de dos archivos con función y asignación: analizar/ejecutar completados; salida explícita `1`, `2`. Esa salida no equivale a inspección de variables ni a una pila de llamadas.
- División entre cero: análisis completado, ejecución fallida y `RUN_DIVISION_BY_ZERO` en `principal.lumi`, línea 1, columna 42.
- Casa histórica: análisis incompleto por la limitación espacial conocida; ejecución completada con dos habitaciones y ScenePlan final. Sin pasos de ejecución.
- Solicitudes `debug`, `step`, `continue`, `cancel`: todas devuelven `UNKNOWN_OPERATION`.

Las seis respuestas de análisis/ejecución declaran `debugTrace: false` y `cancellation: false`; no contienen pasos, variables ni pila. Las respuestas de operaciones no admitidas son errores reales del protocolo, no códigos inventados por el frontend. stderr del worker quedó vacío.

Para reproducir: cargar las fuentes de cada caso, enviar solicitudes `protocolVersion: "1.0.0"`, `entryFile: "principal.lumi"`, operaciones analizar/ejecutar a `.venv/Scripts/python.exe -m services.worker`, y comparar respuestas. Utilizar identificadores de solicitud distintos en una misma sesión y leer stdout como UTF-8. Para el caso `scene`, las fuentes proceden de la captura histórica de L038 ya versionada.

## Cambios implementados

- Al iniciar analizar/ejecutar se retiran pasos, consola y escena anteriores. Se evita que un temporizador de reproducción siga publicando snapshots durante la nueva operación.
- Editar el contexto invalida las respuestas pendientes y detiene el replay obsoleto. Cambiar de proyecto limpia estado, selección, navegación y breakpoints; también invalida solicitudes aunque cambie solamente `scopeKey`.
- Los breakpoints del editor usan la ruta relativa del proyecto, evitando confundir archivos con el mismo nombre en carpetas distintas. Se conserva la resolución segura de navegación existente.
- Avanzar o retroceder manualmente pausa el temporizador. Los controles vacíos conservan estado inactivo; la velocidad también queda deshabilitada sin pasos.
- El panel Python informa del resultado auténtico, de la ausencia de trazas/variables/pila y de si el visor contiene una escena final. Permite navegar a diagnósticos de ejecución con su referencia original.
- En pasos importados, se puede desplegar `spatialState` tal como fue registrado. No se construye una tabla de variables inferida ni se agrega estado ausente.

La actualización incremental del visor no se modifica: selección y resaltado siguen pasando por el gestor existente. La limpieza de escena ocurre al iniciar otra operación de compilación/ejecución, no al seleccionar una entidad.

## Pruebas y límites

`pythonDebuggerBoundary.test.tsx` reproduce respuestas reales mediante el adaptador y los hooks de producción: validación de capacidades, operaciones no admitidas, controles deshabilitados, output auténtico, diagnóstico navegable, ScenePlan final y limpieza al sustituir replay importado por ejecución real. El puente en Vitest reproduce capturas; el worker real se ejecutó por separado. No se presenta esta prueba como un depurador Python paso a paso.

`debuggerLifecycle.test.tsx` verifica breakpoints locales, cambio de archivo/proyecto, selección, pausa manual, reinicio vacío, invalidación por edición y respuesta tardía. `importedDebuggerState.test.tsx` usa fixtures identificados como importados para comprobar estado cambiante, navegación, snapshots, breakpoints y continuación local. Las pruebas existentes de navegación App, recuperación, `.lumic` y recursos/selección incremental se conservan.

Resultados de validación:

- Suite completa: **1.017 pruebas aprobadas en 78 archivos**, `npm run test:run -- --cache=false --maxWorkers=4`.
- Doce pruebas nuevas de esta fase. La prueba de frontera Python también se repitió tras comprobar la decodificación UTF-8 de los mensajes del worker.
- `npm run lint`: aprobado; ejecuta TypeScript de producción y de pruebas. No hay un comando ESLint independiente en el paquete.
- `npm run build`: aprobado. JS 1.115,19 kB, gzip 290,69 kB. Permanece el aviso conocido del chunk superior a 500 kB.
- `git diff --check`, revisión de espacios/UTF-8 de archivos nuevos y comparación de hashes de `.vite/` contra HEAD: aprobados.

Las pruebas del renderer simulan el puente para reproducir capturas y algunas simulan WebGL; no se presentan como ejecución interactiva de Python ni como pruebas gráficas nuevas. La comprobación viva del backend consistió en las diez solicitudes NDJSON descritas arriba. Continúa el aviso conocido de canvas no implementado en jsdom, sin fallos de pruebas. No se midieron FPS ni se agregaron afirmaciones de rendimiento.

## Archivos

Modificados bajo `apps/desktop/renderer/src/`:

- `App.tsx`
- `components/ConsolePanel.tsx`
- `components/console/DebuggerControls.tsx`
- `components/console/SpatialDebuggerView.tsx`
- `hooks/useCompiler.ts`
- `hooks/useEditorState.ts`
- `hooks/useSpatialDebugger.ts`

Nuevos:

- `apps/desktop/renderer/src/components/console/PythonDebuggerStatus.tsx`
- `apps/desktop/renderer/src/tests/fixtures/python/debugCapabilities.real.json`
- `apps/desktop/renderer/src/tests/hooks/debuggerLifecycle.test.tsx`
- `apps/desktop/renderer/src/tests/integration/importedDebuggerState.test.tsx`
- `apps/desktop/renderer/src/tests/integration/pythonDebuggerBoundary.test.tsx`
- Este informe.

## Contratos pendientes del equipo

Para depuración real se necesita acordar y producir una sesión con operaciones de pausa, avance, continuación y cierre/cancelación; aceptación de breakpoints por archivo/línea; eventos ordenados con referencia fuente; estado de variables y ámbitos; pila de llamadas; snapshots o cambios de escena por evento; y comportamiento ante errores o desconexión. No se definieron campos ni códigos definitivos en esta fase.

Hasta que el productor y el protocolo ofrezcan esas capacidades no se puede pausar en breakpoints Python, recorrer pasos reales ni inspeccionar variables/pila. El resultado final y los diagnósticos disponibles sí se conectan al IDE. La invalidación local no garantiza que una solicitud siga sin consumir CPU; el worker conserva sus límites y timeout existentes.

Estado de entrega: cambios locales pendientes de revisión, sin commit, merge ni push. La documentación y las capturas describen la base auditada; no afirman el estado de ramas remotas que no se actualizaron en esta fase.
