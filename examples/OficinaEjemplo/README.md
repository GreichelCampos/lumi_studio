# OficinaEjemplo

Proyecto de demostración de una oficina colaborativa creada con Lumi. Utiliza
exclusivamente sintaxis, muebles y propiedades implementados en el proyecto.

## Cómo abrirlo

1. Inicie Lumi Studio desde `apps/desktop` con `npm run dev`.
2. Abra la carpeta `examples/OficinaEjemplo` como proyecto.
3. Seleccione `principal.lumi` como archivo principal.
4. Presione **F5** para analizar el proyecto.
5. Presione **F6** para ejecutarlo y enviar el ScenePlan al viewport 3D.

## Resultado verificado

- F5: `completed`, sin diagnósticos ni limitaciones.
- F6: `completed`, sin diagnósticos.
- Salida:

```text
Area de oficina:
80
Oficina preparada para trabajar
```

- ScenePlan: una habitación `oficina` de `10 × 8 × 3.2` metros y 17 elementos.
- Protocolo: respuesta `completed` con ScenePlan válido para el visor.

La verificación fue automatizada mediante `CompilerService`, `ExecutionService`
y `RequestDispatcher`. No sustituye la inspección visual manual dentro del IDE.

## Distribución espacial esperada

El viewport debe mostrar:

- Un piso de madera gris.
- Cuatro paredes; la cara oeste es una pared explícita de concreto.
- Una puerta principal en la pared norte.
- Una ventana amplia al sur y otra al este.
- Cuatro escritorios organizados en dos filas.
- Cuatro sillas, una frente a cada puesto.
- Un sofá rotado para la zona de espera.
- Una estantería para documentos.
- Un armario para equipos.
- Una planta decorativa con rotación final de 90 grados.

Todos los muebles respetan las dimensiones oficiales del catálogo, permanecen
dentro de los límites de la habitación, no colisionan y dejan libre la zona de
0.80 m frente a la puerta.

## Funciones y estructuras utilizadas

### `calcular_area(ancho, largo)`

Función `decimal` que devuelve el área de la oficina. Demuestra parámetros,
expresión aritmética y retorno.

### `organizar_puestos()`

Función `vacio` con varios efectos espaciales. Coloca los cuatro escritorios y
sus sillas mediante el ScenePlanBuilder compartido por la ejecución.

### `preparar_espera(x, z)`

Función espacial con parámetros numéricos. Coloca el sofá usando los valores
recibidos y aplica una rotación absoluta de 90 grados.

### Condición

La variable `oficina_abierta` controla un mensaje mediante `si`. La condición
es deliberadamente no espacial para que F5 pueda certificar completamente los
efectos de la escena.

### Ciclo

Un ciclo `hacer` incrementa el ángulo de la planta tres veces. Como `rotar`
utiliza ángulos absolutos, el ScenePlan conserva únicamente la rotación final:
`[0, 90, 0]`.

## Datos publicados al visor

- Puerta `entrada_principal`: pared norte, posición centrada `-4.0`, ancho
  `1.0` y alto `2.2`.
- Ventana `ventana_sur`: pared sur, posición `-2.8`, elevación `1.1`.
- Ventana `ventana_este`: pared este, posición `-1.0`, elevación `1.1`.
- Doce objetos con identidad, tipo, posición, rotación, propiedades y
  referencia al código fuente.

El desplazamiento declarado en Lumi se mide desde el inicio de la pared hasta
el borde inicial de la abertura. `scene_adapter.py` lo convierte a la posición
centrada utilizada por Three.js.

## Código Python relacionado

- `services/compiler_service.py` — `CompilerService.compile()` ejecuta Lexer,
  Parser y SemanticAnalyzer para F5.
- `services/execution_service.py` — `ExecutionService.execute()` ejecuta el
  programa analizado para F6 y solo publica escenas exitosas.
- `lumi_language/semantic_analyzer.py` — valida funciones, parámetros, tipos,
  orientaciones y propiedades arquitectónicas obligatorias.
- `lumi_language/interpreter.py` — `_evaluate_function_call()` ejecuta las
  funciones y `_execute_room()` mantiene activa la habitación.
- `spatial/scene_builder.py` — registra declaraciones, posiciones y rotaciones.
- `spatial/spatial_validator.py` — comprueba límites, colisiones, aberturas y
  despeje de puertas.
- `spatial/furniture_catalog.py` — contiene las dimensiones físicas oficiales.
- `services/protocol/scene_adapter.py` — transforma ScenePlan al DTO del IDE.

## Limitaciones reales del catálogo

Lumi no dispone todavía de tipos específicos como computadora, monitor,
impresora o archivador bajo. La oficina adapta el escenario a los tipos reales
`escritorio`, `silla`, `sofa`, `estanteria`, `armario` y `planta`. Los colores y
materiales son propiedades visuales; no cambian las dimensiones físicas.

El ScenePlan representa el estado final, no el historial de cada movimiento o
rotación. La revisión visual debe realizarse manualmente en Lumi Studio.

## Qué explicar durante la defensa

1. F5 valida tipos y efectos espaciales antes de ejecutar.
2. F6 evalúa funciones, condición y ciclo y construye el estado final.
3. SpatialValidator usa las dimensiones reales del catálogo para comprobar la
   habitación completa.
4. ExecutionService no enviaría una escena parcial si apareciera un diagnóstico.
5. El adaptador convierte las aberturas y objetos al contrato de Three.js.

## Preguntas posibles

**¿Por qué los puestos no se crean dentro de un ciclo?**  Lumi 1.0 no crea
dinámicamente nombres de objetos. Cada instancia se declara con identidad propia
y la función organiza esas instancias ya declaradas.

**¿Por qué la puerta no necesita una pared norte explícita?**  Cada habitación
tiene cuatro caras implícitas. La orientación enlaza la abertura con una de ellas.

**¿Qué evita que el sofá bloquee la puerta?**  SpatialValidator construye la zona
de despeje interior de 0.80 m y comprueba su intersección con los muebles.

**¿Las rotaciones del ciclo son acumulativas?**  No. `rotar` recibe una rotación
absoluta; el ciclo calcula 30, 60 y 90 grados y la escena conserva 90.

**¿Cómo sabemos que no hay colisiones?**  El validador calcula cajas orientadas
con las dimensiones del catálogo y aplica las pruebas geométricas antes de que
ExecutionService publique la escena.
