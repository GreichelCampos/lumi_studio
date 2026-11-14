# L-041 — Matriz de regresión

Fecha de ejecución: 1 de noviembre de 2026.

Comando general:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

Resultado real: `783 passed` en 3.02 segundos. Se produjo una advertencia ambiental
porque pytest no pudo escribir `.pytest_cache`; no hubo fallos.

## Casos trazables

| # | Área | Prueba real | Resultado |
|---:|---|---|---|
| 1 | Lexer | `tests/lexer/test_lexer.py::test_keywords` | Aprobada (parametrizada) |
| 2 | Parser | `tests/parser/test_parser.py::test_variable_declaration` | Aprobada |
| 3 | Parser espacial | `tests/parser/test_spatial_parser_contract.py::test_wall_preserves_orientation_and_optional_properties` | Aprobada |
| 4 | Parser espacial | `tests/parser/test_spatial_parser_contract.py::test_door_accepts_complete_properties_in_any_order` | Aprobada |
| 5 | Parser espacial | `tests/parser/test_spatial_parser_contract.py::test_window_accepts_elevation_and_measure_expressions_unchanged` | Aprobada |
| 6 | Símbolos | `tests/semantic/test_symbol_table.py::test_defines_and_resolves_declarations` | Aprobada |
| 7 | Funciones | `tests/semantic/test_function_semantics.py::test_function_call_before_declaration` | Aprobada |
| 8 | Funciones | `tests/semantic/test_function_semantics.py::test_incompatible_argument_reports_diagnostic_at_argument_location` | Aprobada |
| 9 | Imports | `tests/semantic/test_import_semantics.py::test_calls_imported_function_through_real_pipeline` | Aprobada |
| 10 | Ciclos de import | `tests/integration/test_circular_import_pipeline.py::test_circular_dependency_stops_pipeline_at_parsing` | Aprobada |
| 11 | Semántica espacial | `tests/semantic/test_spatial_semantics.py::test_room_dimensions_must_be_numeric_and_keep_location` | Aprobada |
| 12 | Semántica espacial | `tests/semantic/test_spatial_semantics.py::test_vector_components_are_checked_from_spatial_operations` | Aprobada |
| 13 | Semántica espacial | `tests/semantic/test_spatial_semantics.py::test_duplicate_elements_share_one_room_namespace` | Aprobada |
| 14 | Semántica espacial | `tests/semantic/test_spatial_semantics.py::test_only_one_floor_is_allowed_per_room_at_second_location` | Aprobada |
| 15 | Semántica espacial | `tests/semantic/test_spatial_semantics.py::test_orientation_domain_is_validated_semantically` | Aprobada |
| 16 | Intérprete | `tests/interpreter/test_function_runtime.py::test_function_can_be_called_before_declaration` | Aprobada |
| 17 | ScenePlan | `tests/integration/test_scene_plan_runtime.py::test_evaluates_room_dimension_expressions` | Aprobada |
| 18 | Control espacial | `tests/integration/test_spatial_control_flow_runtime.py::test_true_if_places_element` | Aprobada |
| 19 | Control espacial | `tests/integration/test_spatial_control_flow_runtime.py::test_for_executes_repeated_absolute_moves_and_keeps_final_position` | Aprobada |
| 20 | Función espacial | `tests/integration/test_spatial_control_flow_runtime.py::test_imported_function_operates_on_active_room_builder` | Aprobada |
| 21 | L-026 | `tests/spatial/test_spatial_validator.py::test_valid_room_succeeds` | Aprobada |
| 22 | L-026 | `tests/spatial/test_spatial_validator.py::test_accumulates_dimension_vector_and_property_errors` | Aprobada |
| 23 | Protocolo | `tests/protocol/test_runtime_scene_response.py::test_runtime_scene_reaches_protocol_with_final_object_state` | Aprobada |
| 24 | Piso único | `tests/protocol/test_runtime_scene_response.py::test_second_floor_blocks_execution_with_semantic_diagnostic` | Aprobada |
| 25 | CasaEjemplo | `tests/integration/test_casa_ejemplo.py::test_casa_ejemplo_protocol_serializes_real_scene_plan` | Aprobada |

Los nombres se refieren a pruebas del repositorio. La suite completa, no una
selección simulada, fue la fuente del resultado.

## Verificaciones del cliente de escritorio

- Renderer: `68` archivos y `853` pruebas aprobadas con `npm run test:run`.
- TypeScript: `npm run lint` aprobado para el proceso principal y el renderer.
- Build: compilación Electron/Vite aprobada; Vite emitió únicamente una
  advertencia no bloqueante por un chunk mayor de 500 kB.
- Pruebas del proceso principal: `42` aprobadas y `31` bloqueadas porque el
  entorno restringido rechazó `realpath` sobre el perfil de Windows con
  `EPERM`. Los 31 fallos comparten esa causa ambiental; no se alteraron las
  protecciones de rutas ni las pruebas para ocultarla.
