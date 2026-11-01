# Estado maestro de finalización — Integrante 2

Fecha: 1 de noviembre de 2026. Entrega objetivo: 11 de noviembre de 2026.

La matriz usa los 17 identificadores asociados históricamente al trabajo de la
integrante 2 y evidencia observable del repositorio. El PDF original de tareas no
está versionado y no pudo extraerse en este entorno; por ello los nombres y
porcentajes deben contrastarse con el cronograma antes de la entrega.

| Tarea | Estado | % | Evidencia y pruebas | Pendiente/dependencia | Tiempo |
|---|---|---:|---|---|---:|
| L-002 Arquitectura | Consolidada | 95 | Auditoría L-002, `docs/architecture.md`, 783 pruebas | Revisión académica final | 1 h |
| L-005 Propuesta/investigación | Borrador completo | 90 | Guion de 3 min y preguntas | Validación con propuesta formal/equipo | 1 h |
| L-008 Contratos AST/diagnósticos | Verificada | 100 | `docs/ast_contract.md`, AST y pruebas | — | 0 h |
| L-011 Tabla de símbolos/alcances | Verificada | 100 | `symbol_table.py`, pruebas semánticas | — | 0 h |
| L-014 Intérprete | Verificada | 100 | intérprete, control de flujo y pruebas | — | 0 h |
| L-017 Tipos/semántica | Verificada | 100 | `TypeChecker`, diagnósticos y pruebas | — | 0 h |
| L-020 Funciones | Verificada | 100 | semántica/runtime local e importada | — | 0 h |
| L-023 Importaciones/ciclos | Verificada | 100 | grafo, caché y ciclo controlado | — | 0 h |
| L-026 Validador espacial | Completa en alcance aprobado | 100 | dimensiones, vectores, propiedades, piso único | No incluye L-035 | 0 h |
| L-029 ScenePlan/integración | Parcial avanzada | 85 | auditoría end-to-end, CasaEjemplo, Electron | Geometría de pared/aberturas y contrato compartido | 1–3 días |
| L-032 Evidencia de pruebas | Completa | 100 | commit `9b900a2`, 9 casos | Integración autorizada posterior | 0.5 h |
| L-035 Geometría avanzada | Bloqueada | 10 | códigos y alcance documentados | Dimensiones físicas, aberturas, severidad | 2–4 días tras acuerdo |
| L-038 CasaEjemplo | Completa | 100 | commit `b74ac70`, 4 pruebas, capturas Electron | Repetición en equipo de entrega | 0.5 h |
| L-041 Regresión | Verificada con reserva ambiental | 100 | Python 783, renderer 853, lint y build aprobados | Repetir 31 pruebas Electron bloqueadas por `EPERM` fuera del sandbox | 1 h |
| L-044 Defensa | Preparada | 90 | guía, 3 ejercicios y preguntas | Ensayo cronometrado | 1–2 h |
| L-048 Documentación final | Avanzada | 85 | trazabilidad, auditorías y anexos | Incorporar decisiones/fallos finales | 2–3 h |
| L-051 Verificación final | En curso | 75 | checklist, Python, renderer, lint y build | Electron sin restricción, integración y presentación | 1 día |

Promedio aritmético provisional: **90.0 %**. No significa que L-035 ni la
geometría pendiente estén completas; muestra que la mayoría de entregables previos
tienen código y evidencia.

## Trabajo realizado en la rama de finalización

- Semántica estática para habitaciones, dimensiones, vectores y propiedades.
- Ámbito de elementos por habitación, duplicados y referencias inexistentes.
- Piso único detectado antes de ejecutar.
- Orientaciones cardinales validadas.
- Recorrido dentro de control de flujo y comprobación segura de funciones.
- 15 pruebas semánticas nuevas.
- Actualización del contrato de diagnósticos.
- Documentación L-002, L-005, L-041, L-044, L-048 y L-051.

## Decisiones pendientes

### Gaby

- Confirmar si las propiedades geométricas siguen como `SpatialPropertyNode` o se
  convertirán en campos AST tipados.
- Confirmar propiedades obligatorias y regla de pared única por orientación.

### Pilar

- Definir `elevacion` en `WindowModel` y su interpretación por Three.js.
- Confirmar cambios de protocolo/renderer para paredes y aberturas.

### Equipo

- Aprobar unidades y dimensiones físicas normativas.
- Aprobar criterios y severidad de L-035.
- Decidir cuándo la cobertura permite retirar
  `spatial_semantics_unavailable`.

## Orden recomendado hasta el 11 de noviembre

1. Revisar y aprobar contratos compartidos.
2. Completar adaptación geométrica L-029.
3. Implementar L-035 únicamente con dimensiones normativas.
4. Resolver análisis interprocedural espacial y reevaluar la limitación.
5. Integrar L-032 con autorización.
6. Repetir las pruebas Electron bloqueadas por el entorno y la demostración en
   la computadora de entrega; Python, renderer, lint y build ya fueron ejecutados.
7. Actualizar trazabilidad final y ensayar la defensa en el equipo de entrega.
