# L-005 — Guion de propuesta y preguntas de investigación

## Guion de tres minutos

### 0:00–0:35 — Problema

Aprender programación suele exigir imaginar el efecto de instrucciones abstractas
sin una representación inmediata. Lumi propone un lenguaje educativo de dominio
específico en el que variables, expresiones, decisiones, ciclos y funciones pueden
producir habitaciones y objetos visibles en tres dimensiones.

### 0:35–1:15 — Usuarios y solución

El público principal son estudiantes que están iniciando programación y docentes
que necesitan ejercicios observables. Un proyecto Lumi utiliza archivos `.lumi`,
un principal explícito e importaciones locales. Estudio Lumi ofrece edición,
análisis, ejecución real mediante Python y visualización con React y Three.js.

### 1:15–2:10 — Funcionamiento técnico

El código pasa por Lexer, Parser y AST. El analizador semántico comprueba símbolos,
tipos, funciones, importaciones y reglas espaciales estáticas. El intérprete evalúa
el programa y alimenta `ScenePlanBuilder`; `SpatialValidator` valida el estado
resuelto. `ExecutionService` lo adapta al protocolo seguro entre Python y Electron,
y Three.js representa la habitación seleccionada. Compilar y Ejecutar permanecen
separados para no producir efectos durante el análisis.

### 2:10–2:40 — Evidencia

CasaEjemplo demuestra tres archivos, dos importaciones, funciones, una condición,
ciclos, dos habitaciones y operaciones espaciales. La evidencia real incluye
pruebas automatizadas, respuesta del protocolo y capturas de Electron con Python
real. La suite Python actual registra 783 pruebas aprobadas.

### 2:40–3:00 — Alcance honesto

Lumi ya genera escenas para habitaciones, pisos y muebles. La geometría completa de
paredes y aberturas y las reglas de colisión de L-035 continúan pendientes de
contrato o implementación; no se presentan como terminadas.

## Preguntas de investigación

1. ¿Cómo influye una representación 3D inmediata en la comprensión de variables,
   control de flujo y funciones por parte de estudiantes principiantes?
2. ¿Qué diagnósticos semánticos y espaciales ayudan más a corregir programas sin
   sustituir el razonamiento del estudiante?
3. ¿Qué equilibrio entre lenguaje textual y visualización mantiene la atención en
   conceptos de programación y evita que el ejercicio se convierta en modelado 3D?
4. ¿Cómo cambia la capacidad de explicar un programa cuando el estudiante puede
   comparar el AST, la salida textual y el estado final de una escena?
5. ¿Qué subconjunto de geometría espacial es suficiente para ejercicios educativos
   reproducibles sin introducir complejidad de motores profesionales?

## Evidencia propuesta

- tiempo necesario para completar ejercicios equivalentes;
- número y categoría de errores antes y después de observar la escena;
- explicación oral del estudiante sobre el flujo del programa;
- resultados de pruebas automatizadas y diagnósticos reproducibles;
- encuesta breve de claridad, utilidad y carga cognitiva.

Estas preguntas son propuestas de investigación; no se presentan como resultados
experimentales obtenidos.
