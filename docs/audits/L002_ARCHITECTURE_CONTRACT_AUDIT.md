# L-002 — Auditoría de arquitectura y contratos

Fecha: 1 de noviembre de 2026.

## Resultado

La arquitectura de Lumi está separada en componentes verificables y el recorrido
principal está implementado:

```text
fuentes .lumi
→ Lexer → Parser → AST → SemanticAnalyzer
→ Interpreter → ScenePlanBuilder → SpatialValidator
→ ExecutionService → protocolo JSON → Electron/React/Three.js
```

## Contratos comprobados

| Componente | Entrada | Salida | Evidencia |
|---|---|---|---|
| `Lexer` | texto y archivo | secuencia de `Token` con ubicación | `lumi_language/lexer.py`, `docs/token_contract.md` |
| `Parser` | tokens y resolver opcional | `ProgramNode`, diagnósticos e imports | `lumi_language/parser.py`, `lumi_language/ast_nodes.py` |
| `SemanticAnalyzer` | AST y catálogo importado | `SemanticAnalysisResult` | `lumi_language/semantic_analyzer.py` |
| `Interpreter` | AST analizado y catálogo importado | salida, diagnósticos y `ScenePlan` | `lumi_language/interpreter.py` |
| `ScenePlanBuilder` | valores espaciales resueltos | `ScenePlan` inmutable | `spatial/scene_builder.py` |
| `SpatialValidator` | `ScenePlan` | diagnósticos espaciales | `spatial/spatial_validator.py` |
| `CompilerService` | proyecto en memoria y principal explícito | `CompilationResult` | `services/compiler_service.py` |
| `ExecutionService` | `CompilationResult` ejecutable | `ExecutionResult` | `services/execution_service.py` |
| Protocolo | solicitud JSON validada | respuesta JSON correlacionada | `services/protocol/` |
| IDE | DTO validado | consola y escena Three.js | `apps/desktop/renderer/src/` |

## Separaciones correctas

- Compilar analiza y no ejecuta instrucciones.
- Ejecutar reutiliza el resultado analizado y crea un intérprete aislado.
- El AST no contiene objetos Three.js ni tipos del IDE.
- El `ScenePlan` interno no es el DTO; `scene_plan_dto` es la frontera.
- Los errores del programa usan `Diagnostic`; protocolo e infraestructura conservan
  errores separados.
- El renderer no reconstruye semántica desde el código fuente.

## Pendientes comprobables

1. La semántica espacial estática básica ya recorre habitaciones, elementos,
   propiedades y vectores, pero no resuelve interproceduralmente nombres de
   elementos usados por funciones globales/importadas en una habitación activa.
2. `spatial_semantics_unavailable` debe conservarse hasta cerrar esa cobertura y
   decidir la relación con L-035.
3. Pared, puerta y ventana conservan geometría como propiedades genéricas del AST;
   todavía no existe un modelo interno geométrico tipado ni adaptación completa.
4. L-035 no está implementada.
5. Las trazas Python del depurador no están disponibles.

## Evidencia de regresión

La suite Python ejecutada el 1 de noviembre de 2026 terminó con `783 passed`.
Esta cifra incluye las 15 pruebas nuevas de semántica espacial y las pruebas del
protocolo actualizadas para bloquear una segunda declaración de piso antes de la
ejecución.

## Conclusión

L-002 está consolidada como arquitectura y contrato documentado. No implica que
las funcionalidades posteriores L-035 o la geometría de aberturas estén completas.
