# Proyectos y flujo multiarchivo de Estudio Lumi

Implementación de L-015 y L-024 en `feature/lumi-ide-integration`.

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

## Responsabilidades y seguridad

| Módulo | Responsabilidad y comprobación independiente |
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

## Evidencia por criterio

| Responsabilidad / criterio | Antes | Implementación | Evidencia |
| --- | --- | --- | --- |
| L-015: crear proyecto y elegir ubicación | Ubicación simulada y `localStorage`. | Diálogo nativo, carpeta y fuente reales. | `workspaces.test.ts`; `test:workspace`, creación desde la interfaz y lectura con Node. |
| L-015: abrir carpetas y fuentes | Lista de proyectos locales. | Selector de carpeta, descubrimiento de fuentes y subcarpetas. | Prueba de carpeta existente anidada; apertura de proyecto externo en Electron. |
| L-015: crear, editar y guardar archivos | Contenidos de navegador. | Escritura real mediante almacenamiento IPC. | Pruebas de disco, renderer y guardado por Ctrl+S en Electron. |
| L-015: guardar como | Sin operación de disco. | Copia nueva dentro del proyecto; original conservado. | Prueba de copia, rechazo de sobrescritura/ruta externa y flujo Electron. |
| L-015: renombrar archivos y proyectos | Renombrado de archivos en memoria; ruta podía perder la subcarpeta. | Renombrado físico, IDs conservados y rutas coherentes. | Lectura del contenido tras ambos renombrados; comprobación de IDs/principal; prueba de ruta anidada. |
| L-015: eliminar con confirmación | Eliminación del modelo local. | Confirmación y papelera del sistema. | Unidad: cancelación/error de papelera; Electron: eliminación nativa de archivo y proyecto temporales. |
| L-015: activo y cambios pendientes | Estado local; fallos podían marcar como guardado prematuramente. | Estado confirmado y borradores por proyecto; fallos visibles. | `ProjectSession.test.ts`, cambios durante el guardado y denegación. |
| L-015: recuperar tras cerrar | Persistencia del navegador. | Fuentes de disco y metadatos `userData`. | Nueva instancia del servicio y relanzamiento real de Electron. |
| L-015: permisos y confinamiento | Sin frontera de archivos de escritorio. | IPC restringido y validaciones de rutas/enlaces. | Archivo de solo lectura real en Windows, junction hacia otra carpeta, traversal y origen IPC no autorizado. |
| L-024: pestañas, cambios y cierre | Pestañas existentes; cierre/guardado asíncrono podía perder cambios. | Cierre espera persistencia, conserva nuevos cambios y admite cancelar/descartar. | Sesión, modal y flujo Electron; Ctrl+S con foco conservado. |
| L-024: elegir/persistir principal | Propiedades locales existentes. | Principal persistido por ruta relativa, independiente del activo. | Metadatos reabiertos; selección desde explorador y relanzamiento. |
| L-024: compilar/ejecutar principal | Python ya usaba `projectInput`; había dos manejadores de F5/F6. | Se conserva el adaptador y queda un solo manejador global de compilación/ejecución. | Python real ejecuta el principal que importa otro módulo mientras ese módulo está activo; prueba de F5 y regresión Python. |
| L-024: navegación a errores | Resolución ambigua por nombre; resaltado de línea sin columna. | Ruta exacta, línea y columna; indicadores por archivo activo. | Pruebas de rutas duplicadas, Unicode y CRLF; diagnóstico Python en el segundo archivo y selección real del cursor. |
| L-024: renombrar/eliminar y referencias | Riesgo de rutas/pestañas inconsistentes. | Conserva IDs; actualiza pestañas y referencias. Si se elimina el principal, se conserva la política existente de seleccionar otro disponible. | Pruebas de sesión, metadatos, renombrado y eliminación en Electron. |
| L-024: cambios rápidos de proyecto | Se vaciaban los borradores. | Cola de operaciones y borradores separados por proyecto. | Pruebas con IDs compartidos, guardado en vuelo y cambios rápidos; cambio de proyecto real con borrador conservado. |
| Compatibilidad | Proyectos guardados en `localStorage`. | Navegador conservado y copia explícita a disco en Electron. | Pruebas existentes de almacenamiento local, adaptador e importación a fuentes reales. |

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

Las pruebas de escritorio usan un perfil `userData` y carpetas temporales propios. En `test:workspace` solo se automatizan las elecciones y respuestas de los diálogos; IPC, renderer, operaciones de disco, papelera y Python son reales. Los tests de sesión y de IPC sí usan dobles controlados donde corresponde. La denegación de papelera simulada se distingue de la prueba real de archivo de solo lectura de Windows.

Revisión manual pendiente: apariencia y selección con los diálogos nativos sin automatizar, carpetas con ACL específicas, unidades de red/extraíbles, restauración desde la papelera y arrastre/bordes nativos de la ventana. Las advertencias previas de canvas en jsdom y del tamaño del bundle no impiden estas validaciones.

Resultados del cierre: **689 pruebas del renderer**, **50 pruebas de Electron** y **442 pruebas Python** exitosas. TypeScript, build y los tres recorridos reales (`test:integration`, `test:window`, `test:workspace`) también pasan.

**Estado funcional: L-015 terminada y L-024 terminada** para el flujo descrito sobre Windows/NTFS, con las limitaciones anteriores y la aceptación visual/manual pendiente. No hay decisiones de formato o imports pendientes para estas dos responsabilidades: se aplicaron las opciones autorizadas de carpetas reales, metadatos locales y ajuste manual de imports. ScenePlan, trazas reales y aprobación del contrato `.lumic` con Gaby y Grei continúan fuera de este cierre; no se implementaron ni cambiaron aquí.

## Archivos de esta entrega

- Modificado: [apps/desktop/electron/main.ts](../apps/desktop/electron/main.ts).
- Modificado: [apps/desktop/electron/preload.ts](../apps/desktop/electron/preload.ts).
- Creado: [apps/desktop/electron/workspaceIpc.ts](../apps/desktop/electron/workspaceIpc.ts).
- Creado: [apps/desktop/electron/workspaces/WorkspaceService.ts](../apps/desktop/electron/workspaces/WorkspaceService.ts).
- Creado: [apps/desktop/electron/workspaces/projectValidation.ts](../apps/desktop/electron/workspaces/projectValidation.ts).
- Creado: [apps/desktop/electron/workspaces/safeFiles.ts](../apps/desktop/electron/workspaces/safeFiles.ts).
- Creado: [apps/desktop/electron/workspaces/workspaceMetadata.ts](../apps/desktop/electron/workspaces/workspaceMetadata.ts).
- Modificado: [apps/desktop/package.json](../apps/desktop/package.json).
- Modificado: [apps/desktop/renderer/src/App.tsx](../apps/desktop/renderer/src/App.tsx).
- Modificado: [apps/desktop/renderer/src/components/CodeEditor.tsx](../apps/desktop/renderer/src/components/CodeEditor.tsx).
- Modificado: [apps/desktop/renderer/src/components/ProjectExplorer.tsx](../apps/desktop/renderer/src/components/ProjectExplorer.tsx).
- Modificado: [apps/desktop/renderer/src/components/TopBar.tsx](../apps/desktop/renderer/src/components/TopBar.tsx).
- Modificado: [apps/desktop/renderer/src/components/modals/ConfirmDeleteModal.tsx](../apps/desktop/renderer/src/components/modals/ConfirmDeleteModal.tsx).
- Modificado: [apps/desktop/renderer/src/components/modals/NewFileModal.tsx](../apps/desktop/renderer/src/components/modals/NewFileModal.tsx).
- Modificado: [apps/desktop/renderer/src/components/modals/NewProjectModal.tsx](../apps/desktop/renderer/src/components/modals/NewProjectModal.tsx).
- Modificado: [apps/desktop/renderer/src/components/modals/OpenProjectModal.tsx](../apps/desktop/renderer/src/components/modals/OpenProjectModal.tsx).
- Modificado: [apps/desktop/renderer/src/components/modals/RenameFileModal.tsx](../apps/desktop/renderer/src/components/modals/RenameFileModal.tsx).
- Creado: [apps/desktop/renderer/src/components/modals/RenameProjectModal.tsx](../apps/desktop/renderer/src/components/modals/RenameProjectModal.tsx).
- Modificado: [apps/desktop/renderer/src/components/modals/UnsavedChangesModal.tsx](../apps/desktop/renderer/src/components/modals/UnsavedChangesModal.tsx).
- Modificado: [apps/desktop/renderer/src/hooks/useEditorState.ts](../apps/desktop/renderer/src/hooks/useEditorState.ts).
- Modificado: [apps/desktop/renderer/src/hooks/useProjectManager.ts](../apps/desktop/renderer/src/hooks/useProjectManager.ts).
- Creado: [apps/desktop/renderer/src/services/editor/sourceNavigation.ts](../apps/desktop/renderer/src/services/editor/sourceNavigation.ts).
- Creado: [apps/desktop/renderer/src/services/project/ProjectSession.ts](../apps/desktop/renderer/src/services/project/ProjectSession.ts).
- Modificado: [apps/desktop/renderer/src/services/project/projectOperations.ts](../apps/desktop/renderer/src/services/project/projectOperations.ts).
- Creado: [apps/desktop/renderer/src/services/storage/DesktopProjectStorage.ts](../apps/desktop/renderer/src/services/storage/DesktopProjectStorage.ts).
- Modificado: [apps/desktop/renderer/src/services/storage/ProjectStorage.ts](../apps/desktop/renderer/src/services/storage/ProjectStorage.ts).
- Creado: [apps/desktop/renderer/src/services/storage/workspaceBridge.ts](../apps/desktop/renderer/src/services/storage/workspaceBridge.ts).
- Modificado: [apps/desktop/renderer/src/tests/components/modals/ConfirmDeleteModal.test.tsx](../apps/desktop/renderer/src/tests/components/modals/ConfirmDeleteModal.test.tsx).
- Modificado: [apps/desktop/renderer/src/tests/components/modals/NewFileModal.test.tsx](../apps/desktop/renderer/src/tests/components/modals/NewFileModal.test.tsx).
- Modificado: [apps/desktop/renderer/src/tests/components/modals/RenameFileModal.test.tsx](../apps/desktop/renderer/src/tests/components/modals/RenameFileModal.test.tsx).
- Modificado: [apps/desktop/renderer/src/tests/components/modals/UnsavedChangesModal.test.tsx](../apps/desktop/renderer/src/tests/components/modals/UnsavedChangesModal.test.tsx).
- Creado: [apps/desktop/renderer/src/tests/services/editor/sourceNavigation.test.ts](../apps/desktop/renderer/src/tests/services/editor/sourceNavigation.test.ts).
- Creado: [apps/desktop/renderer/src/tests/services/project/ProjectSession.test.ts](../apps/desktop/renderer/src/tests/services/project/ProjectSession.test.ts).
- Modificado: [apps/desktop/renderer/src/tests/services/project/projectOperations.test.ts](../apps/desktop/renderer/src/tests/services/project/projectOperations.test.ts).
- Creado: [apps/desktop/renderer/src/tests/services/storage/DesktopProjectStorage.test.ts](../apps/desktop/renderer/src/tests/services/storage/DesktopProjectStorage.test.ts).
- Modificado: [apps/desktop/tests/electron.integration.mjs](../apps/desktop/tests/electron.integration.mjs).
- Creado: [apps/desktop/tests/fixtures/workspace-main.cjs](../apps/desktop/tests/fixtures/workspace-main.cjs).
- Modificado: [apps/desktop/tests/window.integration.mjs](../apps/desktop/tests/window.integration.mjs).
- Creado: [apps/desktop/tests/workspace.integration.mjs](../apps/desktop/tests/workspace.integration.mjs).
- Creado: [apps/desktop/tests/workspaceHarness.mjs](../apps/desktop/tests/workspaceHarness.mjs).
- Creado: [apps/desktop/tests/workspaceIpc.test.ts](../apps/desktop/tests/workspaceIpc.test.ts).
- Creado: [apps/desktop/tests/workspaces.test.ts](../apps/desktop/tests/workspaces.test.ts).
- Modificado: [README.md](../README.md).
- Creado: [docs/project_workspaces.md](../docs/project_workspaces.md).

