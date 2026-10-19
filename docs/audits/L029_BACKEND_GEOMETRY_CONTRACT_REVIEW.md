# L-029 — Revisión del contrato geométrico backend

## 1. Alcance y responsabilidad

Esta revisión delimita la responsabilidad de la integrante 2: ejecutar programas
Lumi y producir un `ScenePlan` interno resuelto, validado y trazable. La adaptación
visual, Three.js y Electron pertenecen a la integración frontend y no determinan
por sí solos la semántica del lenguaje.

Fuentes revisadas: `docs/ast_contract.md`, AST, parser, intérprete,
`spatial/scene_plan.py`, `spatial/scene_builder.py`, `SpatialValidator`, servicios y
pruebas Python. Los dos documentos personales sin seguimiento no forman parte de
esta revisión.

## 2. Contrato interno vigente

`ScenePlan` contiene habitaciones ordenadas. Cada `RoomPlan` conserva nombre,
dimensiones resueltas, elementos y ubicación. Cada `SpatialElement` conserva:

- `name`;
- `element_kind` (`floor`, `wall`, `door`, `window` u `object`);
- `object_type`, únicamente para objetos genéricos;
- propiedades resueltas y sus ubicaciones;
- posición y rotación finales opcionales;
- ubicación de su declaración.

Las dataclasses son inmutables. El builder mantiene borradores privados durante la
ejecución y produce tuplas ordenadas al finalizar. No guarda nodos AST ni evalúa
expresiones; esa responsabilidad pertenece al intérprete.

## 3. Paredes

### Datos disponibles

`WallNode` contiene `name`, `properties`, `file`, `line` y `column`. El parser
admite solamente `color` y `material`. El intérprete lo registra como
`SpatialElement(element_kind="wall", object_type=None)` dentro de la habitación
activa. Por pertenecer a `RoomPlan.elements`, la asociación con su habitación es
inequívoca.

### Datos no definidos

No existen orientación, extremos, longitud, altura, grosor, posición inicial ni
regla que relacione el nombre con una cara cardinal. Las dimensiones de la
habitación están disponibles en el `RoomPlan`, pero el contrato no autoriza
deducir de ellas cuál pared representa una declaración.

### Invariantes actuales

- Nombre único dentro de la habitación.
- Mismo nombre permitido en habitaciones distintas.
- Orden, propiedades y ubicación preservados.
- Ninguna geometría inventada.

## 4. Puertas

`DoorNode` ofrece únicamente nombre, propiedades y ubicación. Se registra como
`element_kind="door"` en la habitación activa. No define pared asociada,
desplazamiento, ancho, alto, sentido de apertura ni posición geométrica. El nombre
no se interpreta como orientación o referencia.

Para producir geometría visual harían falta cambios aprobados en gramática/AST o un
contrato geométrico externo. Ninguna de esas alternativas forma parte del contrato
actual de la integrante 2.

## 5. Ventanas

`WindowNode` tiene el mismo contrato mínimo: nombre, propiedades y ubicación. Se
registra como `element_kind="window"`. No contiene pared asociada, desplazamiento,
ancho, alto ni elevación. Como con puertas, esos valores no pueden derivarse de
forma compatible sin una decisión del equipo.

## 6. Pisos y muebles

`FloorNode` conserva nombre, propiedades y ubicación como `floor`. El contrato no
define espesor o malla; el piso puede asociarse a la habitación que lo contiene.

Los objetos genéricos separan `object_type` de `name`. `colocar` establece una
posición absoluta inicial; una segunda colocación falla. `mover` reemplaza la
posición de forma absoluta y exige colocación previa. `rotar` reemplaza la rotación
absoluta y puede ejecutarse antes de colocar. El plan conserva el último estado,
no el historial.

Aunque el builder puede aplicar operaciones por nombre a cualquier elemento, la
documentación AST denomina sus operandos “objeto”. Esta revisión no amplía esa
semántica a paredes o aberturas sin aprobación; las pruebas operativas permanecen
centradas en muebles.

## 7. Ejecución, validación y errores

- Cada ejecución crea un builder nuevo.
- Los cuerpos de habitaciones reutilizan el flujo normal de bloques, funciones,
  condiciones y ciclos.
- Los nombres se resuelven dentro de la habitación activa.
- Los fallos del builder producen `RUN_SPATIAL_OPERATION_FAILED` con ubicación y
  descartan el plan exitoso.
- Tras construir el plan, `SpatialValidator` valida dimensiones, vectores y
  propiedades mediante `SPA_INVALID_DIMENSION`, `SPA_INVALID_VECTOR` y
  `SPA_INVALID_PROPERTY`.
- `InterpreterResult` puede conservar un plan construido con diagnósticos
  espaciales para inspección. `ExecutionResult` no expone ese plan como publicable
  cuando la ejecución falla.

No se implementan colisiones, límites ni puertas bloqueadas; corresponden a L-035.

## 8. Evidencia de cumplimiento

Las pruebas existentes y ampliadas cubren:

- contrato inmutable y builder;
- todas las categorías espaciales;
- nombres, tipos, propiedades, orden y ubicaciones;
- estado final de colocar, mover y rotar;
- habitaciones y ejecuciones independientes;
- funciones locales/importadas y control de flujo;
- errores atómicos del builder;
- validación L-026;
- propagación y supresión del plan en `ExecutionResult`.

La prueba integral añadida usa `Lexer -> Parser -> Interpreter` con piso, pared,
puerta, ventana y mueble en el mismo programa. Las pruebas del servicio verifican
la propagación de elementos reservados y la ausencia de escena publicable ante una
dimensión inválida.

## 9. Decisiones pendientes del equipo

| Entidad | Decisión requerida | Impacto probable |
|---|---|---|
| Pared | Orientación o geometría explícita; relación con caras de habitación | Gramática, AST, ScenePlan y adaptador |
| Puerta | Pared, offset, ancho, alto y posible apertura | Gramática, AST, ScenePlan y DTO |
| Ventana | Pared, offset, ancho, alto y elevación | Gramática, AST, ScenePlan y DTO |
| Piso | Si requiere geometría/espesor semánticos | ScenePlan o capa visual |
| Operaciones | Si aplican formalmente a elementos reservados | Semántica, diagnósticos y pruebas |

Las alternativas son extender la sintaxis, aprobar propiedades nuevas o definir un
contrato geométrico separado. No se recomienda inferir valores desde nombres ni
usar valores por defecto como semántica.

## 10. Compatibilidad y conclusión

El contrato mínimo actual es compatible con el parser y programas existentes: no
cambia sintaxis, AST ni diagnósticos públicos. Las cuatro categorías reservadas se
registran sin pérdida dentro del `ScenePlan`; que todavía no puedan convertirse en
geometría Three.js es una limitación de la frontera visual, no del generador
interno.

La responsabilidad backend de la integrante 2 está completa dentro del contrato
aprobado y verificable. El cierre global de L-029 continúa separado: requiere que
el equipo defina la geometría visual faltante y que la integrante 3 complete o
verifique el consumo frontend/Electron.
