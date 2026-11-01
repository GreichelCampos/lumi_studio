# Fase 6B — Actualización incremental del visor

## Estado y alcance

Rama: `feature/architectural-elements-integration`.
Fase 5B-B2 guardada en `f519542b2822a8d85cd2f00d9a5e19dda136f1f2`, con exactamente sus 19 archivos y el mensaje `feat(ide): add architectural element rendering and selection`.
La Fase 6B queda sin commit. No se realizó merge ni push.

## Auditoría

`Viewport3D` solicita `renderRoom` al cambiar selección, depuración, habitación y controles visuales. Antes, cada llamada eliminaba el árbol anterior y recreaba paredes segmentadas, suelo, textura, aberturas, muebles y resaltados; también sustituía todos los registros de picking. La selección no necesita esa reconstrucción.

`RoomFactory` comparte el material entre segmentos de una misma cara. `OpeningFactory` cambia el marco y el contorno al seleccionar. `FurnitureFactory` combina selección, depuración y diagnósticos con prioridades distintas para emisión y contorno. La pantalla de una lámpara tiene emisión propia y no debe modificarse como si fuese el cuerpo seleccionado.

`ObjectSelectionController` ya permite conservar los objetos registrados y excluye resaltados mediante `ignorePicking`. `ThreeResourceDisposer` ya deduplica geometrías, materiales y texturas al recorrer un árbol, incluidos elementos invisibles; no requiere cambios. OrbitControls y los efectos React de enfoque se conservan.

## Estrategia

- Una clave interna captura los campos que afectan geometría o apariencia: identidad de habitación, dimensiones, superficies, aberturas, muebles colocados, transformaciones, colores, materiales, tema y controles de dibujo. Detecta ediciones in situ y admite DTO clonados equivalentes. Excluye metadatos, objetos sin colocar, selección y diagnósticos.
- Si la clave coincide, se conservan el árbol, los recursos, el picking y la cámara. Solo se actualizan los callbacks de las entidades previamente activas, las nuevas y las que cambiaron de diagnóstico. Se mantiene la prioridad visual histórica.
- Los callbacks pertenecen al administrador y a su habitación; no hay recursos globales compartidos ni instancing. Cada mueble administrado prepara tres resaltados, inicialmente invisibles cuando corresponda. Las fábricas mantienen su comportamiento anterior cuando se invocan sin registrar callbacks.
- Si cambia contenido visual, se construye un árbol sustituto antes de retirar el anterior. Ante validación inválida o fallo de construcción comprobado, se conserva el último árbol válido y su picking, y se libera el árbol parcial disponible. Una fábrica que falle antes de devolver sus propios recursos sigue siendo responsable de ellos; no se promete recuperación ante cualquier fallo de asignación.
- El cambio de habitación, `clearRoom` y `dispose` eliminan callbacks y liberan recursos. Los límites y dimensiones usados para decidir el encuadre se guardan como copias, evitando alias con DTO modificados in situ.
- No se alteran ScenePlan, `.lumic`, Python, parser, AST, posiciones ni medidas. La restricción de persistencia arquitectónica documentada en 5B-B2 permanece vigente.

## Archivos de Fase 6B

Modificados, bajo `apps/desktop/renderer/src/`:

- `components/viewport/ThreeSceneManager.ts`
- `components/viewport/factories/FurnitureFactory.ts`
- `components/viewport/factories/OpeningFactory.ts`
- `components/viewport/factories/RoomFactory.ts`
- `tests/components/viewport/ThreeSceneManager.test.tsx`

Nuevos:

- `apps/desktop/renderer/src/components/viewport/helpers/roomRenderKey.ts`
- `apps/desktop/renderer/src/components/viewport/interaction/VisualState.ts`
- `apps/desktop/renderer/src/tests/components/viewport/IncrementalViewport.test.ts`
- `apps/desktop/renderer/src/tests/components/viewport/IncrementalVisualState.test.ts`
- `apps/desktop/renderer/scripts/incremental-webgl-probe.ts`
- `docs/FASE_6B_OPTIMIZACION_VISOR.md`

## Validación

- Suite completa: **955 pruebas, 73 archivos, todas aprobadas**, `npm run test:run -- --cache=false --maxWorkers=4`.
- Nuevas pruebas incrementales: **21 pruebas** en dos archivos. Cubren selección consecutiva, deselección, depuración, diagnósticos dinámicos, reutilización, metadatos y clones, cambios reales in situ, cambio de habitación, opciones de dibujo, liberación única, fallo parcial y recuperación.
- Paridad de geometría visible y materiales para 11 tipos de muebles, combinaciones de diagnóstico/selección/depuración y puertas/ventanas; se compara con la construcción histórica sin callbacks.
- Las pruebas de picking de las cuatro paredes segmentadas ahora comprueban además que deseleccionar conserva el material y elimina su emisión. Se mantienen las pruebas de enfoque con cámara y OrbitControls reales, selección y botón de enfoque, importación y recuperación.
- `npm run lint`: aprobado; el script ejecuta TypeScript de producción y pruebas. No existe un comando ESLint independiente en este paquete.
- `npm run build`: aprobado. JS 1.113,54 kB, gzip 290,22 kB; continúa el aviso de chunk superior a 500 kB.
- `git diff --check` y revisión de espacios de archivos nuevos: aprobados.
- jsdom informa que no implementa `HTMLCanvasElement.getContext` en algunas pruebas; esas pruebas simulan WebGL y no se presentan como pruebas gráficas.

### WebGL real

Chrome headless, WebGL 2.0, identificación expuesta `WebKit WebGL`. Se agruparon los tres scripts con el esbuild ya instalado y se ejecutaron desde una carpeta temporal externa al repositorio; sin dependencias nuevas y sin servidor Vite.

- `viewport-webgl-probe.ts`: habitaciones de 0,1, 5 y 100 m; nueve enfoques consecutivos incluyendo objetos rotados. Máximo absoluto X/Y de las esquinas proyectadas: 0,892858; Z inferior a 1; ningún error WebGL. Primer render con `gl.finish`: 415,2 / 56,1 / 55,5 ms respectivamente. Son muestras de arranque, no FPS sostenidos.
- `architectural-webgl-probe.ts`: 12 casos (tres escalas, cuatro orientaciones), huecos comprobados por rayos, elevación, resaltado de paredes segmentadas y DTO intacto. Todos aprobados, ningún error WebGL.
- `incremental-webgl-probe.ts`: 21 comparaciones de framebuffer RGBA a 800 × 600 entre actualización incremental y reconstrucción forzada: **cero bytes diferentes**. Incluye mueble rotado, puerta, ventana, pared declarada, depuración, deselección y selección repetida en las tres escalas. Comprueba árbol estable, posición de cámara estable y DTO intacto. No sustituye una sesión manual interactiva ni verifica todos los dispositivos gráficos.

## Rendimiento CPU y recursos

Medición reproducible en `IncrementalViewport.test.ts`, con objetos mesa, Three.js real y WebGLRenderer simulado en jsdom. Una construcción y tres actualizaciones (primer objeto, segundo objeto, deselección) por escenario. Muestras individuales, no promedios estadísticos entre ejecuciones; los tiempos dependen de JIT, carga y GC. La referencia anterior se tomó sobre 5B-B2 antes de la optimización con el mismo escenario e instrumentación. No son tiempos GPU ni FPS.

| Objetos | Construcción antes/después (ms) | Tres actualizaciones antes (ms) | Tres actualizaciones después (ms) | Construcciones antes/después |
| --- | --- | --- | --- | --- |
| 10 | 13,45 / 16,46 | 6,73; 5,23; 5,35 | 0,457; 0,205; 0,161 | 4 / 1 |
| 100 | 43,67 / 64,38 | 42,30; 30,36; 31,52 | 0,630; 0,592; 0,542 | 4 / 1 |
| 1.000 | 283,03 / 394,39 | 293,37; 299,64; 674,92 | 3,325; 2,972; 2,944 | 4 / 1 |

Conteos de recursos únicos asociados al árbol de habitación, incluidos resaltados invisibles. G = geometrías, M = materiales, T = texturas. Excluyen luces, cuadrícula y recursos transitorios no asociados. No equivalen a bytes de memoria ni VRAM.

| Objetos | Inicial antes G/M/T | Inicial después G/M/T | Creaciones durante tres actualizaciones antes G/M/T | Después G/M/T |
| --- | --- | --- | --- | --- |
| 10 | 61/30/1 | 91/60/1 | 187/94/3 | 0/0/0 |
| 100 | 511/210/1 | 811/510/1 | 1.537/634/3 | 0/0/0 |
| 1.000 | 5.011/2.010/1 | 8.011/5.010/1 | 15.037/6.034/3 | 0/0/0 |

Antes se liberaban durante las actualizaciones las mismas cantidades que se creaban. Después no se crea ni libera ningún recurso de habitación al seleccionar. Al limpiar y destruir el administrador, todos los recursos observados se liberan exactamente una vez (91/60/1, 811/510/1 y 8.011/5.010/1 respectivamente). No se observó saturación ni bloqueo en estos escenarios CPU; no se establece un máximo soportado.

## Riesgos y límites

El coste inicial y los recursos retenidos aumentan al preparar los resaltados; se acepta explícitamente este intercambio para evitar reconstrucciones repetidas. WebGL puede subir a GPU una geometría oculta cuando se muestra por primera vez, aunque no se cree otra geometría JavaScript. No se midió memoria en bytes ni rendimiento WebGL sostenido con 1.000 objetos.

La validación, serialización de la clave y comparación de diagnósticos siguen siendo O(n); solo la aplicación visual queda acotada a entidades afectadas. Nuevos campos que afecten el render deberán incorporarse a la clave y a sus pruebas. Una edición geométrica todavía reconstruye la habitación completa; el alcance de esta fase es evitarlo por selección y resaltado.

No se modificaron `Viewport3D`, `ObjectSelectionController`, `ThreeResourceDisposer`, contratos ni dependencias en 6B. La carpeta `.vite/` preexistente conserva sus dos archivos y hashes. Los artefactos de prueba gráfica y logs quedan fuera del repositorio. Pendiente revisión del usuario antes de cualquier commit de esta fase.
