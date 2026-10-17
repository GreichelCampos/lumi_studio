# Semantic and Interpreter Demo

## Objective

Run semantic validation and interpretation using predefined fixtures. This
demonstration bypasses source parsing and does not exercise the complete compiler pipeline.

The demonstration covers:

- An `entero` variable declaration.
- Variable assignment.
- Numeric and relational expressions.
- A `mientras` loop.
- A `si/sino` condition.
- Console output through `mostrar`.
- A semantic type mismatch with file, line and column.

## Run the demonstration

From the project root, run:

```powershell
.\.venv\Scripts\python.exe -m demos.semantic_interpreter_demo
```

## Expected output

```text
=== Ejecución válida ===
Salida: 0
Salida: mitad
Salida: 2

=== Diagnóstico semántico ===
[SEM_TYPE_MISMATCH] principal.lumi:12:5
No se puede asignar un valor de tipo 'entero' a una variable de tipo 'booleano'.
Sugerencia: Utilice un valor compatible con el tipo declarado.
```

## Automated tests

```powershell
.\.venv\Scripts\python.exe -m pytest tests\demo\test_semantic_interpreter_demo.py -v
```

## Input and scope

The demonstration reads `demos/fixtures/semantic_interpreter_demo.json` through
`demos/semantic_interpreter_demo.py`. The fixture supplies the AST-like structures
used by the semantic analyzer and interpreter; it is not parser output produced
from a `.lumi` source file during this command.
