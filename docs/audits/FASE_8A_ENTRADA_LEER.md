# Fase 8A — Entrada de texto con leer

Auditoría: 4 de noviembre de 2026, America/Costa_Rica.

## Base y cierre de Fase 7A

Fase 7A cerrada en `e16a6ae02e5c563aab59f690231932ab8807bda3`, mensaje `feat(ide): improve debugger lifecycle and Python diagnostics`, con sus 13 archivos. Antes del commit pasaron 1.017 pruebas del renderer, TypeScript/lint, build y revisión de Git. `.vite/` conserva su contenido versionado.

## Estado real del lenguaje y backend

El parser admite `leer(expresion)` dentro de una expresión, por ejemplo `texto nombre = leer("Nombre:")>>`. El análisis semántico devuelve tipo texto para `ReadNode`. Una asignación directa a `entero` se rechaza por incompatibilidad de tipos: escribir dígitos en el formulario no establece una conversión numérica implícita.

El intérprete evalúa el mensaje y llama sincrónicamente a `input_provider`, cuyo valor por defecto es `input`. Mediante inyección del host se pueden proporcionar valores desde una cola o función antes de ejecutar, incluidas cadenas vacías. Esa API Python no forma parte del protocolo del IDE.

`ExecutionService` usa por defecto `_unavailable_input`, que lanza `InputUnavailableError`; el dispatcher lo transforma en `INPUT_UNAVAILABLE` de infraestructura. El servicio no espera stdin ni produce un evento de solicitud de entrada. Analizar no consume entradas. El protocolo sigue declarando `interactiveInput: false`, `cancellation: false` y `debugTrace: false`.

El worker usa stdin exclusivamente como mensajes NDJSON y stdout exclusivamente como respuestas JSON UTF-8. Las impresiones accidentales de dependencias se redirigen a stderr. No hay un segundo canal para la entrada del programa Lumi. El supervisor Electron envía únicamente solicitudes analizar/ejecutar y espera una respuesta final correlacionada; no hay eventos intermedios de entrada ni IPC para responderlos. Su timeout puede terminar el proceso, pero no equivale a cancelación interactiva.

`mostrar` acumula salida del intérprete en el resultado; no es un canal de prompts en vivo. Si una ejecución llega a `leer` sin proveedor, el error de infraestructura no contiene la salida parcial anterior ni el mensaje solicitado por `leer`. El frontend no los reconstruye analizando el código.

## Evidencia real

`readCapabilities.real.json` conserva fuentes, procedencia y resultados de dos recorridos explícitamente distintos:

| Caso | ExecutionService con proveedor inyectado | Worker/IPC disponible para el IDE |
| --- | --- | --- |
| Una lectura | Lee `Lumi`, muestra `Lumi` | `INPUT_UNAVAILABLE` |
| Dos lecturas | Prompts `Primero:`/`Segundo:`, muestra `uno`/`dos` | `INPUT_UNAVAILABLE` en la primera lectura |
| Texto vacío | Muestra una cadena vacía | `INPUT_UNAVAILABLE` |
| Asignación de leer a entero | Análisis fallido, ejecución bloqueada, sin llamar al proveedor | Ejecución bloqueada con diagnósticos semánticos |
| Error después de leer | `RUN_DIVISION_BY_ZERO` | `INPUT_UNAVAILABLE` antes de alcanzar la división |
| mostrar antes/después de leer | Salida `Antes`, `despues` | `INPUT_UNAVAILABLE`, sin salida parcial publicada |

El proveedor inyectado es un recurso de prueba del intérprete real; **no demuestra interacción desde Electron**. Las respuestas del worker se obtuvieron en procesos reales y se decodificaron como UTF-8. stderr se inspeccionó para reconocer el fallo de infraestructura, pero no se versionaron tracebacks ni rutas locales.

Sonda de stdin, en un mismo worker: ejecutar un programa con `leer`, enviar literalmente `Lumi` y luego ejecutar `mostrar("Recuperado")`. Devuelve respectivamente `INPUT_UNAVAILABLE`, `MALFORMED_JSON` y ejecución completada con `Recuperado`. Confirma que el texto crudo no alimenta `leer` y que el worker se recupera. Una solicitud con un campo extra de entradas precargadas devuelve `INVALID_REQUEST`; no hay mecanismo público para precargarlas.

Se ejecutaron las pruebas existentes de servicios, dispatcher, worker, parser e intérprete relacionadas: **211 aprobadas**, con `.venv/Scripts/python.exe -m pytest ... -q -p no:cacheprovider`, sin modificar Python ni instalar dependencias.

## Preparación independiente del IDE

`InteractiveInputForm.tsx` es un componente independiente, sin dependencia de un transporte ni del protocolo. No está montado en la consola y no aparece automáticamente por encontrar `leer` en el código o por recibir un error.

El componente recibe del host el mensaje, una identidad local de solicitud y el ámbito de proyecto. Esas props son identidades de interfaz, no campos añadidos al protocolo. Conserva el texto exacto, permite vacío y solo aplica una validación si el host la proporciona. Mantiene estados de espera, envío, error y envío confirmado; este último no significa que la ejecución Python haya finalizado.

Usa un formulario con label, foco inicial, envío mediante Enter, estado anunciado y error accesible. Bloquea envíos duplicados antes de que React renderice y después de confirmarse el envío. Una solicitud o proyecto distinto crea una sesión de formulario limpia; resoluciones tardías de la anterior no alteran la nueva. Un error permite reintentar. La idempotencia entre procesos/reconexiones deberá acordarse en el backend; la protección local no sustituye ese contrato.

La única conexión de producción actual es una explicación adicional para `INPUT_UNAVAILABLE` en `PythonCompilerService`: se conservan el código y mensaje originales y se indica que falta el canal interactivo. No se crea una espera ficticia ni se devuelve una escena alternativa. La consola conserva el manejo de infraestructura y permite una nueva ejecución tras el fallo.

## Contrato mínimo por acordar con Grei

Antes de montar el formulario se necesita acordar:

- Identidad de ejecución y solicitud de lectura, mensaje de prompt y orden de lecturas.
- Evento o mecanismo para publicar una lectura pendiente mientras la ejecución sigue abierta; la respuesta final actual no basta.
- Canal validado de respuesta que acepte texto vacío sin confundirlo con ausencia de respuesta.
- Confirmación e idempotencia de respuestas; comportamiento ante reintentos, duplicados, respuestas tardías y desconexión.
- Reglas de cancelación, cambio de proyecto y expiración de una espera; tratamiento del timeout general mientras se solicita entrada humana.
- Separación de eventos de entrada, salida del programa y respuestas finales, manteniendo stdin/stdout NDJSON protegido.
- Capacidades declaradas y validaciones Python/TypeScript/IPC coordinadas. Cualquier cambio de versión requiere acuerdo del equipo.

No se proponen nombres de campos ni códigos como contrato definitivo, ni se añadieron operaciones al protocolo. Una cola de entradas precargadas sería otra capacidad posible, también pendiente de un contrato explícito.

## Archivos y pruebas

Modificado: `apps/desktop/renderer/src/services/integration/PythonCompilerService.ts`.

Nuevos:

- `apps/desktop/renderer/src/components/console/InteractiveInputForm.tsx`
- `apps/desktop/renderer/src/tests/components/console/InteractiveInputForm.test.tsx`
- `apps/desktop/renderer/src/tests/integration/readPythonBoundary.test.tsx`
- `apps/desktop/renderer/src/tests/fixtures/python/readCapabilities.real.json`
- Este informe.

Quince pruebas nuevas: seis del formulario independiente y nueve de respuestas reales. Cubren una/múltiples lecturas, vacío, validación independiente, tipos inválidos en Python, errores, cambio de proyecto, duplicados, mostrar y recuperación. Las pruebas de formulario usan callbacks de prueba y no se presentan como un flujo interactivo de Python. La reproducción TypeScript utiliza respuestas capturadas; el backend real se ejecutó por separado.

Validación de cierre: **1.032 pruebas aprobadas en 80 archivos** del renderer, **211 pruebas Python pertinentes** aprobadas, TypeScript/lint y build aprobados, `git diff --check` y revisión UTF-8/espacios de archivos nuevos aprobados. Build JS 1.115,32 kB, gzip 290,73 kB; permanece el aviso conocido del chunk superior a 500 kB. La caché `.vite/` coincide con HEAD. No se modificaron Python, parser, AST, `.lumic`, protocolos ni dependencias.

## Alcance de integración Git

La indicación final de cierre autoriza un commit de esta preparación y las integraciones locales en `develop` y `main` una vez validadas. No se cambia el protocolo ni se declara implementado el flujo interactivo completo. No se realiza push. El historial local de `develop` ya contiene las fases previas y L038; `main` es ancestro de ese historial. La integración conservará esos commits.
