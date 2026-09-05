# L-020 Semantic and Interpreter Demo

## Objective

Demonstrate semantic validation and fixture-based execution without depending on a completed parser.

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

## Run the automated evidence

```powershell
.\.venv\Scripts\python.exe -m pytest tests\demo\test_semantic_interpreter_demo.py -v
```

## Presentation checklist

- Explain that the fixture temporarily replaces parser output.
- Show the variable declaration in the fixture.
- Identify the condition and loop nodes.
- Run the valid program and compare its three output lines.
- Show the invalid assignment and its source location.
- Explain that parser integration will replace the fixture, not the semantic rules.
