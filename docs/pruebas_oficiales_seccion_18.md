# Evidencia de las 20 pruebas oficiales — sección 18

Fecha de ejecución: 2026-11-16. Entorno: Windows, Python 3.13.15 y pytest
9.1.1. Todos los resultados de esta matriz proceden de `CompilerService` y
`ExecutionService`; no se usaron mocks.

## Alcance y reutilización

Antes de añadir la batería se revisaron las suites de lexer, parser, semántica,
intérprete, compilación/ejecución multiarchivo, ciclos, `ScenePlan` y los
proyectos de ejemplo. Para evitar duplicación, PV-01 a PV-05, ES-01 a ES-05 y
EM-01 a EM-05 ejecutan fuentes que ya existían. Las nuevas fuentes se limitan a
los escenarios de importación y al proyecto integral que necesitaban entradas
multiarchivo estables.

La cobertura preexistente relevante se encuentra en
`tests/lexer`, `tests/parser`, `tests/semantic`, `tests/interpreter`,
`tests/services/test_multifile_execution.py`,
`tests/integration/test_circular_import_pipeline.py`,
`tests/integration/test_casa_ejemplo.py` y `tests/spatial`.

## Matriz de resultados

| Caso | Objetivo | Entrada | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|
| PV-01 | Tipos, declaraciones y `mostrar` | `examples/07_Variables_And_Data_Types/01_Data_Types.lumi` | Compila y ejecuta con cinco valores tipados | `completed`; salida `4`, `5.5`, `Sala principal`, `verdadero`, `No existe un resultado`; sin diagnósticos | Aprobado |
| PV-02 | Condicional `si/sino` | `examples/10_Conditionals/02_If_Else.lumi` | Ejecuta la rama correspondiente | `completed`; salida `Habitacion compacta`; sin diagnósticos | Aprobado |
| PV-03 | Función con parámetro y retorno | `examples/01_Functions/01_function_with_return.lumi` | Retorna y muestra el cuadrado | `completed`; salida `Resultado del cuadrado:`, `36`; sin diagnósticos | Aprobado |
| PV-04 | Listas y su formato de salida | `examples/08_Lists_And_Vectors/01_Lists.lumi` | Conserva dos listas de texto | `completed`; mostró colores y materiales con sus listas; sin diagnósticos | Aprobado |
| PV-05 | Habitación con pared, puerta, ventana, muebles y rotación | `examples/06_Walls_Doors_Windows/11_valid_complete_room.lumi` | Genera una escena con los tres elementos arquitectónicos | `completed`; un cuarto; `wall=1`, `door=1`, `window=1`; sin diagnósticos | Aprobado |
| ES-01 | Rechazar expresión incompleta | `tests/parser/fixtures/frontend/invalid/incomplete_expression.lumi` | Error sintáctico localizado | Bloqueado; `SYN_UNEXPECTED_TOKEN`, línea 2, columna 24 | Aprobado |
| ES-02 | Rechazar importación sin `usar` | `tests/parser/fixtures/frontend/invalid/invalid_import.lumi` | Error sintáctico localizado | Bloqueado; `SYN_UNEXPECTED_TOKEN`, línea 1, columna 27 | Aprobado |
| ES-03 | Rechazar vector de aridad inválida | `tests/parser/fixtures/frontend/invalid/invalid_vector.lumi` | Error sintáctico localizado | Bloqueado; `SYN_UNEXPECTED_TOKEN`, línea 3, columna 24 | Aprobado |
| ES-04 | Rechazar paréntesis faltante | `tests/parser/fixtures/frontend/invalid/missing_parenthesis.lumi` | Error sintáctico localizado | Bloqueado; `SYN_UNEXPECTED_TOKEN`, línea 2, columna 14 | Aprobado |
| ES-05 | Rechazar bloque sin cierre | `tests/parser/fixtures/frontend/invalid/unclosed_block.lumi` | Error sintáctico localizado | Bloqueado; `SYN_UNEXPECTED_TOKEN`, línea 3, columna 1 | Aprobado |
| EM-01 | Identificador no declarado | `examples/04_Semantic_Errors/01_undeclared_variable.lumi` | Bloqueo semántico por variable | `SEM_UNDECLARED_VARIABLE`, línea 2, columna 13; ejecución no intentada | Aprobado |
| EM-02 | Declaración duplicada en el mismo alcance | `examples/04_Semantic_Errors/02_duplicate_variable.lumi` | Bloqueo por símbolo duplicado | `SEM_DUPLICATE_SYMBOL`, línea 3, columna 5; ejecución no intentada | Aprobado |
| EM-03 | Asignación con tipo incompatible | `examples/04_Semantic_Errors/03_assignment_type_mismatch.lumi` | Bloqueo por tipos | `SEM_TYPE_MISMATCH`, línea 3, columna 5; ejecución no intentada | Aprobado |
| EM-04 | Aridad incorrecta de función | `examples/02_Parameters_And_Calls/05_wrong_argument_count.lumi` | Bloqueo por cantidad de argumentos | `SEM_ARGUMENT_COUNT_MISMATCH`, línea 6, columna 13; ejecución no intentada | Aprobado |
| EM-05 | Variable fuera de alcance | `examples/04_Semantic_Errors/06_variable_out_of_scope.lumi` | El bloque no exporta la variable local | `SEM_UNDECLARED_VARIABLE`, línea 6, columna 13; ejecución no intentada | Aprobado |
| IMP-01 | Importación directa con parámetros y retorno | `tests/official/fixtures/import_direct/` | Ejecuta la función importada | `completed`; salida `20`; importó `matematica.lumi` | Aprobado |
| IMP-02 | Dependencia transitiva | `tests/official/fixtures/import_transitive/` | Resuelve principal → fachada → base | `completed`; salida `42`; catálogo con los tres archivos | Aprobado |
| IMP-03 | Aislamiento de símbolos transitivos | `tests/official/fixtures/import_scope/` | La función no solicitada no es visible en principal | Bloqueado; `SEM_UNDECLARED_FUNCTION` en `principal.lumi:5:13`; ejecución no intentada | Aprobado |
| IC-01 | Ciclo real entre archivos | `tests/official/fixtures/import_cycle/` | Detecta y rechaza `a → b → a` | Bloqueado en análisis; `IMPORT_CIRCULAR_DEPENDENCY` en `b.lumi:1:1` | Aprobado |
| INT-01 | Proyecto espacial integral multiarchivo | `tests/official/fixtures/integral/` | Importa funciones; genera pared, puerta, ventana y muebles; mueve/rota mesa; solicita `visualizar3D(sala)` | `completed`; salida `Area integral:`, `48`; un cuarto y seis elementos; mesa en `[1.5,0,0.5]`, rotación `[0,90,0]`; preferencia `sala`; traza completa | Aprobado |

Cada prueba negativa también comprueba que la fase sea la prevista y que la
ejecución no haya sido intentada. Por tanto, un fallo genérico o perteneciente a
otra regla no satisface el caso.

## Evidencia automatizada y reproducción

El archivo `tests/official/test_official_cases.py` contiene exactamente 20 casos
pytest y aserciones sobre compilación, ejecución, códigos, ubicaciones, salida y
escena. Ejecución final:

```powershell
.\.venv\Scripts\python.exe -m pytest -q tests/official
# 20 passed in 0.16s
```

Regresión completa:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
# 1241 passed in 3.14s

git diff --check
# sin salida; código de retorno 0
```

Las suites Electron y renderer no se ejecutaron: esta entrega solo añade fuentes
`.lumi`, una prueba pytest y documentación, sin modificar componentes compartidos,
protocolo, Electron ni renderer. Sus conteos auditados previos (73 y 1094) no se
presentan como una nueva ejecución.

## Límites y comprobaciones manuales

No quedan requisitos de compilador/intérprete sin evidencia automatizada dentro
de estos 20 casos. La apariencia gráfica final no puede acreditarse desde pytest:
el backend demuestra el `ScenePlan` y `preferredRoom`, pero no píxeles del visor.

En Lumi Studio conviene abrir `tests/official/fixtures/integral`, seleccionar
`principal.lumi`, compilar (F5), ejecutar (F6) y comprobar visualmente la sala,
pared, puerta, ventana, muebles y selección de `sala`. Como comprobación de UX,
también conviene abrir ES-04, EM-04 e IC-01 y confirmar que el panel navega a las
ubicaciones y muestra los códigos registrados en la matriz. Estas verificaciones
manuales son complementarias; no se contabilizan como aprobadas en la evidencia
automatizada anterior.
