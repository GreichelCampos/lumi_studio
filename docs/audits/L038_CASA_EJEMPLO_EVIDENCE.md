# L-038 — Evidencia de CasaEjemplo

Fecha de verificación: 31 de octubre de 2026 (America/Costa_Rica)

Rama: `feat/l038-casa-ejemplo`

Archivo principal: `examples/CasaEjemplo/principal.lumi`

## Objetivo y alcance

CasaEjemplo demuestra, sin modificar el lenguaje ni sus componentes de producción, la ejecución de un proyecto Lumi de varios archivos mediante la cadena real:

`Lexer → Parser → SemanticAnalyzer → Interpreter → ScenePlanBuilder → SpatialValidator → ExecutionService → protocolo Python/Electron → React + Three.js`

El ejemplo cubre importaciones, funciones, variables, expresiones, una condición, ciclos, dos habitaciones, pisos, muebles, colocación, movimiento y rotación. No incluye paredes, puertas ni ventanas porque su contrato geométrico no forma parte del alcance verificado de esta etapa.

## Estructura del proyecto

| Archivo | Responsabilidad |
|---|---|
| `examples/CasaEjemplo/principal.lumi` | Punto de entrada; define variables, salida, habitaciones y operaciones espaciales. |
| `examples/CasaEjemplo/calculos.lumi` | Expone `calcular_area(ancho, largo)`. |
| `examples/CasaEjemplo/muebles.lumi` | Expone `organizar_sala(x, z)` para mover y rotar la mesa. |

`principal.lumi` importa explícitamente ambas funciones. El IDE abrió la carpeta `examples/CasaEjemplo`, reconoció `principal.lumi` como entrada y mostró los tres archivos en el explorador.

## Resultado esperado

- Ejecución completada sin diagnósticos.
- Salida de consola:

  ```text
  Area de sala:
  30.0
  ```

- Habitación `sala`: dimensiones `6 × 5 × 3`, tres muebles colocados.
- Habitación `estudio`: dimensiones `4 × 3 × 2.6`, un mueble colocado.
- Estado final de la sala:
  - `mesa_centro`: posición `[1.5, 0, 0.5]`, rotación `[0, 90, 0]`.
  - `silla_lectura`: posición `[0, 0, -1]`, rotación `[0, 0, 0]`.
  - `planta_ventana`: posición `[2, 0, 1.5]`, rotación `[0, 90, 0]`.
- Estado final del estudio:
  - `escritorio1`: posición `[0, 0, 0]`, rotación `[0, 90, 0]`.

## Evidencia backend y de protocolo

`tests/integration/test_casa_ejemplo.py` contiene cuatro pruebas que verifican:

1. ejecución mediante `ExecutionService`, sin diagnósticos y con la salida exacta;
2. habitaciones, dimensiones y estado final de los muebles;
3. propiedades resueltas y referencias de origen, incluidas las operaciones ejecutadas desde `muebles.lumi`;
4. serialización real del `ScenePlan` mediante `RequestDispatcher`, incluida su ida y vuelta por JSON.

Resultado aislado: `4 passed`.

Resultado de la suite Python completa: `768 passed` en 3.84 segundos. Pytest emitió una advertencia no funcional porque no pudo actualizar `.pytest_cache`; ninguna prueba falló.

## Evidencia Electron y Three.js

La comprobación automatizada utilizó Electron, el puente seguro del escritorio, el Python real de `.venv` y el proyecto físico `examples/CasaEjemplo`. No se utilizó el compilador simulado del frontend.

Resultado obtenido:

- worker Python disponible;
- operación `execute` con estado `completed`;
- salida `Area de sala:` y `30.0`;
- cero diagnósticos;
- capacidad `scenePlan: true`;
- selector del visor con `sala` (3 objetos) y `estudio` (1 objeto);
- lienzo WebGL de `876 × 458` píxeles;
- llamadas de dibujo WebGL observadas tanto para `sala` como después de seleccionar `estudio`;
- posiciones y rotaciones del DTO iguales a las comprobadas por las pruebas Python.

Archivos de evidencia auténtica:

- `docs/audits/evidence/l038/casa-ejemplo-sala.png`
- `docs/audits/evidence/l038/casa-ejemplo-estudio.png`
- `docs/audits/evidence/l038/electron-results.json`

El archivo JSON conserva el resultado recibido por Electron y los datos objetivos de la comprobación del visor. Las capturas fueron generadas durante esa misma ejecución.

## Reproducción manual en Lumi Studio

Desde la raíz del repositorio:

```powershell
cd apps\desktop
npm exec --yes --package=bun@1.4.3 -- bun install --frozen-lockfile
cd renderer
npm exec --yes --package=bun@1.4.3 -- bun install --frozen-lockfile
cd ..
npm run dev
```

En Lumi Studio:

1. Abrir `examples/CasaEjemplo` como proyecto.
2. Seleccionar `principal.lumi` como archivo principal si el espacio de trabajo todavía no tiene entrada definida.
3. Presionar **Ejecutar Python** (F6).
4. Confirmar la salida `Area de sala:` y `30.0`.
5. Confirmar que el visor indica `ScenePlan recibido de Python`.
6. Seleccionar las pestañas `sala` y `estudio` y comparar los muebles con las capturas de evidencia.

## Estado de los criterios

| Criterio | Estado | Evidencia |
|---|---|---|
| Proyecto real de tres archivos `.lumi` | Aprobado | Carpeta `examples/CasaEjemplo`. |
| Importaciones y funciones | Aprobado | Ejecución y referencias de origen. |
| Variables, expresiones, condición y ciclos | Aprobado | Estado final comprobado por pruebas. |
| Dos habitaciones y pisos | Aprobado | `ScenePlan` y visor. |
| Muebles, colocar, mover y rotar | Aprobado | Pruebas, DTO y capturas. |
| ExecutionService sin diagnósticos | Aprobado | Prueba aislada. |
| Protocolo Python/Electron | Aprobado | Respuesta real y `electron-results.json`. |
| Visualización real en Three.js | Aprobado | WebGL, selector y capturas auténticas. |
| Verificación en otra computadora o instalación del profesor | Pendiente operativo | Debe repetirse con los pasos manuales; no es un defecto observado. |

## Limitaciones explícitas

- CasaEjemplo no demuestra paredes, puertas ni ventanas con geometría explícita.
- No demuestra colisiones, objetos fuera de límites ni puertas bloqueadas de L-035.
- El IDE informa que las trazas del depurador espacial todavía no están disponibles; esto no impide ejecutar ni visualizar el `ScenePlan`.
- Las dimensiones visuales de muebles son responsabilidad del adaptador/renderer y no forman parte de la semántica interna de CasaEjemplo.
- La reproducción en el equipo de presentación depende de que las dependencias de Electron estén instaladas y Python esté disponible para Lumi Studio.

No se modificó código de producción para crear ni verificar esta evidencia.
