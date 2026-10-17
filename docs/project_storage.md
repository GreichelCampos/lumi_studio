# Proyectos y almacenamiento de Estudio Lumi

## Uso en Electron

Desde `apps/desktop`, con las dependencias existentes instaladas:

```powershell
npm.cmd run dev
```

- **Nuevo proyecto:** elige una carpeta contenedora. Se crea una subcarpeta con el nombre indicado y un `principal.lumi` mínimo, marcado como principal.
- **Abrir proyecto:** Archivo → Abrir proyecto → Abrir carpeta del disco. Se descubren archivos `.lumi`, incluidas subcarpetas, sin interpretar imports en TypeScript.
- **Archivo principal:** se elige en las opciones del archivo en el explorador. Compilar y Ejecutar usan ese archivo y los contenidos actuales del editor, aunque otra pestaña esté activa.
- **Guardar / Guardar todos:** escriben fuentes reales. Un error conserva los borradores y muestra un aviso. Los cambios realizados mientras se guarda siguen pendientes.
- **Guardar archivo como:** crea una copia con un nombre nuevo dentro del proyecto y abre su pestaña. Conserva el original, su borrador y la selección del principal. No sobrescribe un archivo existente ni permite exportar fuera de la carpeta.
- **Renombrar archivo:** conserva su ID, pestañas, selección y contenido. Los imports no se modifican: el diálogo advierte que deben ajustarse manualmente.
- **Renombrar proyecto:** Archivo → Renombrar proyecto. Cambia el nombre de la carpeta, conservando las rutas relativas y los IDs.
- **Eliminar:** los archivos y proyectos se mueven a la papelera del sistema después de confirmar. La eliminación de un proyecto incluye todos sus contenidos. Los borradores descartados no forman parte de la copia guardada en la papelera.
- **Pestañas:** muestran cambios pendientes. Al cerrar una pestaña modificada se puede cancelar, guardar o descartar. Cambiar de proyecto conserva sus borradores en memoria. Cerrar la aplicación con borradores exige confirmar el descarte; cancelar mantiene Python disponible.
- **Diagnósticos:** el botón «Ir al código» o el doble clic abre la ruta relativa exacta y posiciona el cursor en la línea y columna indicadas. No se elige arbitrariamente entre archivos con el mismo nombre en distintas carpetas.

El navegador conserva su almacenamiento anterior en `localStorage` y el modo de demostración explícito. Electron usa almacenamiento de disco sin fallback al navegador. Los proyectos locales anteriores aparecen en Abrir proyecto con una opción para **guardar una copia en disco**, sin borrar ni modificar el original de `localStorage`.

## Persistencia y portabilidad

El proyecto es una carpeta de fuentes; no se añade ningún manifiesto. Electron guarda `workspaces.json` en `app.getPath('userData')`, con versión de metadatos `1`:

| Dato | Persistencia |
| --- | --- |
| Carpeta registrada | Ruta absoluta local, autorizada mediante el diálogo nativo; sirve para localizarla en esta computadora. |
| Proyecto | UUID local, descripción y fecha de creación. |
| Archivos | Mapa de **ruta relativa → ID**; el ID se conserva al renombrar desde el IDE. |
| Principal | `entryPath`, relativa a la carpeta, opcional si todavía no se seleccionó. |
| Editor | `activePath` y `tabPaths`, relativos; se admite cerrar todas las pestañas. |
| Último proyecto | ID local de la última selección. |

Los modelos públicos `LumiProject` y `LumiFile` conservan sus nombres. El adaptador mantiene las rutas del IDE con el prefijo del proyecto y las convierte a rutas relativas para disco. La comunicación Python continúa usando las claves relativas existentes de `projectInput`; no se cambia su protocolo ni sus reglas de imports.

Los metadatos **no son portables**: copiar la carpeta a otra computadora no traslada IDs, pestañas ni principal. Allí hay que abrir la carpeta y volver a seleccionar el principal; no se infiere por el nombre `principal.lumi`. Los borradores viven en memoria y no son recuperación frente a una caída del proceso o del sistema. Un renombrado externo o una carpeta movida fuera del IDE puede requerir reabrirla y volver a establecer sus referencias locales.

## Arquitectura y seguridad

| Módulo | Función |
| --- | --- |
| `electron/workspaces/WorkspaceService.ts` | Operaciones de proyecto y persistencia. Recibe modelos/rutas autorizadas y devuelve proyectos o errores. Pruebas con directorios temporales reales. |
| `safeFiles.ts`, `projectValidation.ts`, `workspaceMetadata.ts` | Validación de nombres y rutas, límites, escritura y metadatos versionados. No interpretan Lumi. |
| `electron/workspaceIpc.ts` y `electron/preload.ts` | Fachada limitada al renderer autorizado y su frame principal. Diálogos nativos, papelera y confirmación de cierre. No exponen Node ni una API genérica de lectura/escritura. |
| `DesktopProjectStorage.ts` | Adaptador del `ProjectStorage` existente al IPC; propaga errores sin recurrir a `localStorage`. |
| `ProjectSession.ts` y `useProjectManager.ts` | Estado de proyectos, cola de operaciones, pestañas y borradores por proyecto. Confirman escrituras antes de marcar contenidos como guardados. Pruebas con promesas controladas para fallos y carreras. |
| `sourceNavigation.ts` | Resuelve referencias exactas y convierte columnas Python, desde 1 y por puntos de código, a posiciones UTF-16 del textarea. |

Se rechazan rutas absolutas de fuentes, `..`, segmentos vacíos, nombres reservados de Windows, flujos alternativos, IDs/referencias inválidos y enlaces simbólicos/junctions. Las carpetas raíz del sistema y los ancestros de los datos o de la aplicación no se aceptan como proyectos. La cola de main serializa operaciones; al salir se espera su finalización antes de cerrar Python.

Límites de disco: 128 fuentes, 256 KiB por fuente y exploración acotada a 2048 directorios y profundidad 32. El límite agregado del protocolo Python sigue aplicándose por separado. Se conservan los finales de línea de las fuentes que no se editan.

Las escrituras de contenido y metadatos usan temporales y reemplazo de archivo. **Guardar todos no es una transacción de varios archivos**: si una escritura posterior falla, las anteriores pueden haber terminado. El IDE conserva los borradores y muestra el error; reabrir la carpeta permite reconciliar el disco. Antes de reemplazar, renombrar o eliminar una fuente se comprueba que no cambió externamente. No hay sincronización automática con otros editores ni garantía frente a modificaciones concurrentes del sistema de archivos entre comprobación y operación.

El renombrado de fuentes utiliza creación exclusiva de un enlace duro y retirada del nombre anterior para evitar sobrescribir un destino existente. Requiere un sistema de archivos que admita enlaces duros, como NTFS; en otros sistemas se informa el error sin reemplazar el destino. Los cambios únicamente de mayúsculas/minúsculas que Windows resuelve como el mismo destino se rechazan. No se ofrece una transacción completa ante fallos de disco o de permisos durante una operación compuesta.

## Validación

Desde `apps/desktop/renderer`:

```powershell
npm.cmd run test:run -- --maxWorkers=2
```

Desde `apps/desktop`:

```powershell
npm.cmd test -- --pool=threads --maxWorkers=1
npm.cmd run lint
npm.cmd run build
npm.cmd run test:integration
npm.cmd run test:window
npm.cmd run test:workspace
```

Desde la raíz:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

Las pruebas de escritorio usan un perfil `userData` y carpetas temporales propios.
`test:workspace` automatiza las respuestas de los diálogos y ejercita IPC, renderer,
operaciones de disco, papelera y Python. Las pruebas unitarias de sesión e IPC
utilizan dobles controlados para reproducir errores y condiciones de carrera.
