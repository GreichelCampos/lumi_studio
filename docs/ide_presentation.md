# Presentación técnica y recorrido de Estudio Lumi

## Diapositiva 1 — Arquitectura del IDE

- Electron aloja React y TypeScript; Three.js representa escenas en el frontend.
- Preload expone una API limitada; main administra disco y proceso Python.
- Python reutiliza lexer, parser, análisis semántico e intérprete existentes.
- Los mensajes JSON locales separan resultados del lenguaje y errores de infraestructura.

Apoyo visual: diagrama de la [arquitectura actual](architecture.md#componentes-y-límites).
Guion oral: «La interfaz conserva los componentes web, pero las operaciones de
escritorio pasan por un puente restringido. El lenguaje se procesa en Python;
TypeScript adapta y valida datos, sin implementar otro compilador».

## Diapositiva 2 — Fuentes, resultados y escenas

- Los proyectos son carpetas reales; el principal y las pestañas tienen metadatos locales.
- Compilar analiza; Ejecutar produce salida y diagnósticos mediante Python real.
- `.lumic` es un contenedor separado del AST y del protocolo del worker.
- El visor consume artefactos validados; la generación espacial Python sigue pendiente.
- Los pasos importados se reproducen con snapshots; no son depuración Python en vivo.

Apoyo visual: capturas auténticas de consola y de un `.lumic`, con el fixture
identificado. Guion oral: «Podemos demostrar ejecución real y visualización real,
pero son recorridos distintos. No presentamos una escena importada como producto
de compilar el texto del editor».

## Diapositiva 3 — Distribución y límites

- Instalador NSIS por usuario para Windows x64.
- Incluye CPython fijado y verificado por SHA-256; no necesita Python externo.
- Recursos del IDE locales, proyectos fuera de la instalación y metadatos conservados.
- Pruebas automatizadas del ejecutable instalado y su desinstalación; falta validar
  instalación interactiva en un Windows limpio.
- Sin firma de editor de confianza ni actualizaciones automáticas configuradas.

Apoyo visual: captura del IDE instalado y ubicación del proyecto, sin rutas privadas.
Guion oral: «El paquete incluye el runtime necesario para el worker actual.
Conservar proyectos forma parte de la configuración y de las pruebas, pero no
sustituye una copia de seguridad ni una validación en otros equipos».

## Preparación de la demostración

Utiliza una cuenta de prueba en Windows x64 y un paquete generado según la
[guía de empaquetado](windows_packaging.md). Prepara una carpeta externa a la
instalación, sin archivos personales. Ten disponibles `valid-basic.lumic` y
`valid-debug.lumic` de los [ejemplos del contrato](contracts/lumic/v1.0.0/README.md#ejemplos-y-comprobación).
No sustituyas fallos del backend por el frontend de demostración del navegador.

## Recorrido propuesto: 7–9 minutos

| Tiempo aproximado | Acción y explicación |
|---|---|
| 0–1 min | Abre el IDE instalado y señala el modo Python real, explorador, editor, consola y visor. |
| 1–2 min | Crea un proyecto en una carpeta propia. Muestra `principal.lumi`, agrega otra fuente y explica que la pestaña activa no cambia el principal. Guarda. |
| 2–3 min | Usa `principal { mostrar("Hola, Lumi")>> }`. Compila para analizar y después ejecuta para mostrar salida Python real. |
| 3–4 min | Ejecuta `principal { mostrar(4 / 0)>> }`. Muestra `RUN_DIVISION_BY_ZERO` y navega al código. Restaura el ejemplo válido y guarda. |
| 4–5 min | Explica que una habitación aún produce análisis incompleto y no genera escena; no presentes el visor importado como resultado de ese código. |
| 5–6 min | Importa `valid-basic.lumic`. Identifícalo como fixture, selecciona un objeto, orbita, ajusta zoom y restablece cámara. |
| 6–7 min | Importa `valid-debug.lumic`. Reproduce y cambia pasos. Explica los snapshots y la ausencia de conexión de depuración con Python. No prometas navegación si no están las fuentes coincidentes. |
| 7–9 min | Guarda, cierra y reabre el proyecto. Explica runtime incluido, instalación por usuario y límites. La desinstalación puede mostrarse aparte con un proyecto de prueba respaldado. |

Si una operación falla, muestra el error y describe el límite en lugar de cambiar
a datos simulados sin indicarlo. No elimines ni desinstales una instalación de
trabajo para realizar la demostración. Las capturas pendientes y sus pies están
en el [manual de usuario](user_manual.md#capturas-auténticas-por-incorporar).

## Explicación técnica oral

«Estudio Lumi separa la interfaz del lenguaje. React organiza los componentes y
TypeScript expresa sus datos; Three.js construye el visor. Electron aporta la
ventana y el acceso local mediante main y una API limitada en preload. El renderer
no tiene Node.js. Las operaciones de archivos pasan por validaciones y una cola.

»El worker Python recibe JSON por stdin y responde por stdout. Sus fachadas usan
el lexer, parser, análisis e intérprete existentes. Compilar solicita análisis;
Ejecutar solicita ejecución y devuelve salida o diagnósticos. El archivo principal
es una selección del proyecto, independiente de la pestaña activa.

»La integración espacial tiene otro límite. El visor carga `.lumic` validados,
pero el protocolo actual no devuelve ScenePlan. Tampoco produce trazas Python:
los controles reproducen eventos importados. Por eso mostramos ejecución real y
visualización de un artefacto por separado. El paquete Windows incluye Python
para que el usuario no tenga que instalarlo. Las pruebas automatizadas locales
pasaron; la validación manual en un equipo limpio sigue pendiente».

## Preguntas técnicas y respuestas

| Pregunta | Respuesta sustentada en el código |
|---|---|
| ¿Por qué Electron y React? | Permiten reutilizar los componentes del IDE web y añadir procesos, disco y distribución mediante main/preload. La separación actual está en [main.ts](../apps/desktop/electron/main.ts) y [preload.ts](../apps/desktop/electron/preload.ts). No implica una comparación experimental de rendimiento con otros frameworks. |
| ¿TypeScript garantiza que Python envía datos válidos? | No. Sus tipos no validan JSON en ejecución. El [validador de respuestas](../apps/desktop/renderer/src/services/integration/protocol/responseValidator.ts) comprueba datos externos antes de adaptarlos. |
| ¿Por qué no evaluar Lumi en JavaScript? | Duplicaría reglas y podría producir resultados distintos del núcleo. [CompilerService](../services/compiler_service.py) y [ExecutionService](../services/execution_service.py) llaman a la implementación Python existente. |
| ¿La comunicación usa una API web? | No: un proceso local supervisado intercambia líneas JSON UTF-8 por stdin/stdout. Los registros van a stderr. [PythonWorker](../apps/desktop/electron/pythonWorker.ts) administra solicitudes y cierre. |
| ¿Qué impide leer cualquier archivo desde React? | El renderer carece de Node; preload ofrece operaciones concretas. Main valida origen, argumentos y rutas. [workspaceIpc.ts](../apps/desktop/electron/workspaceIpc.ts) y [safeFiles.ts](../apps/desktop/electron/workspaces/safeFiles.ts) implementan esa frontera. No es un sandbox completo del núcleo Python. |
| ¿Se ejecuta la pestaña activa? | Se envían el principal explícito y el mapa de fuentes del proyecto. Los borradores participan en la solicitud. Véase [projectInput.ts](../apps/desktop/renderer/src/services/integration/projectInput.ts). |
| ¿Guardar es una transacción? | Cada reemplazo usa un temporal; Guardar todos no es una transacción global. Se conserva progreso parcial y el borrador ante fallo. Los reintentos Windows son limitados y no ignoran cambios externos. Véase [almacenamiento](project_storage.md). |
| ¿Un error de Python siempre es un error del alumno? | No. El [protocolo](../services/protocol/models.py) separa resultados del programa de errores de infraestructura. No se inventan severidades ni ubicaciones ausentes. |
| ¿El AST es el `.lumic`? | No. AST, ScenePlan interno, DTO del visor y contenedor persistente cumplen funciones distintas. El [contrato candidato](contracts/lumic/v1.0.0/README.md) requiere todavía validación de interoperabilidad. |
| ¿La habitación visible salió de ese código? | Solo se puede afirmar si existe evidencia del recorrido completo con un productor real. En esta versión se muestra un fixture importado y se señala su procedencia; [resultAdapter.ts](../apps/desktop/renderer/src/services/integration/resultAdapter.ts) devuelve escena nula para Python. |
| ¿Pausar el depurador pausa Python? | No. [useSpatialDebugger](../apps/desktop/renderer/src/hooks/useSpatialDebugger.ts) reproduce una secuencia ya disponible. Los puntos locales no controlan el intérprete. |
| ¿Cómo se libera la GPU? | El gestor desmonta escena y recursos mediante [ThreeResourceDisposer](../apps/desktop/renderer/src/components/viewport/resources/ThreeResourceDisposer.ts); también se liberan controles y renderer. Un canvas visible no prueba por sí solo ausencia de fugas. |
| ¿Cómo maneja la cámara las dimensiones? | Es ortográfica, usa OrbitControls y ajusta el encuadre a habitación y aspecto del contenedor. Véase [CameraController](../apps/desktop/renderer/src/components/viewport/camera/CameraController.ts). |
| ¿Necesita Python instalado? | Desarrollo sí necesita un runtime accesible; el paquete incluye CPython fijado/verificado y los módulos del worker. No incluye indiscriminadamente todo requirements.txt. Véase [empaquetado](windows_packaging.md). |
| ¿Está lista la distribución general? | Se generó y probó un NSIS por usuario, pero faltan validación manual en Windows limpio y firma de confianza. No hay actualización automática configurada. |

## Tres ejercicios de lectura y diseño

Estos ejercicios preparan una modificación explicable; no indican que se haya
realizado ni autorizan cambios sobre la versión de demostración.

1. **Cámara:** localizar `zoomCamera` y sus límites en `CameraController.ts`.
   Explicar cómo se cambiaría el máximo sin alterar geometría o contratos, qué
   controles lo usan y qué prueba verificaría el límite y valores no finitos.
2. **Persistencia:** recorrer `ProjectSession.save` → IPC → `WorkspaceService` →
   `atomicWrite`. Explicar qué ocurre si el segundo archivo falla, qué borrador
   queda y cómo probar una edición nueva mientras el primer guardado está en vuelo.
3. **Reproducción:** seguir `handleDebugStepChange` y `resolveDebugStep`. Explicar
   por qué un paso sin snapshot o con ruta externa limpia el estado en vez de
   conservar el resaltado anterior. Identificar la prueba multiarchivo y la
   diferencia respecto a instrumentar el intérprete.

Si se requiere un cambio durante una evaluación, ensayarlo previamente en una
copia de trabajo aislada y autorizada, con sus pruebas; no improvisarlo en el
ejecutable o proyecto de demostración. La práctica efectiva debe verificarse aparte.

## Recuperación durante el recorrido

| Fallo | Respuesta prevista |
|---|---|
| No inicia la aplicación o falta el runtime | Mostrar el mensaje y registrar el fallo. Utilizar solo un paquete de respaldo previamente probado en el equipo de prueba. No instalar encima de una versión personal durante la defensa. |
| Falla el análisis o la ejecución | Conservar el diagnóstico y utilizar el ejemplo mínimo verificado. No presentar un fixture como resultado alternativo de compilación. |
| Falla WebGL | Revisar el mensaje y pasar a una captura o grabación auténtica identificada como evidencia anterior, si está disponible; no afirmar que se acaba de renderizar. |
| Falla Guardar | Mantener abierto el borrador, copiar su contenido a un respaldo propio y resolver el bloqueo. No descartar, borrar el destino ni forzar permisos. |
| No hay fuentes de un paso importado | Mostrar el snapshot y explicar que la navegación exige referencias coincidentes con archivos del proyecto. |
| Se agota el tiempo | Priorizar proyecto, salida Python y diagnóstico; explicar el visor importado y los límites sin simular integración real. |

Preparar una copia sin editar del proyecto de demostración fuera de la instalación,
los dos `.lumic` y una copia del instalador con hash registrado. Tras copiar, abrir
el proyecto de respaldo y volver a elegir el principal si es necesario. Las
capturas o grabaciones de reserva no se consideran disponibles hasta generarlas
y comprobarlas. Las instrucciones de usuario y límites permanecen en el
[manual](user_manual.md) y la [guía Windows](installation_windows.md).
