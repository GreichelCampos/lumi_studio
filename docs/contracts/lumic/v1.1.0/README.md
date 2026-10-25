# Contrato .lumic 1.1.0

La exportación del IDE genera `schemaVersion: "1.1.0"`. El contenedor conserva sus campos; solo amplía los estados admitidos de los objetos de ScenePlan y sus snapshots.

| Objeto | Validación |
|---|---|
| Sin `placed`, con posición válida | Colocado heredado |
| `placed: true`, con posición válida | Colocado |
| `placed: false`, sin propiedad `position` | Sin colocar |
| `placed: true`, sin posición | Inválido |
| `placed: false`, con posición, incluso `null` | Inválido |
| Sin `placed` ni posición | Inválido |

Los objetos sin colocar conservan IDs, dimensiones, rotación y referencias. No generan geometría ni enfoque de cámara. Una habitación con todos sus objetos sin colocar sigue siendo una habitación visible.

El importador conserva la lectura de archivos 1.0.0 y no los modifica ni normaliza automáticamente. El esquema histórico permanece intacto: exige posición y permite propiedades adicionales. Un campo `placed` presente en un archivo antiguo se conserva como dato adicional, sin interpretar su valor. La posición válida determina el renderizado histórico, incluso si ese campo contiene `false`, `null` u otro valor. Esta excepción no se aplica a 1.1.0 ni a respuestas nuevas de Python.

Exportar de nuevo crea un archivo 1.1.0 sin insertar posiciones ni indicadores. Si un dato adicional histórico `placed` contradice las reglas de 1.1.0, la exportación se rechaza con un error de validación; no se elimina ni corrige ese dato silenciosamente. La importación y reproducción originales siguen disponibles.

La compatibilidad histórica con otras cadenas de versión de la familia 1 se conserva usando las reglas de objetos colocados. La ampliación sin colocar se activa exclusivamente para `schemaVersion: "1.1.0"`. No se promete que lectores antiguos puedan abrir esta versión.

`ScenePlan.version` y `protocolVersion` del worker siguen en 1.0.0: son contratos independientes. Esta fase no cambia el sobre Python/Electron ni publica AST en `.lumic`. La respuesta futura de Python puede transportar el estado sin colocar sin cambiar su sobre, siempre que el consumidor esté actualizado.

Esquema: [lumic.schema.json](lumic.schema.json). Ejemplos: [escena mixta válida](examples/valid-mixed.lumic) y [posición contradictoria](examples/invalid-unplaced-position.lumic). Contrato anterior: [1.0.0](../v1.0.0/README.md).

La geometría de paredes y aberturas, dimensiones físicas del catálogo, estabilidad de IDs y trazas reales conservan sus decisiones pendientes. Esta versión no declara esos temas resueltos ni integra un productor Python nuevo.
