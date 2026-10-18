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
