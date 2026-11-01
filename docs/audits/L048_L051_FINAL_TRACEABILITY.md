# L-048 y L-051 — Trazabilidad y checklist final

Fecha: 1 de noviembre de 2026.

## Trazabilidad principal

| Entregable | Evidencia | Estado |
|---|---|---|
| Arquitectura y contratos | `docs/architecture.md`, `docs/ast_contract.md`, auditoría L-002 | Verificado |
| Funciones e importaciones | pruebas semánticas/runtime y `docs/import_graph.md` | Verificado |
| L-026 | `spatial/spatial_validator.py`, pruebas espaciales | Verificado para dimensiones, vectores, propiedades y piso único |
| L-029 | auditoría end-to-end, `ScenePlanBuilder`, protocolo | Parcial: falta geometría publicable de pared/aberturas |
| L-032 | commit `9b900a2`, nueve casos documentados | Completo, rama separada |
| L-038 | commit `b74ac70`, CasaEjemplo y capturas reales | Completo e integrado en el `develop` local observado |
| Semántica espacial estática | `semantic_analyzer.py`, 15 pruebas nuevas | Parcial segura; limitación interprocedural conservada |
| L-035 | códigos documentados, sin implementación | Pendiente/bloqueada por contrato físico |
| Regresión | matriz L-041, Python `783 passed`, renderer `853 passed`, lint y build aprobados | Verificada; Electron principal tiene bloqueo ambiental documentado |
| Defensa | guía L-044 | Preparada |

## Contribuciones conservadas

- `9b900a2`: evidencia L-032; disponible en `docs/l032-test-evidence` y no
  incorporada automáticamente a esta rama.
- `b74ac70`: CasaEjemplo y evidencia L-038; base actual de `develop` y de esta rama.
- Los commits de Gaby y Pilar permanecen en el historial; no se reescribieron ni
  se copiaron mediante cherry-pick.

## Checklist

- [x] Rama de finalización creada desde `develop` limpio.
- [x] Commits L-032 y L-038 localizables.
- [x] L-038 no duplicada porque ya pertenece a la base observada.
- [x] Semántica espacial básica implementada sin ejecutar durante Compilar.
- [x] Suite Python completa aprobada: 783 pruebas.
- [x] Renderer aprobado: 68 archivos y 853 pruebas.
- [x] Verificación TypeScript (`lint`) aprobada.
- [x] Build Electron/Vite aprobado; solo advertencia de tamaño de bundle.
- [x] Diagnósticos conservan ubicación.
- [x] Compilar y Ejecutar permanecen separados.
- [x] `spatial_semantics_unavailable` no fue ocultado.
- [ ] Integrar formalmente L-032 con autorización.
- [ ] Aprobar contrato interno/DTO de elevación de ventanas.
- [ ] Aprobar dimensiones físicas normativas de muebles.
- [ ] Implementar y probar L-035.
- [ ] Resolver funciones espaciales interprocedurales para retirar la limitación.
- [ ] Repetir las pruebas del proceso principal Electron fuera del sandbox: en este
  entorno fueron 42 aprobadas y 31 bloqueadas por `EPERM` al resolver el perfil
  de Windows.
- [ ] Repetir demostración en la computadora de entrega.
- [ ] Crear commits, push y PR solamente con autorización.

## Bloqueos

1. El DTO TypeScript de `WindowModel` no contiene elevación y el renderer utiliza
   una altura central constante.
2. El catálogo de dimensiones de muebles es de presentación y provisional; no es
   base normativa suficiente para colisiones o límites.
3. No existe una decisión aprobada sobre severidad/recuperación de L-035.
4. Los PDFs originales están fuera del repositorio y el entorno actual no dispone
   de extractor PDF; los criterios no visibles no se declaran cumplidos.
