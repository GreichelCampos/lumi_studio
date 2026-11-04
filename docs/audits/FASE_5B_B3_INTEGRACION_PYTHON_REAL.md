# Fase 5B-B3 — Integración arquitectónica real con Python

Verificación: 1 de noviembre de 2026, America/Costa_Rica.

Revisión de cierre: 3 de noviembre de 2026. Este informe conserva el estado observado el día de la auditoría. Para el cierre se repitieron las pruebas del renderer, TypeScript/lint, build y el recorrido vivo de 78 respuestas Python hasta WebGL; los artefactos temporales se excluyen del control de versiones.

## Protección del trabajo y productor inspeccionado

La rama propia sigue siendo `feature/architectural-elements-integration`, HEAD `40c38829c0a8d6d77681bb876ca803764f26c770`. Se conservaron los informes, pruebas, capturas y probe de la auditoría L038 pendientes de commit, además de la anotación de cierre de Fase 6B. Ningún archivo previo se descartó ni sobrescribió. La carpeta `.vite/` conserva sus archivos y hashes.

Después de `git fetch origin`, se encontró `296fd57b906e8902748bd58afd069dd867f12a6d` en `origin/feat/integrante2-finalizacion`. Se creó un worktree **detached** en `%TEMP%/lumi-5bb3-296fd57`, dedicado a ese commit, sin cambiar ni modificar la rama de Grei. El worktree quedó limpio. No se hizo merge, rebase, cherry-pick, push ni commit.

Se revisó tanto el commit de propiedades obligatorias como sus antecesores `6a430eb` (integración geométrica/validación) y `6dfdae4` (primitivas). El productor tiene avances que no estaban en nuestra auditoría histórica de L038; sus capturas anteriores se conservan como evidencia de aquella revisión, no como resultados de este nuevo commit.

## Casos reales y resultados Python

Las fuentes de 39 casos se ejecutaron con el código sin modificar del worktree. La captura `grei296fd57.real.json` incluye cada fuente, archivo, respuestas de analizar/ejecutar, diagnósticos y geometría normalizada interna cuando existe. Esa geometría interna está separada de las respuestas publicadas: no se convierte en un ScenePlan inventado para el visor.

| Casos | Cantidad | Resultado observado |
| --- | --- | --- |
| Cuatro paredes declaradas en una habitación | 1 | Ejecución y DTO correctos; cuatro caras con apariencia, pero sin identidad declarada |
| Puertas, cuatro orientaciones, borde inicial/final permitido | 8 | Ejecutan y publican DTO con posición centrada correcta |
| Ventanas, cuatro orientaciones, elevación 0 y 0,9 | 8 | Ejecución interna completada; protocolo devuelve `SERIALIZATION_ERROR` |
| Cada propiedad obligatoria omitida individualmente | 10 | `SEM_MISSING_SPATIAL_PROPERTY`, ejecución bloqueada |
| Dos paredes explícitas de una orientación | 1 | `SEM_DUPLICATE_WALL_ORIENTATION`, ejecución bloqueada |
| Puertas solapadas | 1 | `SPA_OBJECT_COLLISION`, no publica escena |
| Muebles coincidentes / separados | 2 | Colisión con `SPA_OBJECT_COLLISION` / ejecución correcta |
| Zona libre de puerta, borde del mueble a 0,79 / 0,81 m de pared | 2 | `SPA_BLOCKED_DOOR` / ejecución correcta |
| Desplazamiento negativo, fuera del extremo, ancho cero, puerta demasiado alta | 4 | Límites con `SPA_OBJECT_OUT_OF_BOUNDS`; ancho cero con `SPA_INVALID_PROPERTY` |
| Elevación negativa / parte superior de ventana fuera de habitación | 2 | `SPA_OBJECT_OUT_OF_BOUNDS` |

Todas las declaraciones que pasan el análisis siguen reportando `analysisStatus: incomplete` y `spatial_semantics_unavailable`. El indicador aún procede de `services/analysis_capabilities.py`, que marca cualquier nodo espacial; no implica que las nuevas comprobaciones hayan dejado de ejecutarse. Las pruebas distinguen ese indicador conservado de los diagnósticos concretos y de una ejecución completada.

Se ejecutaron 176 pruebas pertinentes (semántica espacial, geometría/validador, protocolo y elementos en runtime), todas aprobadas. Después se ejecutó la suite Python completa del worktree: **824 aprobadas**, con `.venv/Scripts/python.exe -m pytest -q -p no:cacheprovider` y `PYTHONDONTWRITEBYTECODE=1`. No se instaló ninguna dependencia ni se editó Python.

## DTO efectivo y correspondencia con el contrato acordado

Las habitaciones mantienen dimensiones `[ancho X,largo Z,alto Y]`; los muebles `[ancho,alto,profundidad]`; posiciones `[X,Y,Z]` y rotaciones en grados. El productor utiliza el catálogo `spatial/furniture_catalog.py`, cuyo contenido conserva las medidas publicadas anteriormente. El renderer no cambia dimensiones ni posiciones.

Para norte/sur, el productor usa el ancho X; para este/oeste, el largo Z. La fórmula de `_door_dto` es exactamente la acordada:

`position = -wallSpan / 2 + desplazamiento + ancho / 2`

Se comprobó desde desplazamiento 0 hasta `wallSpan - ancho`, en las cuatro orientaciones. Ejemplo real de puerta norte en una habitación de 6 × 5 × 3, ancho 1 y desplazamiento 0:

```json
{
  "id": "element:door-norte-start.lumi:2:1:entrada",
  "wall": "norte",
  "position": -2.5,
  "width": 1,
  "height": 2,
  "sourceRef": { "file": "door-norte-start.lumi", "line": 2, "column": 1 }
}
```

La pared norte está en Z negativa, sur positiva, este X positiva y oeste negativa. La conversión ya ocurre en Python: **no debe repetirse en frontend**. El recorte y la puerta coinciden en Three.js.

### Diferencias pendientes de publicación

- **Ventanas:** `normalize_spatial_geometry` conserva elevación cero como propiedad explícita y conserva su ubicación; los casos positivos también se evalúan y validan. Sin embargo, `_room_dto` lanza `SceneAdapterError` con el mensaje de que su `WindowModel` local no admite `elevation`. Nuestro frontend sí lo admite desde 5B-B2. No hay DTO de ventana publicable en este commit. No se infiere la elevación desde la fuente ni se intenta renderizar una ventana sintetizada.
- **Paredes declaradas:** `_wall_dto` solo publica `color` y `material` en la cara `north/south/east/west`. Omite `id`, `name` y `sourceRef`, aunque el runtime conserva nombre y fuente. Se ven las cuatro caras con su apariencia, pero el IDE no puede distinguirlas de paredes automáticas para picking o navegación. La selección declarada existente en frontend queda intacta, pero no puede activarse con datos que el productor no publica.
- **Puertas:** publica ID y fuente reales, orientación, posición y medidas; omite nombre y los opcionales color/material, aun cuando estén en el código. Por tanto el visor usa su apariencia histórica y no aplica los estilos omitidos. No se inventan ni extraen del código del usuario.
- **Estado de capacidad:** las reglas nuevas de semántica/validación están presentes y probadas, pero el indicador general de semántica espacial sigue siendo `incomplete`. Grei debe decidir cuándo y cómo actualizarlo, sin eliminar la coherencia que exige el protocolo.

## TypeScript, visor y persistencia

Todas las 78 respuestas de los 39 casos pasan `validateProtocolResponse`, incluyendo fallos de lenguaje y errores de infraestructura legítimos. Los DTO de paredes/puertas publicables ya son compatibles con los contratos actuales. No fue necesario relajar validaciones, cambiar versiones ni transformar coordenadas otra vez.

La única modificación adicional de producción es en `PythonCompilerService.ts`: conserva íntegro el `SERIALIZATION_ERROR` del productor y explica que el visor ya admite `elevation`, mientras que ese adaptador Python aún no publica ventanas. No oculta el error ni devuelve una escena alternativa. Una prueba reproduce la respuesta auténtica para verificar el mensaje.

`openingVerticalBounds` mantiene el cero explícito y el centro histórico de 1,6 m al faltar elevación; no se modificó esa lógica. Tampoco se modificaron selección, OrbitControls, fábricas, gestor incremental ni recursos. Las pruebas existentes de propiedades y navegación por paredes con IDs siguen vigentes; no se presentan como evidencia de IDs emitidos por este productor.

La protección `architecturalArtifactErrors` permanece: campos arquitectónicos extendidos no pueden persistirse silenciosamente como `.lumic` 1.0.0/1.1.0. Las puertas publicadas usan el subconjunto histórico compatible. Advertencia de integración: como Python omite la identidad de paredes declaradas, ese DTO ya perdió tal información antes de llegar a la barrera de persistencia; exportarlo no puede recuperar esa identidad. No se declara resuelta la persistencia arquitectónica completa.

## Extremo a extremo vivo y WebGL

Se añadió un runner reproducible:

```powershell
cd apps/desktop/renderer
node scripts/architectural-python-e2e.mjs "$env:TEMP/lumi-5bb3-296fd57" ../../../.venv/Scripts/python.exe "C:/Program Files/Google/Chrome/Application/chrome.exe"
```

El runner comprueba el SHA del productor, invoca **un worker Python real por NDJSON**, envía las 78 solicitudes y compara sus respuestas con la captura. Pasa las respuestas recién recibidas, no un ScenePlan fabricado, al probe de navegador mediante un HTML temporal. El probe utiliza los validadores TypeScript de producción y `ThreeSceneManager` real.

Resultado: **39 casos, 78 respuestas, 11 escenas publicables, 23 estados de selección renderizados, cero errores WebGL**. Para las ocho puertas de borde se comprueba además:

- posición de geometría igual al DTO y altura central correcta;
- ausencia de pared en el hueco, mediante rayos sobre los segmentos reales;
- picking mediante eventos de puntero en canvas, que devuelve exactamente el ID de Python;
- selección/deselección conservando el árbol de habitación, sin reconstrucción;
- DTO intacto tras renderizar.

Los fallos y ventanas no publicadas se validan y se registran como no renderizados. La ausencia de IDs en paredes se registra explícitamente. Se usa Chrome headless WebGL a 800 × 600; no se afirma que sea una prueba completa de la UI Electron ni una medición de FPS. HTML, bundles, perfiles y salidas crudas del runner permanecen bajo una carpeta `%TEMP%/lumi-5bb3-e2e-*`, fuera del repositorio.

## Archivos propios de esta etapa

Modificado:

- `apps/desktop/renderer/src/services/integration/PythonCompilerService.ts`

Nuevos:

- `apps/desktop/renderer/src/tests/fixtures/python/grei296fd57.real.json`
- `apps/desktop/renderer/src/tests/contracts/greiArchitecturalProducer.test.ts`
- `apps/desktop/renderer/scripts/architectural-python-e2e.mjs`
- `apps/desktop/renderer/scripts/architectural-python-webgl-probe.ts`
- `docs/audits/FASE_5B_B3_INTEGRACION_PYTHON_REAL.md`

La prueba TypeScript nueva contiene 44 pruebas: validación de cada pareja de respuestas y comprobaciones específicas de conversión, elevación, diagnósticos, identidad ausente y mensaje del adaptador. Es reproducción de capturas reales; la ejecución viva se comprueba por separado con el runner anterior. Los archivos pendientes de L038 no se reemplazaron.

## Cierre y siguiente paso

Validación final: **1.005 pruebas aprobadas en 75 archivos** del renderer; **824 pruebas Python** aprobadas en el worktree; TypeScript/lint y build aprobados. El script `lint` ejecuta TypeScript de producción y pruebas. Build: JS 1.113,72 kB, gzip 290,28 kB; continúa el aviso de chunk superior a 500 kB. Las pruebas jsdom siguen emitiendo el aviso conocido de canvas no implementado; se distinguen de las ejecuciones gráficas reales.

Además del recorrido vivo, se reagruparon y repitieron los probes WebGL existentes: escala de 0,1/5/100 m y nueve enfoques (incluidos objetos rotados), 12 casos arquitectónicos de referencia y 21 comparaciones incrementales con cero diferencias. Esos probes existentes usan sus fixtures de referencia; la evidencia de productor real es el runner de 78 respuestas descrito antes. `git diff --check`, revisión UTF-8/espacios de archivos nuevos y `node --check` del runner aprobaron; `.vite/` conserva los hashes iniciales.

La integración real está verificada para paredes con apariencia y puertas con geometría e identidad. La integración de ventanas y selección/navegación de paredes declaradas sigue bloqueada en la publicación Python. Solicitar a Grei que emita ventanas con `elevation`, identidad/fuente de paredes y opcionales de puertas; después repetir el mismo recorrido vivo y ampliar sus comprobaciones. No es necesario cambiar contratos frontend para esos campos ya admitidos. La persistencia extendida y el indicador general de capacidad requieren su acuerdo específico.

No se realizaron commits, merge, rebase, cherry-pick ni push. El HEAD propio sigue en `40c38829c0a8d6d77681bb876ca803764f26c770`, con esta etapa y la auditoría previa pendientes de revisión.
