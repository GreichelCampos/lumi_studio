# Errores de sintaxis intencionales

Estos archivos no son programas válidos. Sirven para comprobar diagnósticos:

- `01_Missing_Terminator.lumi`: falta `>>`.
- `02_Missing_Brace.lumi`: falta la llave de cierre.
- `03_Incomplete_Assignment.lumi`: falta el valor asignado.
- `04_Incomplete_Loop.lumi`: falta un separador `;` del ciclo `hacer`.
- `05_Missing_Condition.lumi`: falta la condición de `si`.

Todos deben producir `SYN_UNEXPECTED_TOKEN` y su ejecución debe quedar
bloqueada. No deben corregirse para que compilen: el error es su objetivo.
