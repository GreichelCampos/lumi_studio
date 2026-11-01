# Fase 5B-B2 — implementación arquitectónica del IDE

Fecha: 2026-10-31, America/Costa_Rica. Rama verificada: `feature/architectural-elements-integration`. HEAD inicial: `f3e1d02ff8697bb5d01342d7f8b5a7be6cb2f431`.

## Estado y alcance

Se revisaron las preparaciones 5B-A y 5B-B1. `git fetch origin` no encontró nuevos commits de las compañeras integrados en develop: `origin/develop` sigue en `ec33c31f7b800d1e8be7e612c770e22bbd776ce4`. No se incorporaron ramas ni se modificó Python. La única carpeta local previa sin seguimiento era `apps/desktop/renderer/.vite/`; se compararon sus hashes antes y después de validar.

Se implementaron las tareas independientes del frontend. No se publica un formato de archivo nuevo ni se afirma que Python ya produzca los campos nuevos. La persistencia de extensiones arquitectónicas queda bloqueada de forma explícita hasta acordar el formato y el productor con Grei/Gaby.

## Archivos modificados o nuevos

Los siguientes paths son relativos a `apps/desktop/renderer/`:

| Archivo | Cambio |
| --- | --- |
| src/types/domain/spatial.ts | Extensiones opcionales de paredes y aberturas |
| src/components/viewport/helpers/openingLayout.ts | Elevación explícita y fallback histórico común a mesh y hueco |
| src/components/viewport/helpers/architecturalSelection.ts (nuevo) | Resolución de caras por identidad recibida y pertenencia de entidades a habitaciones |
| src/components/viewport/factories/RoomFactory.ts | Registro de segmentos, resalte de pared y materiales asociados |
| src/components/viewport/factories/OpeningFactory.ts | Apariencia opcional en elementos opacos |
| src/components/viewport/ThreeSceneManager.ts | Registro de todos los segmentos de cada declaración para picking |
| src/components/Viewport3D.tsx | Entidad pared, habitación correspondiente y limpieza de selección |
| src/components/viewport/ObjectPropertiesCard.tsx | Paredes, nombres declarados, apariencia y borde inferior de ventanas |
| src/App.tsx | Resolución de pared seleccionada y resaltado de línea fuente |
| src/services/compiler/contracts/sceneStructure.ts | Validación de campos opcionales e identidades de paredes sin ambigüedad |
| src/services/compiler/contracts/contractValidator.ts | Mismas validaciones en la otra entrada TS y protección de creación/serialización de artefactos |
| src/services/compiler/contracts/architecturalCompatibility.ts (nuevo) | Protección de persistencia, incluida revisión de snapshots de depuración |
| src/services/compiler/contracts/lumicStructure.ts | Rechazo explícito de semántica arquitectónica en archivos históricos |
| src/services/storage/LumicFileService.ts | Mensaje de exportación bloqueada antes de descargar |
| src/tests/contracts/architecturalExtensions.test.ts (nuevo) | Campos nuevos, lectores TS y barrera de importación/exportación |
| src/tests/components/viewport/OpeningVerticalLayout.test.ts | Nuevas pruebas de elevación y apariencia; conserva las pruebas históricas |
| src/tests/components/viewport/ThreeSceneManager.test.tsx | Picking real, resalte, navegación, cambio de habitación y recuperación |
| scripts/architectural-webgl-probe.ts (nuevo) | Sonda WebGL arquitectónica con DTOs de prueba |

También se agrega este informe: `docs/FASE_5B_B2_IMPLEMENTACION_ARQUITECTONICA.md`. Total: 19 archivos de esta fase. Los informes anteriores, sus fixtures históricos y el script de regresión de cámara permanecen sin cambios.

## Contratos TypeScript y comportamiento

- `WallFace`: `id?: string`, `name?: string`, `sourceRef?: SourceReference`. Conserva color obligatorio y material opcional.
- `DoorModel`: `name?: string`, `color?: string`, `material?: string`.
- `WindowModel`: esos mismos campos más `elevation?: number`.
- No se cambian claves north/south/east/west, orientaciones norte/sur/este/oeste, unidades, IDs existentes, posiciones horizontales, dimensiones ni versiones.

### Elevación

`openingVerticalBounds` mantiene el centro histórico de 1,6 m si elevation no existe. Cuando existe, el borde inferior es elevation, el superior elevation + height y el centro elevation + height/2. Cero es un valor explícito válido. Puertas mantienen borde inferior cero y centro height/2.

La misma función se usa al construir aberturas y al recortar paredes. El recorte sigue limitado al tamaño de la pared; el mesh completo y el ScenePlan no se reducen ni desplazan para ocultar datos fuera de límites. Una ventana que excede la altura de la habitación conserva sus medidas; esta fase no convierte esa situación en un diagnóstico semántico nuevo.

Los validadores TS rechazan elevaciones negativas, no numéricas, no finitas y desbordamiento de sus límites verticales. Validan también los tipos de nombre/color/material, identidad de pared no vacía y referencias fuente. Un ID nuevo de pared no puede colisionar con otra cara ni con una entidad existente, incluso entre habitaciones; se conserva el comportamiento histórico de escenas sin identidad arquitectónica. Se reutilizan códigos de validación del IDE, sin inventar códigos del backend.

### Selección y navegación

Los cuatro muros automáticos permanecen. Una cara solo se registra para selección cuando contiene un ID explícito válido. Sus segmentos comparten ese ID y material de resalte; los nombres técnicos de meshes no se convierten en identificadores de declaraciones. No se crean IDs ni referencias persistentes desde el frontend.

El resalte usa el estado emisivo seleccionado del tema, sin cambiar geometría ni sustituir la apariencia base. Al deseleccionar desaparece el resalte. Los recursos de la escena anterior siguen liberándose antes de reconstruir; una cara completamente recortada no crea un material que quedaría sin mesh propietario.

La tarjeta de pared muestra nombre recibido o título por orientación, ID, orientación, dimensiones de la cara derivadas de la habitación y apariencia. El botón de código solo aparece con referencia fuente y callback reales; conserva archivo, línea y columna. App resuelve también paredes para el resaltado de línea. Cambiar de habitación limpia la selección si la entidad no pertenece a la nueva; eliminar la entidad de una escena válida solicita deselección. Se conservan muebles, puertas y ventanas y el filtro de arrastres de OrbitControls.

### Apariencia

| Propiedad | Componentes afectados | Ausencia y componentes preservados |
| --- | --- | --- |
| Puerta color | Marco y hoja; el marco seleccionado conserva el resalte del tema | Marco #e2e8f0 y hoja #f8fafc |
| Puerta material | Rugosidad y metalicidad de marco y hoja según surfaceMaterial | Rugosidad histórica 0,5 / 0,4; manija sin cambios |
| Ventana color | Marco, travesaños y montantes; selección conserva resalte | Blanco histórico; vidrio sin cambio de color |
| Ventana material | Rugosidad y metalicidad de marco/travesaños/montantes | Rugosidad histórica 0,3; vidrio sin cambios ópticos |

El vidrio conserva geometría, color #bae6fd, transmission=0,85, opacity=0,55, roughness=0,1 e ior=1,5. La manija conserva su acabado original. No se reinterpretan perfiles de material opaco como transparencia de vidrio.

## Compatibilidad .lumic: parte detenida de forma segura

Los esquemas publicados 1.0.0/1.1.0 admiten propiedades adicionales, y los lectores antiguos aceptan ampliamente versiones de la familia 1. Por eso una versión menor nueva no garantizaría que un lector antiguo rechazara elevation: podría dibujar una ventana desplazada sin avisar.

Estrategia implementada sin publicar formato:

1. Se conserva la importación/exportación de archivos históricos 1.0.0/1.1.0 que usan los campos publicados. No se migran, reescriben ni eliminan fixtures o esquemas históricos.
2. Los campos nuevos identificados de paredes/aberturas bloquean la importación de un artefacto etiquetado como histórico. La respuesta usa `INCOMPATIBLE_VERSION` del IDE y explica la falta de un formato acordado. Esta regla se aplica incluso a elevation=0 y a metadatos nuevos, evitando una falsa promesa de conservación de semántica entre lectores.
3. La exportación se bloquea antes de descargar. El creador de artefactos devuelve null y el serializador también rechaza estos datos si se invoca directamente. No se borran campos silenciosamente para producir un archivo que parezca compatible.
4. La revisión incluye scenePlan y cada sceneSnapshot de debugSteps. Cambiar manualmente la etiqueta a otra versión 1.x no evita la protección.
5. Los campos adicionales no relacionados con esta extensión conservan la tolerancia histórica. Las propiedades opcionales con valor undefined no añaden semántica persistida: JSON las omite y la protección no las trata como valores definidos.

Esto significa que un archivo antiguo creado externamente con estos campos adicionales, aunque su esquema permisivo antes lo aceptara, será rechazado explícitamente por este IDE. Se evita reinterpretarlo sin garantías. No equivale a soportar persistencia de las nuevas declaraciones; esa parte está detenida.

Siguiente alternativa para aprobar con el equipo: una versión de archivo/capacidad que los lectores antiguos rechacen inequívocamente, junto con DTOs arquitectónicos reales del productor Python, esquemas correspondientes, fixtures cruzados y pruebas de ida y vuelta. No se asigna ni publica un número nuevo en esta fase. Los nuevos campos pueden validarse y visualizarse en el IDE con DTOs de prueba; esto no cambia unilateralmente el protocolo Python, sus versiones o sus diagnósticos.

## Validación y resultados reales

- Suite completa renderer con benchmark optativo: **937 pruebas aprobadas en 71 archivos**, 33,30 segundos. Incluye las 889 anteriores y 48 pruebas adicionales. Comando: `LUMI_VIEWPORT_BENCH=1` y `npm run test:run -- --cache=false --maxWorkers=4`.
- `npm run lint`: correcto; TypeScript de aplicación y pruebas. No se agregaron dependencias ni un linter distinto al ya configurado.
- `npm run build`: correcto, 6,13 segundos. Advertencia de bundle mayor de 500 kB: JS minificado 1.110,59 kB / 289,32 kB gzip.
- `git diff --check` y revisión de espacios finales/UTF-8 en archivos nuevos: correctas.
- Nuevas pruebas de campos: rechazo de elevación inválida, overflow, metadatos incorrectos y colisiones de identidad; mismas reglas en viewport, entrada TS y validación del payload de respuesta. El payload usa fixtures: no demuestra que Python produzca arquitectura.
- Elevación: cuatro orientaciones con elevation 0 / 0,75 / 2 m, borde superior exacto, exceso de altura con recorte solo del hueco, inmutabilidad y comparación de dimensiones antes/después de apariencia.
- Selección: raycast real de todos los segmentos en cuatro orientaciones hacia un único ID, caras automáticas no registradas, resalte/deselección, disposición de material compartido, tarjeta, navegación fuente completa, cambio de habitación, eliminación de entidad y recuperación de una escena con elevación inválida.
- jsdom no implementa captura de puntero; la prueba proporciona setPointerCapture/releasePointerCapture como APIs DOM. Cámara, OrbitControls, matrices y raycast son reales; solo WebGLRenderer y el contexto de textura se simulan en las pruebas unitarias correspondientes. Un primer intento encontró esa carencia del entorno; la ejecución final no tiene errores sin manejar.

### WebGL real

Chrome headless, canvas 800×600, WebGL 2.0 (OpenGL ES 3.0 Chromium), renderer reportado WebKit WebGL. No se identificó GPU física ni se realizó revisión visual interactiva. No se presentan estos resultados como FPS ni como benchmark sostenido.

La nueva sonda completó **12 escenarios**: habitaciones de 0,1 / 5 / 100 m por cuatro orientaciones. Cada cara declarada tenía 16 segmentos; se comprobaron resalte, centro vertical de ventana, hueco por raycast, renderizado y ausencia de mutación. Todos devolvieron glError=0. Centros Y de ventana: 0,035 / 1,75 / 35 m. Geometrías reportadas: 37 para la escala pequeña y 39 para las otras; estables durante las cuatro orientaciones de cada escala. Esto no es un perfil exhaustivo de memoria GPU.

Se repitió también `viewport-webgl-probe.ts` de Fase 6A: tres escalas y nueve enfoques consecutivos, incluido objeto rotado. Máximo |X,Y| proyectado=0,892858 y |Z|=0,939674, glError=0. Primer render + gl.finish: 393,10 / 55,90 / 51,70 ms; incluyen shaders y sincronización y no son FPS sostenidos.

Reproducción: empaquetar los scripts con el esbuild ya instalado (`bundle: true`, `platform: 'browser'`) hacia una carpeta temporal, cargarlos desde un HTML en Chrome `--headless --dump-dom`, y comprobar el JSON del elemento pre. La sonda registra un objeto error si falla una aserción; ese resultado debe tratarse como fallo aunque Chrome cierre con código cero. Los dos managers se liberan en finally. No se usa la caché Vite para las sondas.

## Pendiente de Python, riesgos y entrega

- Grei debe confirmar y producir los DTOs arquitectónicos, identidades, nombres y referencias. El adaptador Python actual y su semántica no se modificaron; no se afirma integración real de extremo a extremo con declaraciones Lumi.
- No se implementa semántica nueva de paredes repetidas, solapes o aberturas fuera de límites ni se inventan diagnósticos Python. Solo se rechazan datos estructuralmente inválidos y selecciones ambiguas del IDE.
- Las paredes siguen siendo las cuatro caras rectangulares deducidas de RoomModel.dimensions. No hay paredes arbitrarias, colisiones ni geometría del lenguaje adicional.
- La persistencia nueva requiere decisión conjunta de formato/versionado y queda bloqueada. El resto de tareas independientes está implementado y validado.
- El foco específico de aberturas/paredes conserva la acción actual de encuadrar la habitación; esta fase no modifica la cámara de Fase 6A.
- La resolución fija de sombras y el costo de reconstrucción completa al seleccionar siguen siendo limitaciones ya documentadas.

Estado de entrega: mismos rama y HEAD, cambios sin staging, sin commits, merge ni push. `.vite/` preexistente queda fuera del trabajo. Los resultados de esta fase se entregan para revisión.
