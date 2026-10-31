# Fase 6A — escala del visor 3D

Fecha: 2026-10-31 (Costa Rica). Informe de validación de Fase 6A y de la corrección de enfoque, preparado antes del commit de cierre.

## Git y alcance

Rama verificada antes de editar: `feature/ide-spatial-contract-updates`.
HEAD inicial: `df3d82c40f05ea0fd80063078f14c70202bf6643`.
Estado inicial: únicamente `apps/desktop/renderer/.vite/` sin seguimiento. No se editó esa carpeta; las pruebas se ejecutaron con `--cache=false`.
Durante la implementación no se cambió de rama ni se instalaron dependencias. El cierre autorizado contempla un único commit de Fase 6A, merge a develop y push normal tras las validaciones y la revisión del historial.

## Auditoría

- CameraController ya tenía cámara ortográfica, OrbitControls, zoom, foco, resize y encuadre proyectado de las ocho esquinas de la habitación. No incluía muebles ni sus rotaciones. La distancia y el recorte tenían mínimos fijos; el cálculo inicial actualizaba la proyección antes de cambiar far.
- ThreeSceneManager ya filtraba objetos sin colocar, validaba antes de reconstruir, mantenía pickables y liberaba recursos. Reconstruye toda la habitación incluso al cambiar selección: sigue siendo el principal costo de actualización.
- Viewport3D ya protege datos inválidos, muestra errores, distingue objetos sin colocar y conserva selección/propiedades. No se modificó. El efecto existente vuelve a enfocar al cambiar activeRoom/maximización.
- Cuadrícula fija de 40 unidades/40 divisiones; luz direccional y cámara de sombras con posiciones y límites fijos; luz de relleno con alcance fijo de 20 unidades.
- FurnitureFactory ya normaliza la geometría visual a las dimensiones declaradas, con origen inferior y rotaciones Euler XYZ en grados. No fue necesario alterar las fábricas de muebles, habitaciones o aberturas.
- ThreeResourceDisposer ya deduplica geometrías, materiales y texturas por recorrido y libera mapas de sombras. Se reutiliza al sustituir la cuadrícula. No se introdujeron recursos globales compartidos.

## Cambios

- `apps/desktop/renderer/src/components/viewport/helpers/sceneScale.ts`: unión de límites de habitación y objetos colocados, transformación de sus cajas por rotación/posición, parámetros visuales y proyección de esquinas. No muta ScenePlan.
- `apps/desktop/renderer/src/components/viewport/camera/CameraController.ts`: centro y distancia relativos a los límites combinados, planos near/far adaptados, encuadre válido también si el contenedor está oculto. Detecta cambios de límites en la misma habitación; la selección con límites iguales conserva navegación. Zoom y OrbitControls se mantienen.
- `apps/desktop/renderer/src/components/viewport/ThreeSceneManager.ts`: cuadrícula con pasos métricos adaptativos y número acotado de divisiones; conserva colores de tema y reutiliza geometría si el tamaño no cambia. Sombras, posición y objetivos de luces y alcance del relleno adaptados a la escena. Relleno sin atenuación por distancia, con alcance relativo, para mantener consistencia entre escalas. Resolución de sombras permanece en 2048.
- `apps/desktop/renderer/src/tests/components/viewport/sceneScale.test.ts`: pruebas puras de rotación, exclusión de objetos sin colocar, inmutabilidad, escalas 0,001/1/1.000/1.000.000 y aspectos 0,2/1/3.
- `apps/desktop/renderer/src/tests/components/viewport/ThreeSceneManager.test.tsx`: integración de cambios de límites, navegación, recorte y reutilización de cuadrícula; benchmark optativo 10/100/1.000.
- `apps/desktop/renderer/scripts/viewport-webgl-probe.ts`: sonda independiente de WebGL real, sin mocks.
- `apps/desktop/renderer/src/tests/components/viewport/CameraController.test.ts`: regresión exacta de habitación de 0,1 m; habitaciones de 5 y 100 m, objetos rotados, selecciones consecutivas, controles reales, margen de encuadre y ausencia de mutaciones.
- `apps/desktop/renderer/src/tests/components/viewport/ViewportInteraction.test.ts`: elimina la expectativa del desplazamiento fijo y verifica que el punto solicitado se proyecte en el centro visible.
- Este informe.

## Validación

- `npm run lint`: correcto; el script ejecuta TypeScript de aplicación y de pruebas. No existe un linter adicional configurado en este paquete.
- Suite histórica anterior a la corrección de enfoque: 67 archivos, 852 pruebas aprobadas en 37,16 segundos. Validación final de cierre con benchmark: 68 archivos, 856 pruebas aprobadas en 38,85 segundos. Los mensajes de error WebGL de jsdom corresponden a las pruebas de degradación/recuperación esperadas; no son fallos de la sonda real.
- Suite de viewport tras ajustes visuales: 7 archivos, 68 pruebas aprobadas (antes de añadir la última prueba de integración).
- `npm run build`: correcto. Advertencia de bundle JS de aproximadamente 1.105 kB minificado antes de gzip (aproximadamente 288 kB gzip); supera el umbral de aviso de 500 kB de Vite.
- `git diff --check`: correcto.
- Un intento mediante `npx vitest` resolvió el Vitest del paquete padre y falló por falta de jsdom allí. No se instalaron paquetes; la ejecución mediante `npm run test:run` usa correctamente las dependencias del renderer.

## Rendimiento medido — CPU, WebGL simulado

Windows, Node/Vitest/jsdom. FurnitureFactory y estructuras Three.js reales; WebGLRenderer simulado. Una muestra por escenario, ejecutada en orden progresivo, sin calentamiento. La actualización reconstruye la escena cambiando la selección. El delta de heap incluye ambas operaciones, otros recursos JS y ruido de GC: no representa memoria retenida ni VRAM.

| Objetos | Construcción ms | Actualización ms | Delta heap MiB |
| --- | ---: | ---: | ---: |
| 10 | 5,50 | 6,62 | 11,94 |
| 100 | 43,21 | 36,01 | -9,85 |
| 1.000 | 278,17 | 300,93 | 51,56 |

Repetición durante la suite completa: 5,39/5,50 ms; 40,20/38,37 ms; 282,65/323,20 ms respectivamente. El delta de heap en 1.000 pasó a 23,20 MiB: confirma que no debe interpretarse como memoria estable.
No hubo saturación ni bloqueo en esos escenarios; no se establece un máximo soportado. Las pruebas tienen timeout de 30 segundos por escenario y se pueden ejecutar aisladamente con:

```powershell
# Desde apps/desktop/renderer
$env:LUMI_VIEWPORT_BENCH='1'
npm run test:run -- src/tests/components/viewport/ThreeSceneManager.test.tsx --cache=false --maxWorkers=1 --disableConsoleIntercept
```

## WebGL real

Chrome headless, viewport del canvas 800×600, WebGL 2.0 (OpenGL ES 3.0 Chromium), renderer reportado: WebKit WebGL. No se identificó el adaptador físico; puede usar renderizado por software. La sonda usa ThreeSceneManager real, crea una habitación y un mueble de dimensiones relativas situado fuera de ella, fuerza render y `gl.finish()`, registra error y libera el manager.

| Lado habitación m | Primer render + gl.finish ms | glError | Geometrías | Draw calls |
| --- | ---: | ---: | ---: | ---: |
| 0,1 | 466,70 | 0 | 16 | 25 |
| 5 | 101,40 | 0 | 17 | 26 |
| 100 | 329,50 | 0 | 17 | 26 |

Estos tiempos incluyen compilación de shaders y sincronización; no son FPS ni una medida sostenida de GPU. No hubo revisión visual interactiva ni benchmark WebGL de 1.000 objetos.

Reproducción de la sonda sin dependencias nuevas: empaquetar `scripts/viewport-webgl-probe.ts` mediante la API `buildSync` del esbuild ya instalado, con `bundle: true` y `platform: 'browser'`, hacia una carpeta temporal; crear allí un HTML con un script clásico que cargue el bundle; abrirlo en Chrome `--headless --dump-dom` con perfil temporal. El elemento `pre` contiene los resultados JSON y el título cambia a `probe-complete`. No usar caché de Vite para esta sonda.

## Limitaciones y compatibilidad

No se modificaron ScenePlan, contratos de paredes/puertas/ventanas, parser, AST, intérprete, adaptador espacial, importación o exportación. Las pruebas existentes de artefactos, validación, diagnósticos y recuperación forman parte de la suite completa; esto no sustituye una revisión manual de .lumic 1.0.0/1.1.0.
Los límites son cajas conservadoras de dimensiones declaradas transformadas; resaltados, cotas y decoración tienen un margen proporcional de encuadre, pero no se incluyen individualmente. Muebles extremadamente alejados reducen la presencia visual de la habitación al incluirse en el encuadre.
La resolución fija de sombras tiene menor detalle por metro al crecer la escena. Hace falta revisión visual en GPU física para ajustar calidad/bias en escalas extremas. La reconstrucción completa al seleccionar sigue siendo costosa a 1.000 objetos; no se cambió a instancing ni a recursos compartidos porque implicaría revisar picking, estados visuales y propiedad de recursos.
Cambiar los límites vuelve a encuadrar la escena; es un cambio intencional de comportamiento. Los modos de iluminación conservan sus colores e intensidades, aunque el relleno y la cobertura de sombras cambian visualmente con esta fase.

## Commit de cierre autorizado

`feat(ide): improve adaptive camera framing and viewport scaling`

Este informe se guarda antes de crear el commit. La revisión previa confirma nueve archivos de Fase 6A, sin archivos temporales ni caché. La carpeta .vite preexistente queda fuera del staging y del commit. Los SHA de commit, merge y resultado del push se comunican al finalizar la operación; no se reescribe el historial.

## Corrección del enfoque y validación de cierre

El fallo original era un desplazamiento vertical fijo de 0,4 m en focusObject, combinado con no recalcular distancia ni proyección. En una habitación de 0,1 × 0,1 × 0,1 m, el centro del objeto pasaba de Y proyectada -0,292 a -4,160.

Ahora el enfoque usa el centro de la caja del objeto colocado con sus rotaciones XYZ, adapta distancia y recorte al objeto y a la escena y ajusta la proyección con margen de 1,12. Mantiene el ángulo manual y consume la inercia de OrbitControls antes del enfoque explícito. La selección y el botón conservan su interfaz pública; ThreeSceneManager pasa el ID activo al controlador para distinguir objetos que comparten posición. No se altera ScenePlan.

La prueba antigua solicitaba un punto [2, 1, -1] sin objeto coincidente y exigía [2, 1.4, -1]. El comportamiento intencional en ese caso es enfocar el punto exacto [2, 1, -1]. Se conserva esa comprobación y se añaden aserciones de proyección al centro y de profundidad visible, en lugar de eliminar la prueba.

Las nuevas pruebas usan cámara, muebles y OrbitControls reales con DOM simulado, sin simular sus cálculos. Comprueban ocho esquinas del objeto, |X| e |Y| <= 0,9 y |Z| < 1, tras el enfoque y tras 90 actualizaciones. Cubren escalas 0,1/5/100, rotaciones, selecciones consecutivas, entrada de rueda, zoom y conservación del ángulo tras pan. La integración React comprueba selección y botón; allí solo WebGLRenderer está simulado.

Repetición WebGL real en Chrome headless: habitaciones de 0,1/5/100 m, primer render + gl.finish de 410,10 / 171,30 / 58,50 ms. Nueve enfoques consecutivos (objeto inicial, rotado, inicial para cada escala): máximo |X,Y| = 0,892858, máximo |Z| = 0,939674 y glError = 0 en todos. La sonda libera el manager mediante finally incluso ante errores. Son mediciones de primer render con sincronización, no FPS sostenidos ni evidencia de un adaptador físico concreto.

Repetición de CPU durante el cierre (WebGL simulado): construcción/actualización de 12,35/4,56 ms para 10 objetos; 37,37/35,29 ms para 100; 301,43/312,76 ms para 1.000. Deltas de heap: -34,38 / 38,93 / 45,51 MiB. Se conservan arriba las mediciones históricas; ambas ejecuciones incluyen ruido de GC y no fijan un máximo soportado.

El informe se corrigió a UTF-8: cero signos de interrogación dañados y presencia de á, é, í, ó, ú y ñ comprobada. Los resultados históricos se conservaron. No se cambiaron dependencias ni contratos compartidos de Python o del adaptador espacial.
