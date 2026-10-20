# Decisiones abiertas de integración ScenePlan

## Resumen para el equipo

La ruta end-to-end ya tiene un único generador basado en ejecución y un DTO consumible por el IDE. Las decisiones siguientes no deben resolverse con valores inventados en el adaptador o el visor.

## Decisiones que requieren aprobación

| Tema | Hecho verificado | Decisión pendiente | Riesgo si se asume |
|---|---|---|---|
| Unidades | TypeScript documenta metros y el visor no escala. Python conserva números Lumi sin unidad normativa local. | Ratificar metros, m² y m³ como contrato transversal. | Escenas con escala visual incorrecta. |
| Pared declarada | `WallNode` no tiene orientación, extremos, tamaño ni asociación geométrica. | Definir si referencia una cara o describe geometría propia y sus campos. | Confundir pared semántica con cerramiento visual derivado. |
| Puerta/ventana | AST solo aporta nombre, propiedades y ubicación; el DTO exige pared, offset, ancho y alto. | Definir sintaxis, AST, ScenePlan y unidades de aberturas. | Geometría arbitraria o pérdida de datos. |
| Dimensiones de muebles | El adaptador usa un catálogo visual y `[1,1,1]` genérico. | Aprobar catálogo, permitir dimensiones en lenguaje o delegarlas a assets del visor. | Backend y frontend producen tamaños diferentes. |
| Varias habitaciones | El DTO acepta `originOffset`; Python no lo emite y el visor muestra una habitación seleccionada. | Definir disposición global o mantener selección aislada. | Superposición o colocación no determinista. |
| Identidad | IDs dependen de archivo, línea, columna y nombre. | Determinar si deben sobrevivir ediciones/reformateo y si la habitación necesita `sourceRef`. | Selección o snapshots pierden correspondencia tras editar. |
| Rotación | Se usan grados y Euler XYZ observado en Three.js. | Ratificar orden y sentido positivo como contrato Lumi. | Diferencias al sustituir el renderer o componer rotaciones. |
| Colores/materiales | Se aceptan textos libres; Three.js interpreta un subconjunto. | Definir normalización, errores o fallback visual. | Un valor válido para Lumi puede no ser representable visualmente. |
| Estado `incomplete` | La ejecución espacial exitosa conserva la limitación `spatial_semantics_unavailable`. | Decidir cuándo el análisis espacial dejará de anunciarse incompleto. | UI puede comunicar un estado ambiguo aunque renderice. |
| Error del adaptador | Una escena válida internamente pero no representable produce `SERIALIZATION_ERROR`. | Mantener infraestructura o crear una política/diagnóstico contractual específico. | Experiencia inconsistente y diagnóstico poco accionable. |
| `.lumic` | Reutiliza el DTO del IDE dentro de otra envoltura. | Ratificar su esquema candidato y política de compatibilidad/versionado. | Artefactos futuros incompatibles. |

## Bloqueos actuales

1. `WallNode`, `DoorNode` y `WindowNode` no contienen los datos geométricos requeridos por `WallConfig`, `DoorModel` y `WindowModel`.
2. `scene_plan_dto` rechaza esas declaraciones mediante `SceneAdapterError`; no están completadas end-to-end.
3. Los cuatro muros que sí aparecen en el JSON son cerramientos visuales derivados de la habitación, no declaraciones del lenguaje.
4. No hay contrato global para organizar simultáneamente varias habitaciones.
5. El E2E de escena real pasó en Electron de desarrollo; sigue pendiente repetir el recorrido contra el paquete combinado y después Windows limpio. La importación de fixtures no cubre ese recorrido.

## Separación con L-035

Quedan fuera de L-029 y de esta documentación:

- colisiones entre objetos;
- objetos fuera de los límites;
- puertas bloqueadas;
- dimensiones físicas usadas para validación geométrica;
- recuperación o corrección automática de una escena inválida.

Los campos opcionales del frontend asociados a estos estados no significan que L-035 esté implementada.

## Compatibilidades y contradicciones observadas

- El modelo interno Python y el DTO no son idénticos por diseño. Usar `asdict(ScenePlan)` no produce una respuesta válida para el IDE.
- El DTO TypeScript permite `metadata`, `debugInfo`, `originOffset` y marcadores L-035 que Python no emite.
- El DTO requiere geometría de puertas/ventanas que el AST actual no puede expresar.
- `SpatialValidator` acepta enteros Python arbitrariamente grandes, pero el adaptador exige números finitos representables por JSON/JavaScript y puede rechazarlos.
- La habitación no expone `sourceRef`, mientras los objetos sí; el ID contiene ubicación pero no es un sustituto estable aprobado.

## Verificación pendiente antes de declarar integración completa

- Validar el flujo con el worker Python incluido en el paquete combinado. En desarrollo ya se verificaron habitación, piso, mueble, función, condición, ciclo y rotación final; conservar esta distinción de entorno.
- Ampliar la revisión visual de escala y ejes a más ejemplos; la prueba actual comprueba dimensiones, posiciones y conversión de 90° a radianes, no todas las composiciones angulares.
- Verificar selección de objeto y navegación por `sourceRef`.
- Verificar importación/exportación `.lumic` con una escena producida por Python, no solo fixtures.
- Acordar y probar el contrato geométrico antes de habilitar pared, puerta o ventana declaradas.

## Recomendación inmediata

La referencia técnica está en `SCENEPLAN_CONTRACT.md`, `SCENEPLAN_THREEJS_INTEGRATION_GUIDE.md` y los ejemplos. La integración conserva `ScenePlan` como única entrada del viewport y el adaptador en la frontera Python. Cualquier cambio de tipos compartidos requiere coordinación antes de tocar AST, protocolo o Three.js.
