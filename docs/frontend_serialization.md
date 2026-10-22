# L-028: salida del compilador frontal

## Instantánea y ubicaciones

`serialize_compilation(result)` devuelve un diccionario validado como JSON estándar:
`file`, `status`, `stage`, `program`, `imported_programs`, `diagnostics` y
`limitations`. `program` es `null` si el análisis no produjo AST. Incluye
`lexical_error` cuando existe y `lexical_error_location` cuando hay ubicación.
No ejecuta código ni genera escenas.

El AST reutiliza `normalize_ast()`: conserva `node`, los valores originales y
`file`, `line`, `column` recursivamente, incluidas expresiones, propiedades y
vectores de L-025. No normaliza rutas. Los programas vacíos conservan el archivo
recibido y la posición inicial 1:1. Los consumidores directos de `Parser` con
tokens vacíos deben suministrar `file=`. Se serializan los imports que el parser
expone; no se amplía la política existente ni se agregan imports transitivos.

Los diagnósticos conservan categoría, código, archivo, línea, columna,
descripción y sugerencia. Solo se omite una sugerencia `None`.
`diagnostic_dto()` reutiliza esa función sin cambiar su contrato público.

## Errores léxicos

`LexerError` admite atributos opcionales `file`, `line`, `column`, además de los
argumentos anteriores de `Exception`. `str(error)` conserva el mensaje anterior.
El lexer proporciona la ubicación del carácter inválido, la comilla inicial de
una cadena sin cerrar o el inicio de un comentario multilínea sin cerrar.
No utiliza la posición final del escaneo.

`CompilationResult.lexical_error` sigue siendo el texto anterior. El nuevo campo
opcional `lexical_error_location`, agregado al final para preservar argumentos
posicionales, contiene una ubicación inmutable. Se transporta desde el archivo
principal o importado hasta la instantánea. Excepciones antiguas sin ubicación
siguen funcionando: no se extraen coordenadas desde mensajes ni se inventan códigos
ni objetos `Diagnostic`.

Ejemplo de campos en una instantánea fallida:

```json
{
  "lexical_error": "lib.lumi:2:3: carácter inválido '@'",
  "lexical_error_location": {"file": "lib.lumi", "line": 2, "column": 3}
}
```

El protocolo Python–IDE continúa publicando únicamente `lexicalError` como texto.
Mostrar su ubicación estructurada requiere una futura integración con el IDE.

## JSON estricto y determinismo

Antes de devolver la instantánea se valida con `json.dumps(..., allow_nan=False)`.
Datos no representables, incluidos `NaN`, infinitos, tipos incompatibles y
anidamiento excesivo/cíclico, producen `CompilationSerializationError`, derivado
de `ValueError`, con la causa original encadenada. Es un fallo de serialización,
no un diagnóstico del estudiante. No se modifica el resultado ni se reemplazan
números por `null` o cadenas. Un literal que el parser convierte a infinito
puede seguir siendo aceptado por el análisis, pero su serialización se rechaza.

`serialize_compilation_json(result)` codifica la misma instantánea con
`allow_nan=False`, `ensure_ascii=True`, `sort_keys=True` y separadores `(',', ':')`.
Produce texto compacto; Unicode se escapa y se recupera al leerlo. Los archivos
importados se ordenan por identidad textual también en el diccionario. El orden
de sentencias, listas y diagnósticos se conserva. No se agregan fechas ni IDs.

Iguales fuentes, nombres y condiciones equivalentes producen la misma
representación, comprobada mediante compilaciones independientes. No se promete
un formato canónico universal entre versiones de Python ni la representación
exacta de enteros arbitrariamente grandes en JavaScript.

## Relación con `.lumic` v1.0.0 y responsabilidades

La instantánea es salida frontal para análisis y pruebas; no es el contenedor
persistente ni una respuesta del worker. El contrato v1 no define campos para
AST ni diagnósticos completos: requiere metadatos, ScenePlan y resumen diagnóstico.
No se modifica ese contrato ni se incorporan estos campos al contenedor.

El recorrido existente para escenas es `CompilerService → ExecutionService →
scene_plan_dto → protocolo → adaptBackendResult → LumicFileService`.
El análisis por sí solo no genera escenas. La integración debe reutilizar estos
componentes, sin otro compilador, constructor ni exportador.

El ScenePlan interno conserva ubicaciones espaciales. El DTO actual publica el
origen de declaración de objetos; no todas las fuentes de habitaciones,
propiedades y números. Ampliarlo, completar geometría de paredes/aberturas,
acordar severidades para el resumen, mostrar el origen léxico en el IDE y probar
exportación/reimportación con Python real corresponden a sus módulos o acuerdos
de integración. No se fabrican referencias ni geometría.

## Verificación

`tests/services/test_serialization.py` cubre nodos simples, anidados, espaciales,
programas vacíos e importados, diagnósticos, JSON estricto, rechazo sin mutación
de números no finitos, tipos incompatibles y ciclos, determinismo y los tres
errores léxicos en archivos principales e importados. También comprueba mensajes
anteriores, construcción antigua de resultados y ausencia de campos nuevos en
el protocolo. Se ejecutan regresiones del lexer, parser, servicios, importaciones
y protocolo, seguidas de toda la suite Python.
