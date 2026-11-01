# L-032 — Evidencia de pruebas semánticas e importaciones

## 1. Alcance

El cronograma de `TAREAS PROYECTO.pdf` asigna a L-032 la preparación de cinco
casos de error semántico, tres casos de importaciones y un caso de dependencia
circular. El entregable esperado es un conjunto de nueve pruebas automatizadas
con evidencia de su resultado.

Este documento organiza evidencia que ya existía en el repositorio. No se
crearon casos nuevos ni se modificó el comportamiento de Lumi.

## 2. Entorno de verificación

- Fecha: 31 de octubre de 2026.
- Rama: `docs/l032-test-evidence`.
- Base de `develop`: `ec33c31f7b800d1e8be7e612c770e22bbd776ce4`.
- Python: 3.12.10.
- pytest: 9.1.1.
- Caché de pytest desactivada mediante `-p no:cacheprovider`.
- Escritura de bytecode desactivada mediante `PYTHONDONTWRITEBYTECODE=1`.

## 3. Resumen de resultados

| Grupo | Casos requeridos | Casos ejecutados | Resultado |
|---|---:|---:|---|
| Errores semánticos | 5 | 5 | 5 aprobados |
| Importaciones | 3 | 3 | 3 aprobados |
| Dependencia circular | 1 | 1 | 1 aprobado |
| **Total** | **9** | **9** | **9 aprobados** |

Resultado aislado de pytest:

```text
collected 9 items
9 passed in 0.18s
```

## 4. Cinco errores semánticos

### S1. Llamada a una función no declarada

- Prueba: `test_undeclared_function_reports_diagnostic`.
- Propósito: comprobar que una llamada no pueda resolver una función inexistente.
- Entrada:

```lumi
mostrar(no_existe())>>
```

- Resultado esperado: un único diagnóstico `SEM_UNDECLARED_FUNCTION`.
- Resultado obtenido: la prueba aprobó y confirmó exactamente la lista
  `['SEM_UNDECLARED_FUNCTION']`.
- Referencia:
  `tests/semantic/test_function_semantics.py::test_undeclared_function_reports_diagnostic`.

### S2. Intento de llamar una variable

- Prueba: `test_calling_variable_reports_diagnostic`.
- Propósito: comprobar que un símbolo de tipo variable no se pueda invocar como
  función.
- Entrada:

```lumi
entero cantidad = 1>>
cantidad()>>
```

- Resultado esperado: un único diagnóstico `SEM_SYMBOL_NOT_CALLABLE`.
- Resultado obtenido: la prueba aprobó y confirmó exactamente la lista
  `['SEM_SYMBOL_NOT_CALLABLE']`.
- Referencia:
  `tests/semantic/test_function_semantics.py::test_calling_variable_reports_diagnostic`.

### S3. Argumento incompatible

- Prueba: `test_incompatible_argument_reports_diagnostic_at_argument_location`.
- Propósito: comprobar el tipo de un argumento y conservar la ubicación del
  argumento que origina el error.
- Entrada, archivo `funciones.lumi`:

```lumi
funcion entero identidad(entero valor) {
    retornar valor>>
}
principal {
    mostrar(identidad("texto"))>>
}
```

- Resultado esperado: un diagnóstico semántico
  `SEM_ARGUMENT_TYPE_MISMATCH` en `funciones.lumi:5:23`, con descripción y
  sugerencia.
- Resultado obtenido: la prueba aprobó y confirmó categoría, código, archivo,
  línea, columna, descripción y sugerencia.
- Referencia:
  `tests/semantic/test_function_semantics.py::test_incompatible_argument_reports_diagnostic_at_argument_location`.

### S4. Retorno incompatible con la función

- Prueba: `test_incompatible_return_type_reports_diagnostic`.
- Propósito: comprobar que una función declarada como `entero` no retorne texto.
- Entrada:

```lumi
funcion entero cantidad() { retornar "cuatro">> }
```

- Resultado esperado: un único diagnóstico `SEM_RETURN_TYPE_MISMATCH`.
- Resultado obtenido: la prueba aprobó y confirmó exactamente la lista
  `['SEM_RETURN_TYPE_MISMATCH']`.
- Referencia:
  `tests/semantic/test_function_semantics.py::test_incompatible_return_type_reports_diagnostic`.

### S5. Retorno fuera de una función

- Prueba: `test_return_outside_function_reports_diagnostic`.
- Propósito: impedir que `retornar` se utilice sin un contexto de función.
- Entrada:

```lumi
retornar 4>>
```

- Resultado esperado: un único diagnóstico `SEM_RETURN_OUTSIDE_FUNCTION`.
- Resultado obtenido: la prueba aprobó y confirmó exactamente la lista
  `['SEM_RETURN_OUTSIDE_FUNCTION']`.
- Referencia:
  `tests/semantic/test_function_semantics.py::test_return_outside_function_reports_diagnostic`.

## 5. Tres pruebas de importaciones

### I1. Importación y llamada válida de una función

- Prueba: `test_calls_imported_function_through_real_pipeline`.
- Propósito: verificar que una función importada se registre y se pueda llamar
  desde el programa principal mediante Lexer, Parser y SemanticAnalyzer.
- Entrada principal:

```lumi
importar "utilidades.lumi" usar calcular_area>>
principal {
    decimal area = calcular_area(4, 5)>>
}
```

- Módulo `utilidades.lumi`:

```lumi
funcion decimal calcular_area(decimal ancho, decimal largo) {
    retornar ancho * largo>>
}
```

- Resultado esperado: análisis semántico exitoso, sin diagnósticos.
- Resultado obtenido: la prueba aprobó y confirmó `result.succeeded`.
- Referencia:
  `tests/semantic/test_import_semantics.py::test_calls_imported_function_through_real_pipeline`.

### I2. Símbolo ausente en el módulo importado

- Prueba: `test_missing_symbol_in_imported_program_reports_import_diagnostic`.
- Propósito: comprobar que el archivo importado deba exponer el símbolo solicitado.
- Entrada principal:

```lumi
importar "utilidades.lumi" usar calcular_area>>
```

- Módulo `utilidades.lumi`:

```lumi
funcion entero otra() { retornar 1>> }
```

- Resultado esperado: un único diagnóstico `IMPORT_SYMBOL_NOT_FOUND`.
- Resultado obtenido: la prueba aprobó y confirmó exactamente la lista
  `['IMPORT_SYMBOL_NOT_FOUND']`.
- Referencia:
  `tests/semantic/test_import_semantics.py::test_missing_symbol_in_imported_program_reports_import_diagnostic`.

### I3. Importación duplicada del mismo símbolo

- Prueba: `test_duplicate_import_reports_diagnostic`.
- Propósito: comprobar que un mismo símbolo no se registre dos veces mediante
  importaciones repetidas.
- Entrada principal:

```lumi
importar "utilidades.lumi" usar calcular_area>>
importar "utilidades.lumi" usar calcular_area>>
```

- Módulo `utilidades.lumi`:

```lumi
funcion decimal calcular_area(decimal ancho, decimal largo) {
    retornar ancho * largo>>
}
```

- Resultado esperado: un único diagnóstico `IMPORT_DUPLICATE_SYMBOL`.
- Resultado obtenido: la prueba aprobó y confirmó exactamente la lista
  `['IMPORT_DUPLICATE_SYMBOL']`.
- Referencia:
  `tests/semantic/test_import_semantics.py::test_duplicate_import_reports_diagnostic`.

## 6. Dependencia circular

### C1. Ciclo transitivo entre módulos

- Prueba: `test_circular_dependency_stops_pipeline_at_parsing`.
- Propósito: verificar que el parser detenga el pipeline cuando una cadena de
  importaciones vuelve a solicitar un archivo activo.
- Entrada principal, `principal.lumi`:

```lumi
importar "a.lumi" usar f>>
```

- Módulo `a.lumi`:

```lumi
importar "b.lumi" usar f>>
```

- Módulo `b.lumi`:

```lumi
importar "a.lumi" usar f>>
```

- Resultado esperado: `ParserError`, un único diagnóstico
  `IMPORT_CIRCULAR_DEPENDENCY` originado en `b.lumi` y ningún programa importado
  publicado.
- Resultado obtenido: la prueba aprobó y confirmó la excepción controlada, el
  único código de diagnóstico, el archivo `b.lumi` y
  `parser.imported_programs == {}`.
- Referencia:
  `tests/integration/test_circular_import_pipeline.py::test_circular_dependency_stops_pipeline_at_parsing`.

## 7. Comando de reproducción

Desde la raíz del repositorio:

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
.\.venv\Scripts\python.exe -m pytest -p no:cacheprovider -v `
  tests/semantic/test_function_semantics.py::test_undeclared_function_reports_diagnostic `
  tests/semantic/test_function_semantics.py::test_calling_variable_reports_diagnostic `
  tests/semantic/test_function_semantics.py::test_incompatible_argument_reports_diagnostic_at_argument_location `
  tests/semantic/test_function_semantics.py::test_incompatible_return_type_reports_diagnostic `
  tests/semantic/test_function_semantics.py::test_return_outside_function_reports_diagnostic `
  tests/semantic/test_import_semantics.py::test_calls_imported_function_through_real_pipeline `
  tests/semantic/test_import_semantics.py::test_missing_symbol_in_imported_program_reports_import_diagnostic `
  tests/semantic/test_import_semantics.py::test_duplicate_import_reports_diagnostic `
  tests/integration/test_circular_import_pipeline.py::test_circular_dependency_stops_pipeline_at_parsing
```

## 8. Criterio de cierre

L-032 queda respaldada por nueve pruebas automatizadas existentes y aprobadas:
cinco errores semánticos, tres comportamientos de importación y una dependencia
circular. La evidencia distingue las entradas, expectativas, resultados y
referencias exactas sin atribuir a las pruebas comprobaciones que no realizan.
