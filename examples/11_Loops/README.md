# Ciclos

- `01_For_Loop.lumi` usa `hacer` y debe mostrar `0`, `1`, `2`, `3`.
- `02_While_Loop.lumi` usa `mientras` y debe mostrar `0`, `1`, `2`, `3`.
- `03_Spatial_Loop.lumi` distribuye cuatro sillas mediante identificadores
  indexados y coordenadas aritméticas.

El ciclo espacial puede compilar como `INCOMPLETE` porque el análisis espacial
estático no resuelve el índice dinámico. Esto es una limitación intencional: la
ejecución debe finalizar como `COMPLETED` y generar cuatro muebles.
