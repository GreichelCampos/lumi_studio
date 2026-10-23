# Programas y posiciones sintácticas

Los diez programas de `tests/parser/fixtures/frontend/` se verifican exclusivamente
mediante lexer, parser y AST en `tests/parser/test_frontend_programs.py`.
`imports.lumi` reutiliza el fixture `functions.lumi` mediante `InMemoryImportResolver`.
La etapa 3 corrige las expectativas del vector espacial incompleto a 3:24 y de la importaci?n inv?lida a 1:31, errores de conteo
del diseño original. No se modificaron los programas.

## Decisión para EOF

El parser solo recibía tokens. No podía reconstruir el final real de la fuente
porque espacios, comentarios y saltos finales no aparecen en esa lista.
El lexer ya conserva `file`, `line` y `column` después de escanear toda la fuente.

Se transportan esas tres coordenadas mediante `TokenStream`, una subclase de
`list[Token]` devuelta por `Lexer.tokenize()`. La lista contiene exactamente los
mismos tokens: no se agrega un token EOF ni se modifica `Token`, `TokenType`,
la gramática, el AST o el protocolo Python–IDE. Se mantiene la firma de retorno
de lista y sus operaciones habituales. El parser usa los metadatos únicamente
para errores reales de EOF y para preservar el archivo de una lista vacía.
Los parsers importados reciben automáticamente esos mismos metadatos.

El token auxiliar utilizado internamente para la ubicación EOF no se incorpora
a la lista ni al AST. La descripción utiliza EOF solo cuando no se proporcionó
un token causante y se agotó la lista. Si `parse_primary()` proporciona un token
inesperado ya consumido, se conserva su ubicación y se describe su lexema.

Las listas ordinarias construidas por consumidores siguen siendo aceptadas.
Sin metadatos se mantiene el respaldo histórico del último token (o 1:1 para
lista vacía): no se inventan coordenadas. Convertir el resultado a `list` o
rebanarlo pierde los metadatos adicionales; para conservar EOF exacto debe
pasarse directamente la lista devuelta por el lexer. No fue necesario realizar
ningún cambio incompatible de contrato público en los consumidores existentes.

## Regresiones

`tests/parser/test_syntax_diagnostics.py` aporta 20 casos con fuentes en memoria:

- Siete finales de fuente, tanto principales como importados: con y sin LF,
  espacios finales, espacios después de LF, comentario de línea con y sin LF,
  y comentario multilínea seguido de espacios.
- Tres tokens inesperados finales: `>>`, `)` y `]`, incluyendo trivia posterior.
- Conservación exacta de tokens y ubicaciones AST, y aceptación de listas comunes.
- Fuente sin tokens que conserva archivo y EOF real.
- Respaldo compatible para listas ordinarias sin metadatos.

No se amplió el alcance de recuperación ni la agregación de diagnósticos
importados: la regresión de importados comprueba el diagnóstico de `ParserError`.

## Validación y evidencia

```powershell
.\.venv\Scripts\python.exe -B -m pytest tests/parser/test_frontend_programs.py -v -p no:cacheprovider
.\.venv\Scripts\python.exe -B -m pytest tests/lexer tests/parser -q -p no:cacheprovider
.\.venv\Scripts\python.exe -B -m pytest tests -q -p no:cacheprovider
```

Resultados: 10, 197 y 621 pruebas aprobadas respectivamente.
El [reporte de evidencia](audits/FRONTEND_TEST_EVIDENCE.md) conserva el
resultado inicial (7 aprobadas, 3 fallidas), las posiciones y diagnósticos
iniciales/finales y las salidas completas de las validaciones finales.

## Nombres descriptivos

Los fixtures actuales utilizan nombres funcionales bajo `fixtures/frontend/`.
`imports.lumi` y `invalid_import.lumi` hacen referencia a `functions.lumi`;
el resolver carga ese mismo fixture. El nombre importado más corto desplaza
el token inesperado `sumar` del caso de importación inválida a 1:27. La prueba
actual espera esa posición. La posición histórica 1:31 corresponde al contenido
anterior y permanece intacta en las evidencias históricas.

Las correspondencias históricas y las validaciones posteriores al renombrado
se encuentran en el reporte de evidencia.

## Trazabilidad académica

Este trabajo corresponde a la tarea **L-031** del proyecto Estudio Lumi:
crear cinco programas válidos y cinco errores sintácticos y corregir sus posiciones.
El identificador académico no se utiliza en nombres técnicos de pruebas o fixtures.
