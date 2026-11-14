# Fase 10A — Entrega inicial: inventario, programas, dimensiones y cuadrícula

Fecha: 4 de noviembre de 2026, America/Costa_Rica.

## Alcance y estado del repositorio

Rama propia: `audit/phase-10a-initial`, creada desde `b8cc9202b265cdf11dcd3c872e554ab35ba75958`, con árbol inicial limpio. Se revisaron remotos y se ejecutó fetch; `origin/develop` y `origin/main` apuntaban a `d4e4c9680b413e70ef316816441346408496cd0c`. La base auditada contiene el mismo renderer, y no incorpora físicamente los ejemplos L038 añadidos en develop. Las fuentes de esta batería se conservan bajo `phase10a/programs`.

Se realizaron únicamente A–D. No se ejecutó estrés masivo, campaña de fallos/recuperación ni auditoría exhaustiva de usabilidad. No se cambió producción, Python, parser, AST, contratos, `.lumic`, dependencias ni `.vite/`. No se hicieron commits, merge ni push. Los archivos nuevos son herramientas y evidencia de auditoría.

## Qué se probó realmente

- **40 programas Lumi**: análisis y ejecución mediante servicios reales, 80 respuestas de protocolo; luego 80 solicitudes al worker NDJSON, idénticas a las del dispatcher.
- **Validación TypeScript** de las 80 respuestas, sin relajar contratos. No se fabricaron escenas para los programas rechazados.
- **26 programas con ScenePlan**, 28 habitaciones distintas en total. Three.js real renderizó 40 construcciones incluyendo repeticiones de tamaños problemáticos. Se hicieron 13 enfoques de muebles y una comprobación de pan fuera de la cuadrícula. Cero errores WebGL en las ejecuciones registradas.
- **Electron real**, con main/preload de producción, build React y Python del repositorio, usando un perfil/proyecto temporal. Se verificaron los controles enumerados en `ui-observations.json`.
- Inventario estático de **147 definiciones de controles en 31 archivos de componentes**, conservado en `controls.json`, además de inspección de App, menús declarados como datos, hooks, servicios, supervisor e IPC.

La cobertura manual de botones es **parcial y explícita**: no se afirma haber activado las 147 definiciones ni todas sus variantes. Los controles de diálogos nativos, operaciones destructivas y combinaciones de preferencias no ejercitados quedan como no comprobados. El inventario en código permite localizarlos sin convertir una conexión de callback en una prueba funcional aprobada.

## A — Matriz funcional inicial

| Módulo/capacidad | Clasificación | Evidencia y alcance |
| --- | --- | --- |
| Compilar / F5 | Funcional con backend real, con análisis espacial parcial | Programas reales y UI. Analiza, no genera escena. La limitación espacial se anuncia. |
| Ejecutar Python | Funcional con backend real | Botón Electron → IPC → worker → DTO → escena visible de dos muebles. |
| Tipos, expresiones, condicionales, ciclos, funciones, imports, mostrar | Funcional con backend real en los casos probados | Fuentes y resultados completos en la batería. No equivale a cobertura total del lenguaje. |
| leer | Parcialmente integrado | Sintaxis aceptada; ejecución por protocolo devuelve `INPUT_UNAVAILABLE`. No hay solicitud interactiva. |
| Habitaciones, pisos y muebles | Funcional con backend real | Dimensiones y transformaciones verificadas contra código/DTO y geometría Three.js. |
| Paredes automáticas | Funcional con backend real | Cuatro caras generadas a partir de cada habitación; no son declaraciones arquitectónicas publicadas. |
| Paredes, puertas y ventanas declaradas | Pendiente de integración en la base actual | Sintaxis admitida, pero propiedades geométricas rechazadas por el validador espacial; una pared histórica llega a error de serialización. |
| Selección, propiedades e ir al código | Funcional con backend real para los muebles publicados | Selección real de mesa, ID/fuente, medidas, posición, giro y acabado visibles. |
| Cámara, enfoque y modo alámbrico | Funcional frontend, con límites medidos | UI normal y 13 enfoques WebGL; recorte de geometría auxiliar en habitaciones pequeñas. |
| Cuadrícula adaptable | Funcional frontend con integración parcial de ajustes | Se adapta al tamaño; la casilla para ocultarla no tiene efecto. |
| Ejes/cotas/luces de la barra del visor | Funcional frontend por implementación; cobertura manual parcial | Callbacks directos al gestor. No se ejercitaron todas las combinaciones en esta sesión. |
| Ajustes globales de rejilla/ejes/cotas/iluminación/calidad | No funcionales respecto a su efecto anunciado en el renderer actual | Sus valores se editan, pero Viewport3D no consume estas preferencias. Rejilla comprobada visualmente; los demás por trazabilidad de código. |
| Temas, tipografía, wrap, tabulación, autosave | Frontend; algunas conexiones comprobadas en código | CodeEditor consume estas opciones; persistencia y todas las variantes no revalidadas manualmente. |
| Mascota y mensajes | Funcional frontend | Mensajes reactivos visibles. Es un servicio local de estados, no un intérprete ni un asistente generativo. |
| Ajustes showMascot, autoCompileOnType y soundEffects | Parcialmente integrados/no funcionales por trazabilidad | Se almacenan y muestran en ajustes, pero no tienen consumidores operativos en la base inspeccionada. No se atribuye una prueba visual a cada uno. |
| Depurador Python | Pendiente de productor/protocolo | `debugTrace:false`; no se inventan pasos, variables o pila. |
| Reproductor de pasos y breakpoints | Simulado/demostración o reproducción de datos importados | Control local de listas; no controla Python. No reejercitado con un artefacto en esta sesión. |
| Formatear código | No funcional, identificado como no disponible | Menú muestra el estado y el botón emite aviso; no promete formateo efectivo. |
| CRUD de proyectos/archivos y guardado | Conectado a filesystem real; revalidación manual incompleta | Supervisor/servicios inspeccionados; carga aislada comprobada. No se probaron todas las acciones nativas. |
| .lumic 1.0.0/1.1.0 | Frontend y persistencia existentes; no revalidados por UI en esta sesión | Validadores y servicios inspeccionados; persistencia arquitectónica extendida sigue pendiente. |
| Formulario de entrada de 8A | Preparación frontend sin conexión | No está montado ni se anuncia como lectura real. |

Redundancias constatadas en código: nuevo/abrir proyecto aparecen en menú, explorador y estado vacío; guardar tiene menú, botón y atajo; ejecutar/compilar tienen menú, botón y atajo. Son accesos alternativos, no defectos por sí mismos. En cambio, ajustar habitación y restablecer cámara llaman ambos a `adaptCameraToRoom`: actualmente producen el mismo encuadre isométrico para la habitación activa. No se eliminaron controles ni se estudió todavía un rediseño (fase G pendiente).

## B — Programas reales y resultados

| Grupo | Resultado observado |
| --- | --- |
| Declaraciones y expresiones | Salida `5`, `3.0`, `Lumi`, `verdadero`. |
| Condición, hacer y mientras | Acumulación y rama esperada: `cinco`. |
| Función importada | Área calculada: `30`. Se conserva el formato real de salida; no se fuerza `30.0`. |
| Error léxico | Análisis léxico fallido y ejecución bloqueada; el protocolo conserva lexicalError sin inventar diagnóstico estructurado. |
| Errores sintáctico/semántico | `SYN_UNEXPECTED_TOKEN` / `SEM_TYPE_MISMATCH`; ejecución bloqueada. |
| Error de ejecución | `RUN_DIVISION_BY_ZERO`, sin ScenePlan publicado. |
| leer | `INPUT_UNAVAILABLE` de infraestructura. |
| Mesa, silla, color, material y giro | DTO y mallas: mesa en `[0,0,0]`, Y=45°, color `ff2200`, metalness 0,8; silla en `[-2,0,-1]`, color `2255ff`. Captura inspeccionada visualmente. El brillo metálico puede verse claro; el material conserva el color declarado. |
| Mueble sin colocar | Declaración conservada en DTO; solo el colocado genera geometría. |
| Varias habitaciones | Tres habitaciones de tamaños distintos; se renderiza cada una por separado. No hay disposición global de habitaciones separadas publicada por estos programas. |
| Arquitectura declarada completa | Parser acepta la sintaxis, pero la ejecución falla con `SPA_INVALID_PROPERTY` para orientacion/ancho/alto/desplazamiento/elevacion. Son rechazos Python, no fallos Three.js. |
| Pared histórica solo con color | Ejecución interna posible, protocolo `SERIALIZATION_ERROR`: no se fabrica una pared publicable ni se reemplaza la escena por una simulación. |

Totales de ejecución de protocolo: **29 completed, 3 blocked, 6 failed y 2 error**. Los fallos intencionales y capacidades pendientes no se cuentan como pruebas exitosas de renderizado. Las 80 respuestas son DTO válidos para sus estados respectivos.

## C — Dimensiones medidas

Se probaron cubos de habitación vacíos y con una mesa de catálogo: `10⁻⁹`, `10⁻⁶`, `0,01`, `0,1`, `1`, `5`, `100`, `1.000`, `10.000` y `1.000.000` metros por eje. Son pruebas de escala con cantidades constantes y pequeñas de geometría, no estrés de objetos.

Cero y -1 se rechazan con `SPA_INVALID_DIMENSION` antes de publicar ScenePlan. Todos los tamaños positivos muestreados fueron aceptados y renderizados sin error WebGL. **10⁻⁹ es el menor valor probado, no un mínimo del lenguaje; 1.000.000 es el mayor probado, no un máximo soportado.** No hay un máximo nominal en la validación inspeccionada; siguen existiendo límites de representación numérica y de transporte que no se llevaron al extremo.

Para separar el encuadre lógico de la geometría visible se midieron las esquinas de los límites lógicos y todos los vértices de mallas físicas MeshStandardMaterial, proyectados a NDC. El intervalo visible es [-1,1]. Se excluyen sprites de cotas y contornos de selección. La caja física envolvente se guarda también, pero sus esquinas no se confunden con vértices reales.

| Habitación vacía | Máximo absoluto X/Y de vértices físicos | Vértices fuera del frustum / total | Resultado |
| --- | ---: | ---: | --- |
| 0,01 m | 11,381046 | 84 / 144 | Recorte severo lateral y de profundidad; imagen inspeccionada |
| 0,1 m | 2,038328 | 57 / 144 | Recorte lateral confirmado |
| 1 m | 1,007404 | 3 / 144 | Recorte leve confirmado |
| 5 m | 0,915767 | 0 / 144 | Encuadre físico completo en esta prueba |
| 100 m | 0,894003 | 0 / 144 | Encuadre físico completo |
| 1.000 m | 0,892972 | 0 / 144 | Encuadre físico completo |
| 10.000 m | 0,892869 | 0 / 144 | Encuadre físico completo |

Los casos vacíos de 10⁻⁹, 10⁻⁶, 0,01, 0,1 y 1 m se reconstruyeron tres veces: las mediciones se repitieron. En el rango solicitado, 0,01 m ya presenta el problema; entre 1 y 5 m no se ha localizado un umbral continuo. No se declara un tamaño mínimo soportado a partir de esta muestra.

**Causa confirmada:** el encuadre usa `calculateSceneBounds`, que incluye la caja lógica de habitación y muebles colocados, pero no todos los espesores físicos. RoomFactory conserva piso de 0,08 m, zócalo y paredes de 0,16 m; las guías también contienen tamaños constantes. Cámara y grid tienen mínimos de 0,01. Esos tamaños auxiliares dominan habitaciones diminutas. No es un rechazo del contrato ni un fallo de WebGL.

La mesa conserva sus dimensiones de catálogo; no se escala con la habitación. Por eso los casos pequeños con mesa amplían el encuadre alrededor del mueble y no representan una solución del problema de la habitación vacía. Los 13 enfoques de objetos conservaron sus límites proyectados visibles; se mantuvieron IDs, posiciones y rotaciones. No se ejecutó una campaña de colisiones/fuera de límites (fase F).

Se midió también la representación Float32 de los vértices del suelo frente a ancho/largo del DTO; el error relativo máximo de la muestra fue **2,8282 × 10⁻⁸**, conservado en `precision.maxRelativeError` en el JSON. No se observaron NaN ni errores GL en estos casos. Esto no demuestra precisión arbitraria ni elimina los límites IEEE-754 para coordenadas o volúmenes mayores.

Habitaciones desproporcionadas: `[10000,0.01,0.01]`, `[0.01,0.01,10000]` y `[0.1,1000,3]` se aceptan. La extremadamente alta produce **0 píxeles distintos del fondo de 585.000**, confirmado en tres renderizados, pese a geometría dentro del frustum y sin error GL. Su anchura proyectada es inferior a un píxel al encuadrar toda la altura: límite de visibilidad por proporción/resolución, no pérdida del DTO. Falta estudiar vistas alternativas; no se deforma geometría para ocultarlo.

## D — Cuadrícula y cámara

- Se crea inicialmente una GridHelper de 40 × 40, pero se reemplaza su geometría al recibir una habitación. **40 no es el límite operativo de la cuadrícula.**
- `extent = max(size.x,size.z,0.01)`; paso aproximado `extent/20`, redondeado por magnitud; divisiones pares que cubren al menos 1,4 veces la extensión. La altura de la habitación afecta radio/cámara, no ese ancho horizontal de grid.
- Ejemplos medidos de lado de cuadrícula: 0,014 m para el mínimo horizontal; 0,14 m para una habitación de 0,1; 7,2 m para 5; 140 m para 100; 1.400 m para 1.000; 14.000 m para 10.000. La cantidad de vértices depende de las divisiones, no de llenar cada metro con una celda fija.
- Su centro queda anclado a la escena. Al trasladar programáticamente cámara y target 72 m en X, de forma equivalente a pan en el caso de 5 m, la cuadrícula no se mueve y queda completamente fuera del frustum. OrbitControls permite pan y no limita el target; no se presenta esta comprobación como un gesto de ratón completo. El borde de grid no amplía el suelo real.
- La cámara ortográfica adapta distancia, near y far al radio. Zoom está limitado a 0,4–3,5. Estos límites de zoom son distintos del tamaño de habitación y del borde de grid.
- En la habitación extremadamente alta, el grid se proyecta a solo 0,00143 píxeles de ancho por 0,00085 de alto: puede resultar invisible por resolución aun sin salir del frustum. Ese caso es distinto del pan que deja el grid fuera de cámara.
- Hay una casilla «Rejilla de Suelo» en ajustes; se comprobó que desmarcarla y guardar **no oculta** la cuadrícula. `showGrid` no tiene consumidor en el gestor/Viewport3D. Tampoco hay un control operativo de tamaño de grid.
- Ejes, cuadrícula, suelo y paredes son objetos distintos. El botón con icono de rejilla de la barra alterna ejes X/Z, no la GridHelper.

Propuesta sin implementar: conectar preferencias de visibilidad al gestor; mantener una cuadrícula de complejidad acotada que acompañe el pan, desplazándola por múltiplos de celda para evitar saltos, o evaluar una cuadrícula por shader. Debe ser una referencia visual y no cambiar dimensiones del ScenePlan. Para cámara, encuadrar los límites físicos relevantes además de los lógicos o ajustar únicamente parámetros auxiliares de visualización, con pruebas de compatibilidad histórica. No se ha demostrado rendimiento de estas alternativas: requiere autorización y fase E posterior.

## Evidencia y reproducción

```powershell
node apps/desktop/renderer/scripts/audit-10a-backend.mjs
node apps/desktop/renderer/scripts/audit-10a-controls.mjs
node apps/desktop/renderer/scripts/audit-10a-graphics.mjs
```

El runner gráfico admite como argumento opcional la ruta de Chrome. Usa el esbuild ya instalado y temporales externos para HTML, bundle y perfil; nunca usa Vite ni modifica su caché.

Para la inspección Electron, construir main/preload con `node scripts/build.mjs` desde `apps/desktop`, disponer del renderer construido y ejecutar desde raíz `node apps/desktop/renderer/scripts/audit-10a-app.mjs`. Crea proyecto/perfil temporales con rutas canónicas y sirve el build localmente en 5189. Cerrar la ventana termina el servidor. No se reutilizan perfiles personales ni se cambian opciones de seguridad. No se guardan las capturas de ventana completa que muestran rutas personales; las seis imágenes conservadas son del canvas.

Archivos: `cases.json`, 41 fuentes `.lumi` bajo `programs`, `python-results.json`, `worker-results.json`, `webgl-results.json`, `environment.json`, `controls.json`, `ui-observations.json` y seis PNG bajo `evidence`.

Entorno registrado: Windows x64, Intel i7-13620H, Chrome headless 156/WebGL 2, canvas 900 × 650. Se guardó la identificación expuesta por WebGL; no se deduce un modelo GPU a partir de «WebKit WebGL». Las capturas fueron inspeccionadas visualmente. **No se midieron FPS, memoria ni tiempos de estrés**, y no se proporcionan gráficos de rendimiento en esta entrega.

## Qué recomendamos y qué falta probar

Prioridad inicial: corregir el encuadre físico de habitaciones pequeñas y conectar ajustes de grid/visor que actualmente no tienen efecto. Después acordar con el productor la publicación arquitectónica y las capacidades de leer/depuración ya pendientes. La extensión de grid con pan es una mejora visual; no hay evidencia de que exista un máximo de habitación impuesto por la cuadrícula.

Queda por aprobar: estrés progresivo y mediciones (E), fallos/recuperación (F), estudio completo de usabilidad y cobertura manual de diálogos/variantes (G), catálogo formal de incidencias (H) e informe/figuras para defensa (I). Los resultados anteriores son hallazgos iniciales de A–D, no el cierre de esas fases posteriores.

Comprobaciones de las herramientas: los cuatro archivos `.mjs` pasan `node --check`; el probe TypeScript se agrupó y ejecutó con esbuild; TypeScript/lint del renderer pasa; `git diff --check` y revisión UTF-8/espacios de los archivos nuevos pasan. Los hashes de los dos archivos `.vite/` coinciden con HEAD. No se ejecutó aquí la suite completa del renderer, que incluye escenarios de 1.000 objetos reservados para la fase E; tampoco se presentan resultados históricos como nuevas mediciones de esta auditoría.
