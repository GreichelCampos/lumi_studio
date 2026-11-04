# Integración arquitectónica: estado real tras Fase 6B

Verificación: 1 de noviembre de 2026, America/Costa_Rica.

Revisión de cierre: 3 de noviembre de 2026. Este registro corresponde al productor anterior a los ajustes de Grei. Los resultados posteriores de `296fd57` están documentados en [Fase 5B-B3](FASE_5B_B3_INTEGRACION_PYTHON_REAL.md). Las menciones a archivos pendientes describen el estado previo al cierre de estas auditorías.

## Git y alcance

Rama mantenida: `feature/architectural-elements-integration`.
Commit local de cierre de Fase 6B: `40c38829c0a8d6d77681bb876ca803764f26c770`, mensaje `perf(ide): optimize incremental viewport visual updates`. Incluye exclusivamente los 11 archivos de esa fase. Se revisaron diff y archivos nuevos, se repitieron las 955 pruebas, TypeScript/lint, build y comprobaciones de espacios antes de confirmar.

Se ejecutó `git fetch origin`, sin cambiar de rama ni incorporar commits ajenos. No se hizo merge, rebase, cherry-pick ni push. `.vite/` queda excluida y conserva sus dos archivos y hashes.

El ejemplo publicado se identifica como **L038**, no L35:

- Rama: `origin/feat/l038-casa-ejemplo`.
- Commit: `b74ac70a3de4d555bdc438668f506018578c9345`.
- También es el HEAD remoto de `origin/develop` observado tras fetch.
- Archivos: `examples/CasaEjemplo/principal.lumi`, `calculos.lumi`, `muebles.lumi`.
- No se encontró un commit identificado como L35/L035/L-035 en las referencias descargadas. El informe de Grei distingue expresamente L038 de las colisiones y puertas bloqueadas de L035.

El commit del ejemplo solo agrega fuentes, pruebas y evidencia. No hay diferencias de `services`, `lumi_language` ni `spatial` entre esa referencia y nuestro HEAD; por ello se ejecutaron sus fuentes exactas con nuestro backend existente, sin importar código de compañeras al árbol de trabajo.

## Recorridos ejecutados y evidencia

Se leyeron los tres archivos con `git show b74ac70a3de4d555bdc438668f506018578c9345:examples/CasaEjemplo/<archivo>`, conservando su texto. Se ejecutaron `CompilerService.compile_project`, `ExecutionService.execute` y ambas operaciones de `RequestDispatcher`. Además, se envió el mismo proyecto al proceso real `python -m services.worker` por NDJSON: las dos respuestas fueron idénticas a las del dispatcher y stderr quedó vacío.

| Operación | Estado real | Diagnósticos | ScenePlan |
| --- | --- | --- | --- |
| Compilar / analyze | `incomplete`, etapa `semantic` | 0 | Ausente; `scenePlan: false` |
| Ejecutar / execute | `completed`, análisis `incomplete` | 0 | Presente; `scenePlan: true` |

Ambas respuestas conservan `spatial_semantics_unavailable` como limitación. Ejecutar imprime `Area de sala:` y `30.0`. No se interpreta la limitación como un diagnóstico inventado ni como ejecución fallida.

El ScenePlan publicado contiene:

- Sala: dimensiones `[6,5,3]`, piso de madera, mesa, silla y planta colocadas.
- Estudio: dimensiones `[4,3,2.6]`, piso y escritorio colocado.
- Mesa: posición final `[1.5,0,0.5]`, rotación `[0,90,0]`.
- Silla: `[0,0,-1]`; planta: `[2,0,1.5]`, rotación `[0,90,0]`; escritorio: `[0,0,0]`, rotación `[0,90,0]`.
- Cuatro caras automáticas por habitación, sin ID de pared declarada; `doors` y `windows` vacíos.

Por tanto, **la casa publicada no demuestra integración arquitectónica declarada**. Sí demuestra la cadena real de importaciones, funciones, control de flujo, habitaciones, pisos y muebles.

Se ejecutaron las cuatro pruebas originales de Grei extraídas, sin modificar, a una carpeta temporal con las fuentes originales: **4 aprobadas**, usando `.venv/Scripts/python.exe -m pytest ... -q -p no:cacheprovider`. El Python global no tiene pytest; se usó el entorno existente, sin instalar dependencias.

## Origen de los bloqueos

`services/analysis_capabilities.py::analysis_limitations` detecta nodos espaciales y devuelve `SPATIAL_SEMANTICS_UNAVAILABLE`. `CompilerService` convierte un análisis sin diagnósticos, pero con esa limitación, en `incomplete`. `CompilationResult.can_execute` permite ejecutar ese análisis. Este estado es deliberado y distinto de una falla léxica, sintáctica o semántica concreta.

Para comprobar arquitectura se utilizó una **sonda separada**, no una modificación de CasaEjemplo. Contiene una pared norte, puerta norte y ventana este con ancho, alto, desplazamiento y elevación explícitos. Sus fuentes y respuestas reales están en `architecturePending.real.json`.

1. El parser acepta esas propiedades; el intérprete evalúa y conserva sus valores y ubicaciones en `SpatialElement.properties`. Se observó `elevacion=0.9` en la ventana del ScenePlan interno del intérprete.
2. `SpatialValidator._validate_element_properties` todavía permite solamente `color` y `material`. La sonda genera **10 `SPA_INVALID_PROPERTY`** auténticos: tres orientaciones, dos anchos, dos altos, dos desplazamientos y una elevación.
3. `InterpreterResult` conserva la escena junto a esos diagnósticos; `ExecutionService` devuelve `failed` y no publica esa escena. No debe presentarse ese árbol interno como un ScenePlan validado del IDE.
4. Una segunda sonda histórica, con ventana que solo tiene color, supera esa validación, pero `services/protocol/scene_adapter.py::_room_dto` lanza `SceneAdapterError` para `wall`, `door` o `window`. El protocolo devuelve **`SERIALIZATION_ERROR` de infraestructura**, sin ScenePlan. No es un error de sintaxis del usuario.

No se suprimieron diagnósticos, no se omitió el validador y no se fabricó una escena alternativa. La elevación funciona como propiedad evaluada interna; todavía no existe publicación Python de `WindowModel.elevation`.

## Auditoría del enlace Python → TypeScript

| Tema | Estado comprobado y trabajo pendiente |
| --- | --- |
| Desplazamiento | Python conserva la propiedad española sin transformarla. El visor consume `position` centrada. Antes de convertir hay que acordar desde qué extremo se mide y si designa centro o borde de la abertura. Si es distancia al centro desde el extremo de coordenada negativa: `position = desplazamiento - longitudPared/2`; si mide al borde, se agrega `ancho/2`. No se implementó ninguna interpretación unilateral. |
| Elevación | El visor usa borde inferior: `centerY = elevation + height/2`. Python todavía no emite `elevation`; deberá transferir la propiedad resuelta tras validación, conservando el cero explícito. La ausencia conserva centro histórico de 1,6 m. |
| Orientaciones | Caras DTO: `north/south/east/west`; aberturas: `norte/sur/este/oeste`. El visor coloca norte en Z negativa, sur positiva, este X positiva, oeste negativa. El recorrido desde `orientacion` todavía no está implementado por el adaptador Python. El sentido de medición en cada cara necesita confirmación. |
| Dimensiones | Habitación `[ancho X,largo Z,alto Y]`; muebles `[ancho X,alto Y,profundidad Z]`; posiciones `[X,Y,Z]` y rotación en grados. El frontend interpreta medidas en metros, sin normalizar la geometría real. Python emite números sin una etiqueta de unidad: debe confirmarse la convención compartida para arquitectura. |
| Identidad | El adaptador genera IDs reales de habitación y mueble basados en fuente y nombre. Los elementos arquitectónicos internos conservan nombre y `source`; aún no hay DTO de aberturas ni ID de pared declarada publicado. El frontend no debe inventarlos. |
| Referencias | `sourceRef` de muebles conserva la declaración. El runtime tiene además fuentes por propiedad y por operación (mesa movida/rotada desde `muebles.lumi`), que no se publican en ese `sourceRef`. La habitación interna tiene `source`; el DTO RoomModel no lo expone. No se amplía el contrato en esta fase. |
| DTO | `validateProtocolResponse` valida envoltura, coherencia y `sceneStructure`; `adaptBackendResult` transmite el ScenePlan sin reconvertir ni eliminar campos. El ScenePlan real de la casa pasa y mantiene sus datos. No hay pérdida arquitectónica atribuible a TypeScript: esos datos no llegan. |
| Geometría histórica | Permanecen paredes automáticas, ventanas sin elevación con centro 1,6 m, colocados/sin colocar y lógica adaptativa de Fase 6A. El ejemplo real usa dimensiones provisionales del catálogo Python, no tamaños semánticos definitivos. |
| `.lumic` | La casa histórica exporta y valida su ida/vuelta JSON en 1.1.0. Las suites existentes de 1.0.0/1.1.0 siguen vigentes. La barrera `architecturalArtifactErrors` continúa rechazando persistir extensiones arquitectónicas como esos formatos; no se cambió versión ni se habilitó persistencia incompatible. |

## Preparación segura realizada en frontend

No se encontró una corrección de producción que desbloquee arquitectura sin alterar responsabilidades o decisiones pendientes. Se agregaron exclusivamente pruebas, datos reales capturados y un script de comprobación:

- `src/tests/fixtures/python/casaEjemplo.real.json`: fuentes exactas, procedencia de commits, respuestas reales e interno runtime, sin simular Python.
- `src/tests/fixtures/python/architecturePending.real.json`: sondas explícitamente separadas del ejemplo, diagnósticos auténticos, árbol interno no publicable y error de serialización histórico.
- `src/tests/contracts/realPythonArchitecture.test.ts`: seis pruebas de reproducción de esas respuestas con validadores y adaptadores de producción, geometría Three.js y compatibilidad `.lumic`. Son pruebas de frontera sobre capturas, no ejecución viva de Python en cada corrida Vitest.
- `scripts/casa-ejemplo-webgl-probe.ts`: reproduce la respuesta real capturada, la valida y muestra ambas habitaciones con selección/deselección incremental.
- Este informe.

Estos cinco archivos y la anotación del SHA de cierre en `FASE_6B_OPTIMIZACION_VISOR.md` quedan **sin commit** después del commit autorizado de Fase 6B. No se modificó código de producción adicional ni archivos de compañeras.

### Prueba gráfica real del DTO de Python

Se agrupó el script con el esbuild instalado y se ejecutó en Chrome headless WebGL real a 800 × 600. Seis estados (tres selecciones y deselección de sala, selección y deselección de estudio) aprobaron: cero errores WebGL, árbol estable durante selección y DTO intacto. Se observaron 56/53 llamadas de dibujo para sala seleccionada/deseleccionada y 29/26 para estudio. El dato procede de Python real; el recorrido gráfico reproduce su captura JSON, sin volver a invocar Python desde el navegador. No se afirma haber repetido la UI Electron completa.

Para reproducir el backend sin cambiar ramas, cargar `sources` de la captura y enviar ambas solicitudes a `python -m services.worker`. Para comprobar el remoto, comparar cada fuente con `git show b74ac70:examples/CasaEjemplo/<archivo>`. La prueba TypeScript se ejecuta con `npm run test:run -- src/tests/contracts/realPythonArchitecture.test.ts --cache=false` desde el renderer. Los scripts WebGL se agrupan con esbuild y se ejecutan en navegador como los probes existentes; los HTML, bundles y perfiles temporales no se agregan al repositorio.

## Próxima fase propuesta

Validación final de esta preparación: **961 pruebas aprobadas en 74 archivos** del renderer (incluidas las seis nuevas), cuatro pruebas originales de Python aprobadas, TypeScript/lint y build aprobados, `git diff --check` y espacios/UTF-8 de archivos nuevos comprobados. Se reconfirmaron las 21 comparaciones WebGL de Fase 6B con cero diferencias. Continúan los avisos conocidos de canvas no implementado en jsdom y del chunk de producción superior a 500 kB; las pruebas gráficas reales se ejecutaron por separado. HEAD permanece en `40c38829c0a8d6d77681bb876ca803764f26c770`, sin staging de esta preparación ni commits adicionales.

Acordar con Grei/Gaby el contrato de salida arquitectónica antes de integrar: centro/borde y sentido del desplazamiento, unidades, identidad y fuente, comportamiento de propiedades ausentes y representación de pared declarada. Grei debe completar validación/publicación de esos datos. Después repetir una sonda declarada real por cuatro orientaciones y comprobar el DTO emitido, recortes, elevación, picking y navegación en el visor. Colisiones, distancia libre frente a puertas y obligatoriedad de propiedades quedan pendientes de sus reglas aprobadas. La persistencia arquitectónica requiere su acuerdo propio; no debe habilitarse cambiando silenciosamente `.lumic`.
