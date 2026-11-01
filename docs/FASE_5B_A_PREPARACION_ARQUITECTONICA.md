# Fase 5B-A — preparación de elementos arquitectónicos

Fecha: 2026-10-31, America/Costa_Rica. Estado: auditoría y propuesta para revisión del equipo. No es un contrato aprobado ni una implementación de geometría declarada.

## 1. Repositorio y disponibilidad de Gaby

- Estado inicial: rama develop; HEAD real ec33c31f7b800d1e8be7e612c770e22bbd776ce4, igual a origin/develop antes y después de git fetch origin.
- El HEAD anterior 97018de66a9fa0593c93e84097d803ef2ef4b802 está incluido como padre del avance de Gaby.
- Nueva rama: feature/architectural-elements-integration, creada desde develop actualizado mediante comprobación fast-forward-only. No se realizó merge, push ni commit.
- Único archivo/directorio local previo: apps/desktop/renderer/.vite/ sin seguimiento. No se edita ni se incluye.
- Gaby: origin/feature/spatial-parser-ast apunta a ec33c31; ese commit ya está en develop. Autor GabyGamboa08, mensaje feat: extend lumi spatial property parsing. Cambia únicamente lumi_language/parser.py y tests/parser/test_spatial_parser_contract.py. Conserva los nodos AST existentes; amplía propiedades contextuales y agrega 25 pruebas.
- La rama remota origin/feature/spatial-grammar también existe, pero no debe confundirse su presencia con la semántica terminada de Grei. Esta auditoría no encontró en develop un DTO arquitectónico nuevo aprobado.

## 2. Archivos relevantes y alcance actual

| Área | Archivos | Hallazgo |
| --- | --- | --- |
| Tipos IDE | apps/desktop/renderer/src/types/domain/spatial.ts | WallConfig con north/south/east/west; DoorModel y WindowModel con wall, position, width, height; sin elevación ni identidad de pared |
| Validación de escenas | apps/desktop/renderer/src/services/compiler/contracts/sceneStructure.ts, structureChecks.ts, contractValidator.ts | Validación estructural y referencias espaciales; no validación semántica de solapes ni límites de aberturas |
| Validación de visor | apps/desktop/renderer/src/components/viewport/helpers/validateViewportScene.ts | Reutiliza reglas actuales/legacy antes de construir Three.js |
| Geometría | apps/desktop/renderer/src/components/viewport/factories/RoomFactory.ts, OpeningFactory.ts | Cuatro paredes automáticas segmentadas, puertas y ventanas, estados de selección; estilos de pared existentes |
| Cálculos de aberturas | apps/desktop/renderer/src/components/viewport/helpers/openingLayout.ts | Desplazamiento centrado; espesor visual 0,16 m; centro de ventana fijo 1,6 m; recortes por unión de rectángulos |
| Selección | ThreeSceneManager.ts, interaction/ObjectSelectionController.ts, Viewport3D.tsx, ObjectPropertiesCard.tsx bajo components | Puertas/ventanas registradas por ID y propiedades navegables por sourceRef; paredes no registradas ni incluidas en SelectedEntity |
| Artefactos | apps/desktop/renderer/src/services/storage/LumicFileService.ts; services/compiler/contracts/lumicStructure.ts; types/domain/contracts.ts | Importación 1.0.0/1.1.0; exportación actual 1.1.0; ScenePlan.version es independiente |
| Esquemas publicados | docs/contracts/lumic/v1.0.0 y v1.1.0 | Opening común sin elevación; WallFace exige color; additionalProperties permite extensiones pero no les da semántica |
| Transporte | apps/desktop/electron/pythonWorker.ts; renderer/src/services/integration/protocol/{responseValidator,scenePayload,types}.ts | Electron y renderer comparten validador de respuesta; diagnóstico con lista estricta de campos |
| Adaptación UI | apps/desktop/renderer/src/services/integration/resultAdapter.ts | Mantiene código y ubicación, SPATIAL → espacial; severity=unspecified; no inventa severidad de lenguaje |
| Backend leído, no modificado | spatial/{scene_plan,spatial_validator}.py; services/protocol/{scene_adapter,adapters,dispatcher}.py | ScenePlan interno Python distinto del DTO JSON del IDE; el adaptador rechaza wall/door/window |
| Parser/AST leído, no modificado | lumi_language/{parser,ast_nodes}.py; tests/parser/test_spatial_parser_contract.py | WallNode/DoorNode/WindowNode: name, properties, file, line, column |

Rutas abreviadas de la tabla son relativas al repositorio o al prefijo indicado.

## 3. Funcionalidades existentes y huecos

Implementado en frontend:
- Habitaciones rectangulares con dimensiones [ancho X, largo Z, alto Y], suelo superior en Y=0.
- Paredes automáticas en cuatro orientaciones. La cara interior coincide con el límite de habitación; el espesor se extiende hacia afuera.
- Apariencia individual por cara: color obligatorio en DTO y material opcional. Esto es personalización de estilo, no paredes declaradas con identidad o geometría independiente.
- Recorte real de huecos de puertas y ventanas; unión de huecos superpuestos sin doble sustracción.
- DoorModel.position y WindowModel.position son desplazamientos horizontales desde el centro de la pared, pese al comentario ambiguo «center or origin» del tipo de puerta.
- Puertas con borde inferior en cero; ventanas centradas en 1,6 m. El borde inferior histórico de ventana depende de su alto: 1,6 - height/2.
- Selección de puertas/ventanas, resalte y tarjeta con orientación, posición y dimensiones. SourceRef opcional permite navegar al código.
- .lumic conserva los datos actuales y admite objetos colocados/sin colocar.

Pendiente:
- Relación entre paredes declaradas, caras automáticas y nodos fuente; IDs de paredes, nombres y navegación.
- Transporte de elevación y aplicación coherente tanto al mesh de ventana como al recorte de pared.
- Color/material en aberturas: actualmente sus fábricas usan colores/materiales visuales fijos, salvo resalte; no leen esas propiedades del DTO.
- Propiedades arquitectónicas personalizadas y diagnósticos de solape/fuera de límites en la UI.
- Validadores de campos nuevos y comprobaciones semánticas coordinadas con Grei. Hoy la validación estructural admite una abertura fuera de límites o superpuesta; el renderer recorta el hueco a la cara, pero conserva completo el mesh. No constituye validación del lenguaje.
- Foco individual de puertas/ventanas: el botón actual sin posición de mueble vuelve a encuadrar la habitación. No tiene un ajuste específico a la abertura.
- Geometría de paredes fuera del rectángulo, colisiones, giro arbitrario de paredes o aberturas: fuera de esta etapa.

Backend actual:
- Parser acepta orientacion como literal de texto, no valida los cuatro valores semánticos. Incluso "diagonal" puede construir AST; no significa orientación válida.
- Parser acepta expresiones para medidas y duplicados de propiedades producen error sintáctico. Pared: orientacion/color/material. Puerta: orientacion/ancho/alto/desplazamiento/color/material. Ventana: las mismas más elevacion. No hay ancho/alto/espesor de pared ni elevacion de puerta en la gramática implementada.
- SpatialValidator._validate_element_properties solo admite color/material. Orientación y medidas arquitectónicas aún no están integradas en esa validación.
- scene_adapter._room_dto genera cuatro caras neutras y listas doors/windows vacías para escenas soportadas; si recibe elementos wall/door/window lanza SceneAdapterError. Dispatcher lo publica como error de infraestructura SERIALIZATION_ERROR, no como diagnóstico SPATIAL. No debe ocultarse ese error ni convertir declaraciones arquitectónicas en muebles.

## 4. Propuesta exacta, candidata y NO implementada

Se propone minimizar diferencias con el DTO actual. Los nombres nuevos listados abajo son propuestas que requieren aprobación; no se presentan como campos ya acordados.

### 4.1 Mantener estructuras y traducción de propiedades

Mantener RoomModel.walls como objeto de cuatro caras; no convertirlo en arreglo ni introducir una segunda colección de paredes.

| Elemento | Campos existentes que se conservan | Extensiones candidatas opcionales |
| --- | --- | --- |
| WallFace | color: string; material?: string | id?: string; name?: string; sourceRef?: SourceReference |
| DoorModel | id: string; wall: norte/sur/este/oeste; position: number; width: number; height: number; sourceRef?: SourceReference | name?: string; color?: string; material?: string |
| WindowModel | mismos campos actuales de abertura | name?: string; elevation?: number; color?: string; material?: string |

La identidad de orientación de WallFace viene de su clave existente: north=norte, south=sur, east=este, west=oeste. No añadir un segundo campo wall/orientation redundante.

Mapeo propuesto de AST a DTO:
- orientacion → clave de walls o Opening.wall.
- desplazamiento → Opening.position; no crear otro offset ni modificar el origen.
- ancho → width; alto → height.
- elevacion → WindowModel.elevation, en metros desde Y=0 al borde inferior.
- color/material → propiedades del mismo nombre, resueltas por backend, sin expresiones en JSON.
- name del nodo → name candidato; ubicación del nodo → sourceRef.
- No añadir position vectorial, rotation, placed ni dimensiones de pared. La geometría de cada cara se deduce de RoomModel.dimensions como hoy.

Para paredes declaradas: propuesta de sobreescribir únicamente la apariencia/identidad de la orientación correspondiente, conservando las otras tres caras automáticas. La repetición de dos declaraciones para la misma orientación debe diagnosticarse por backend; falta aprobar si es error y su código. No usar «última gana» silenciosamente. Las caras automáticas sin declaración no reciben sourceRef inventada. Las caras sin id siguen renderizándose, sin selección arquitectónica; no cambiar archivos antiguos para asignarles identidad persistente.

Las propiedades de apariencia en el lenguaje son opcionales. Mantener color obligatorio en el DTO de pared: el productor resuelve el valor por defecto ya usado por scene_adapter (#f1f5f9) cuando no se declara. No debilitar unilateralmente WallFace.color. En aberturas, ausencia de apariencia mantiene los materiales visuales actuales. Aprobar si material se aplica a marco/hoja, vidrio o ambos; recomendación: marco/hoja y vidrio con perfil óptico existente.

### 4.2 Coordenadas y fórmula de colocación

Unidades en metros; números finitos; width y height > 0. Habitación centrada en piso [0,0,0]. W=ancho X, L=largo Z, H=alto Y. Para desplazamiento horizontal p, espesor visual t=0,16 y centro vertical cy:

| wall | posición mundial del centro | rotación Y existente |
| --- | --- | --- |
| norte | [p, cy, -L/2-t/2] | 0 |
| sur | [p, cy, L/2+t/2] | 0 |
| este | [W/2+t/2, cy, p] | π/2 |
| oeste | [-W/2-t/2, cy, p] | π/2 |

El sentido positivo de p sigue +X en norte/sur y +Z en este/oeste. No invertir el signo según la vista interior de la pared. Puerta: cy=height/2, borde inferior=0. Ventana con elevation explícita: cy=elevation+height/2.

Para escenas históricas SIN elevation: conservar cy=1,6 y por tanto borde inferior=1,6-height/2. No interpretar ausencia como elevation=0 ni elevar automáticamente el archivo a una nueva versión. No escribir el fallback en el ScenePlan importado. Esta distinción necesita coordinar ventana mesh y wallSegments usando una única función interna cuando se apruebe el campo.

### 4.3 Validez y diagnósticos propuestos sin códigos inventados

Para declaraciones nuevas, proponer:
- orientación exacta en el conjunto norte/sur/este/oeste;
- medidas positivas y finitas, desplazamiento finito, elevación finita >= 0;
- span=W para norte/sur y span=L para este/oeste;
- límites horizontales: -span/2 <= p-width/2 y p+width/2 <= span/2;
- límites verticales: bottom >= 0 y bottom+height <= H, con bottom=0 para puerta y elevation para ventana;
- solape de interiores en una misma pared cuando las intersecciones horizontal y vertical tienen longitud estrictamente positiva; proponer permitir contacto en bordes, sujeto a aprobación de tolerancia numérica y severidad;
- aberturas en paredes de distintas orientaciones no se comparan como solape coplanar;
- política de propiedades omitidas, duplicidad de orientaciones y errores de límites/solape corresponde a semántica, no al renderer.

Formato actual del diagnóstico Python: category, code, file, line, column, description; suggestion opcional. Categoría SPATIAL ya existe. SPA_INVALID_PROPERTY, SPA_INVALID_DIMENSION, SPA_INVALID_VECTOR y SPA_MULTIPLE_FLOORS existen; no se asigna ninguno de ellos unilateralmente a reglas nuevas ni se inventan códigos de aberturas. Equipo debe confirmar mapeo/códigos y política de error/advertencia. No introducir severity, elementId, roomId o sourceRef en el diagnóstico wire: su validador tiene lista estricta y eso requeriría otro acuerdo.

Reutilizar ubicaciones de la propiedad cuando la causa es una medida; ubicación del nodo cuando es una declaración/orientación duplicada, sujeto a cómo Grei preserve las referencias al evaluar. El IDE ya presenta ubicación y código. La asociación por ID con resaltado arquitectónico requiere decisión adicional si se quiere transportar IDs diagnósticos.

No alterar reglas de coherencia del protocolo: solo se publica scenePlan con estado completed y capabilities.scenePlan=true. No fabricar una escena vacía para simular éxito de una declaración no soportada. El frontend conserva severity=unspecified mientras el protocolo no publique severidad.

### 4.4 IDs, referencias y compatibilidad

Proponer reutilizar la estrategia existente de backend para ID: prefijo element + archivo + línea + columna + nombre, sin generarlos en UI. Evita colisiones entre entidades del mismo documento; no garantiza estabilidad al insertar líneas y no debe prometerse identidad permanente entre compilaciones. El productor debe evitar IDs repetidos en una escena para picking; los validadores históricos no imponen hoy una regla global nueva de unicidad.

SourceReference mantiene file:string, line>=1, column opcional >=1 en DTO. El AST ya aporta columna; recomendar que backend siempre la emita. Las escenas viejas sin referencia conservan selección por ID, con navegación ausente. No exigir los campos nuevos al importar archivos existentes.

Mantener versiones actuales sin modificación: protocolo 1.0.0, schemaVersion de exportación .lumic 1.1.0, importación 1.0.0/1.1.0, ScenePlanDTO backend version 1.0.0. No implica que la extensión de elevation quede automáticamente autorizada para esas versiones. Es una decisión de contrato pendiente.

Riesgo principal: objectFields y los esquemas de .lumic toleran propiedades extra; el JSON puede conservar elevation y pasar validación antigua, pero el renderer antiguo la ignora y dibuja a 1,6 m. Tolerancia estructural NO equivale a compatibilidad visual. Antes de emitir elevation en producción hay que aprobar capacidad/versionado o estrategia de rechazo explícito. No emitir ni borrar datos en esta fase. Validadores deben comprobar los nuevos campos cuando se activen, sin depender de additionalProperties.

## 5. Riesgos y decisiones que requieren aprobación

1. Confirmar con Grei el DTO propuesto, especialmente el nombre elevation y ausencia con fallback histórico.
2. Aprobar estrategia de versiones/capacidades para lectores antiguos que ignorarían elevación. No se propone un número de versión nuevo como definitivo.
3. Confirmar cuatro paredes automáticas con personalización por orientación; repetición de orientación y propiedades faltantes.
4. Definir límites y solapes como error/advertencia, tolerancia, contacto de bordes y códigos oficiales. No confundir recorte gráfico actual con aceptación semántica.
5. Acordar IDs/nombres/sourceRef de paredes y navegación; no asignar referencias ficticias a caras automáticas.
6. Definir alcance visual de color/material en puertas y ventanas.
7. Acordar si habrá IDs en diagnósticos del protocolo y cambios al debugger. Los eventos de debug actuales tienen un conjunto cerrado; no inventar eventos arquitectónicos.
8. Confirmar que no se requiere geometría arbitraria de paredes: la gramática actual de pared no admite dimensiones y el DTO solo representa una habitación rectangular.
9. Conservar fallback de elevación histórica incluso si su altura produce una abertura parcialmente fuera del muro; validar declaraciones nuevas no debe reinterpretar silenciosamente los archivos antiguos.

## 6. Pruebas preparatorias y matriz siguiente

Nuevo archivo: apps/desktop/renderer/src/tests/components/viewport/ArchitecturalPreparation.test.ts. Once pruebas automatizadas de comportamiento actual, sin cambiar producción:
- 4 orientaciones con habitación no cuadrada y desplazamiento negativo; cotejo de helper y mesh real.
- 2 alturas de ventana verifican centro histórico 1,6 y borde inferior dependiente de height.
- 1 abertura parcialmente fuera de límites: recorte de pared, mesh sin recortar, DTO inmutable y validador solo estructural.
- 1 unión de puertas solapadas, sin doble sustracción y sin diagnóstico semántico inventado.
- 1 configuración de cuatro caras con estilo personalizado y dimensiones inmutables.
- 2 roundtrips .lumic 1.0.0/1.1.0 con puertas, ventanas y estilos.

Pruebas existentes relevantes:
- factories/ViewportGeometry.test.ts: cuatro caras automáticas, recortes y rayos atravesando huecos en cuatro orientaciones, solapes, estilos y dimensiones.
- ViewportInteraction.test.ts: picking y controles.
- ThreeSceneManager.test.tsx: recursos, selección, validación/recuperación.
- contracts/{lumicStructure,contractSerialization,unplacedObjects,protocolResponse}.test.ts y services/storage/LumicFileService.test.ts: archivos históricos, referencias, geometría estructural y protocolo.
- Python tests/parser/test_spatial_parser_contract.py: 25 pruebas de Gaby ejecutadas sin modificar los archivos.

Tras aprobación, añadir fixtures y pruebas reales para: elevación explícita cero/no cero; borde superior exacto; cada signo de desplazamiento en cuatro caras; paredes declaradas con IDs y sourceRef; duplicidad de orientación; orientación desconocida; medidas inválidas; límites/solapes y contacto según política oficial; propiedades en expresiones evaluadas por backend; navegación al código; resaltado y foco de aberturas; import/export con elevación; diagnósticos Python→Electron→UI y recuperación tras escena inválida. No se añaden pruebas omitidas ni fixtures que pretendan que estos campos ya están aprobados.

## 7. Validación de esta preparación

- Pruebas nuevas aisladas: 11 aprobadas.
- TypeScript/lint (aplicación y pruebas): correcto.
- Pruebas de Gaby: 25 aprobadas, ejecutadas con pytest sin caché ni escritura de bytecode.
- Suite completa renderer con benchmark optativo: 69 archivos y 867 pruebas aprobadas, 30,16 segundos. Incluye las 11 nuevas y las pruebas existentes de viewport, protocolo, importación/exportación y recuperación.
- Build de producción: correcto, 7,36 segundos. Aviso existente: chunk JS de 1.105,94 kB minificado (287,85 kB gzip), mayor que el umbral de 500 kB.
- git diff --check: correcto; los dos archivos nuevos se comprobaron además por espacios finales y codificación UTF-8 antes de entregar.
- Sin pruebas WebGL nuevas: las pruebas preparatorias usan geometrías/matrices Three.js reales con getContext de canvas simulado para la textura del piso; no prueban GPU ni renderizado gráfico.
- Comandos renderer: npm run test:run -- --cache=false --maxWorkers=4 (con LUMI_VIEWPORT_BENCH=1); npm run lint; npm run build.
- No se modifican tipos, esquemas, fábricas, parser, intérprete, semántica, adaptadores ni protocolo en esta etapa.

## 8. Plan de implementación siguiente

1. Revisión conjunta: Gaby confirma propiedades AST y Grei resuelve semántica, DTO, IDs, defaults y diagnósticos. Aprobar versión/capacidad antes de emitir campos nuevos.
2. Preparar ejemplos wire aprobados y pruebas cruzadas del adaptador Python y validadores TS/.lumic; mantener fixtures históricos intactos.
3. Implementar en renderer un cálculo común de borde inferior/centro de ventana y usarlo tanto en mesh como en recorte; aplicar apariencia opcional. No cambiar dimensiones ni posición del ScenePlan.
4. Incorporar identidad de caras declaradas a picking/propiedades/navegación, con cuatro paredes automáticas como fallback; mejorar foco individual arquitectónico sin romper OrbitControls.
5. Integrar diagnósticos aprobados en consola y navegación sin alterar códigos/severidades del backend.
6. Validar parser→semántica→DTO→Electron→renderer→.lumic, pruebas de recuperación y WebGL en distintas escalas; revisar regresión de Fase 6A y liberación de recursos.
7. Revisión humana del diff y evidencia antes de autorizar commit/merge/publicación. Esta fase se detiene en propuesta y pruebas del comportamiento vigente.
