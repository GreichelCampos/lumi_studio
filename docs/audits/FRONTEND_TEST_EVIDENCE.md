# Evidencia de pruebas del front-end

Fecha: 2026-10-22. Entorno: Windows, Python 3.13.15, pytest 9.1.1.

Se crearon los diez fixtures aprobados en `tests/parser/fixtures/frontend/` y
`tests/parser/test_frontend_programs.py`. Los fixtures se leen desde disco y se
comprueba UTF-8, ausencia de CR y tabuladores, ausencia de línea vacía inicial
y un único LF final. Las pruebas utilizan exclusivamente lexer, parser, AST
y el resolver en memoria existente; Importaciones carga Funciones desde su fixture.

## Ejecución

El comando siguiente utiliza la ruta operativa actual. La salida histórica
conserva el comando y los nombres que se ejecutaron originalmente.

```powershell
.\.venv\Scripts\python.exe -B -m pytest tests/parser/test_frontend_programs.py -v -p no:cacheprovider
```

Resultado: **7 passed, 3 failed**, código de salida 1. Se ejecutó el mismo
comando una segunda vez para conservar su salida íntegra en
[pytest.txt](frontend/pytest.txt), con el mismo resultado.
Los diagnósticos completos extraídos del parser están en
[diagnostics_initial.json](frontend/diagnostics_initial.json).

| Caso | Resultado | Posición esperada | Posición real |
| --- | --- | --- | --- |
| Variables y expresiones | PASS | No aplica | Sin diagnósticos |
| Estructuras de control | PASS | No aplica | Sin diagnósticos |
| Funciones | PASS | No aplica | Sin diagnósticos |
| Importaciones | PASS | No aplica | Sin diagnósticos |
| Declaraciones espaciales | PASS | No aplica | Sin diagnósticos |
| Paréntesis faltante | PASS | 2:14 | 2:14 |
| Bloque sin cerrar | FAIL | 3:1 | 2:15 |
| Expresión incompleta | PASS | 2:24 | 2:24 |
| Vector espacial incompleto | FAIL | 3:23 | 3:24 |
| Importación inválida | FAIL | 1:29 | 1:31 |

Los cinco válidos satisfacen las comprobaciones del AST; no se observaron
diferencias respecto al diseño en las construcciones verificadas.
Los cinco inválidos lanzan `ParserError` y producen exactamente un diagnóstico,
con categoría `SYNTACTIC`, código `SYN_UNEXPECTED_TOKEN`, identidad de archivo
igual al nombre base del fixture y sugerencia `None`.
En los tres fallos solo difieren las coordenadas; los demás campos coinciden.

## Descripciones reales

| Caso | Descripción |
| --- | --- |
| Paréntesis faltante | `Se esperaba ')' despues de la expresion. Encontrado: '>>'.` |
| Bloque sin cerrar | `Se esperaba '}' para cerrar el bloque. Encontrado: fin de archivo.` |
| Expresión incompleta | `Se esperaba una expresion. Encontrado: '>>'.` |
| Vector espacial incompleto | `Se esperaba ',' despues del componente y. Encontrado: ']'.` |
| Importación inválida | `Se esperaba 'usar' despues del archivo importado. Encontrado: 'sumar'.` |

## Interpretación de los fallos

- **Bloque sin cerrar:** defecto de EOF confirmado. La fuente termina después del LF de la
  segunda línea, en 3:1; el parser señala el inicio del último token `>>`, 2:15.
- **Vector espacial incompleto:** error de conteo en el diseño anterior. En el contenido aprobado,
  `]` ocupa realmente la columna 24; la columna 23 contiene `0`. La posición
  actual del token es correcta. No corresponde desplazarla artificialmente.
- **Importación inválida:** error de conteo en el diseño anterior. `sumar` comienza realmente
  en la columna 31; la columna 29 es la comilla de cierre del nombre importado.
  La posición actual del token es correcta.

El conteo de Vector espacial incompleto y Importación inválida se comprobó independientemente con las cadenas de las
líneas del fixture, sin consultar las posiciones producidas por el parser.
Las expectativas aprobadas 3:23 y 1:29 permanecen intactas por instrucción del
usuario. Su revisión queda pendiente; estos dos fallos no son evidencia de un
defecto del parser.

## Alcance conservado

No se modificaron lexer, parser, AST, diagnósticos, gramática, servicios,
intérprete, IDE ni renderer. No se utilizaron `xfail` o `skip`, ni análisis
semántico como criterio de aceptación. No se hicieron commits ni cambios de rama.
Las correcciones quedan pendientes de revisión para la siguiente etapa.

## Etapa 3 — Resultado final

La evidencia anterior describe la ejecución inicial y se conserva sin reemplazar
`pytest.txt` ni `diagnostics_initial.json`.

Se corrigieron exclusivamente las expectativas Vector espacial incompleto (3:24) y Importación inválida (1:31):
corresponden al inicio real de `]` y `sumar`. Las expectativas originales tenían
errores de conteo. Los diez programas `.lumi` permanecen sin cambios.

Bloque sin cerrar ahora informa 3:1, el final real de la fuente. Cuando un token inesperado
consumido es el último, su descripción ahora muestra ese token, no EOF.
Categorías y códigos permanecen iguales.

| Caso | Resultado final | Posición final |
| --- | --- | --- |
| Variables y expresiones | PASS | Sin diagnósticos |
| Estructuras de control | PASS | Sin diagnósticos |
| Funciones | PASS | Sin diagnósticos |
| Importaciones | PASS | Sin diagnósticos |
| Declaraciones espaciales | PASS | Sin diagnósticos |
| Paréntesis faltante | PASS | 2:14 |
| Bloque sin cerrar | PASS | 3:1 |
| Expresión incompleta | PASS | 2:24 |
| Vector espacial incompleto | PASS | 3:24 |
| Importación inválida | PASS | 1:31 |

| Validación | Resultado | Evidencia |
| --- | --- | --- |
| Diez programas del front-end | 10 passed in 0.11s | [pytest_final.txt](frontend/pytest_final.txt) |
| Lexer/parser, incluidas regresiones nuevas | 197 passed in 0.32s | [pytest_lexer_parser_final.txt](frontend/pytest_lexer_parser_final.txt) |
| Suite Python completa (`tests`) | 621 passed in 1.51s | [pytest_python_final.txt](frontend/pytest_python_final.txt) |

Todas las ejecuciones finales terminaron con código 0. Los diagnósticos finales
completos se conservan en [diagnostics_final.json](frontend/diagnostics_final.json).
Las descripciones son las mismas de la tabla inicial; la corrección del mensaje
del último token se verifica con fuentes en memoria adicionales.

La decisión de transporte de EOF y sus límites se documentan en
[frontend_testing.md](../frontend_testing.md).

## Renombrado descriptivo

Las tablas inicial y final anteriores son registros históricos: utilizan etiquetas descriptivas sin cambiar
resultados ni coordenadas originales. Los archivos históricos
`pytest.txt`, `pytest_final.txt`, `pytest_lexer_parser_final.txt`,
`pytest_python_final.txt`, `diagnostics_initial.json` y `diagnostics_final.json`
se trasladaron a `frontend/` sin editar su contenido. Sus rutas antiguas, nombres
de archivo y node IDs de pytest son referencias históricas, no comandos actuales.
Los enlaces de este documento apuntan a las ubicaciones actuales.


Todos están bajo `tests/parser/fixtures/frontend/`. Las únicas modificaciones
de contenido Lumi son las referencias a `functions.lumi` en los dos imports.
En `invalid_import.lumi`, el nombre más corto cambia el inicio real de `sumar`
a 1:27; la expectativa operativa se actualizó por ese motivo. La coordenada
histórica 1:31 no se alteró en los registros iniciales o finales anteriores.

Los archivos de pruebas actuales son `test_frontend_programs.py` y
`test_syntax_diagnostics.py`; los nombres de las cinco pruebas válidas y los
cinco IDs de parametrización inválidos también son descriptivos.

| Validación posterior al renombrado | Resultado | Evidencia nueva |
| --- | --- | --- |
| Diez programas | 10 passed | [pytest_renamed_programs.txt](frontend/pytest_renamed_programs.txt) |
| Ambos archivos renombrados | 30 passed | [pytest_renamed_tests.txt](frontend/pytest_renamed_tests.txt) |
| Lexer/parser | 197 passed | [pytest_renamed_lexer_parser.txt](frontend/pytest_renamed_lexer_parser.txt) |
| Suite Python completa | 621 passed | [pytest_renamed_python.txt](frontend/pytest_renamed_python.txt) |

Todas las ejecuciones nuevas terminaron con código 0. No se modificó la
implementación del lenguaje durante este renombrado.

## Verificación final de nombres descriptivos

Esta ejecución es posterior a la limpieza integral de identificadores. Los
registros anteriores no se reescribieron; su integridad, la de los fixtures y la
de la implementación del lenguaje se comprobó con SHA-256 antes y después.

| Alcance | Resultado | Evidencia nueva |
| --- | --- | --- |
| Diez programas | 10 passed | [Programas](frontend/pytest_descriptive_programs.txt) |
| Regresiones sintácticas | 20 passed | [Regresiones](frontend/pytest_descriptive_regressions.txt) |
| Lexer/parser | 197 passed | [Lexer/parser](frontend/pytest_descriptive_lexer_parser.txt) |
| Suite Python | 621 passed | [Suite completa](frontend/pytest_descriptive_python.txt) |

Los [diagnósticos actuales](frontend/diagnostics_descriptive.json) utilizan nombres
descriptivos y conservan las expectativas vigentes, incluida la importación
inválida en 1:27. Todas las ejecuciones terminaron con código 0.

## Trazabilidad académica

Este trabajo corresponde a la tarea **L-031** de Estudio Lumi.
La tabla traduce etiquetas de los registros originales; no son nombres
técnicos actuales. Se conserva para interpretar las ejecuciones históricas.

| Caso histórico | Fixture actual |
| --- | --- |
| V01 | `valid/variables_expressions.lumi` |
| V02 | `valid/control_structures.lumi` |
| V03 | `valid/functions.lumi` |
| V04 | `valid/imports.lumi` |
| V05 | `valid/spatial_declarations.lumi` |
| E01 | `invalid/missing_parenthesis.lumi` |
| E02 | `invalid/unclosed_block.lumi` |
| E03 | `invalid/incomplete_expression.lumi` |
| E04 | `invalid/invalid_vector.lumi` |
| E05 | `invalid/invalid_import.lumi` |

