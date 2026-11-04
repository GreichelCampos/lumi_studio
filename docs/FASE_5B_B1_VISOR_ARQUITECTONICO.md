# Fase 5B-B1 — preparación interna del visor arquitectónico

Fecha: 2026-10-31, America/Costa_Rica. Rama: `feature/architectural-elements-integration`. HEAD verificado: `ec33c31f7b800d1e8be7e612c770e22bbd776ce4`. Sin commits, merge ni push.

## Alcance y archivos

Se revisó el informe de Fase 5B-A. Sus dos archivos nuevos se conservan sin modificaciones: `FASE_5B_A_PREPARACION_ARQUITECTONICA.md` y `ArchitecturalPreparation.test.ts`. Se registraron sus hashes y los de los archivos preexistentes de `apps/desktop/renderer/.vite/` para comparar al terminar.

Cambios de esta fase:

- `apps/desktop/renderer/src/components/viewport/helpers/openingLayout.ts`: función interna compartida `openingVerticalBounds` y uso en `wallSegments`.
- `apps/desktop/renderer/src/components/viewport/factories/OpeningFactory.ts`: uso de esa función para colocar puertas y ventanas.
- `apps/desktop/renderer/src/tests/components/viewport/OpeningVerticalLayout.test.ts`: 22 pruebas de cálculo, geometría, recorte e importación histórica.
- Este informe.

`RoomFactory.ts` se revisó y no necesita modificaciones: ya construye los segmentos que devuelve `wallSegments`. No se alteraron tipos públicos, validadores, esquemas, versiones, protocolo, Python, parser, AST ni adaptadores.

## Refactorización y compatibilidad histórica

La función recibe únicamente la altura ya admitida y un discriminante interno `door`/`window`. No infiere el tipo por ID ni incorpora propiedades nuevas al ScenePlan.

| Elemento | Centro Y | Borde inferior | Borde superior |
| --- | --- | --- | --- |
| Puerta | height / 2 | 0 | height |
| Ventana histórica | 1,6 | 1,6 - height / 2 | 1,6 + height / 2 |

Los resultados son límites sin recortar. `wallSegments` mantiene su recorte anterior a los límites de la habitación; la geometría de la abertura conserva sus dimensiones completas. La operación de unión de huecos y sus límites horizontales permanecen iguales. No se convierten cotas de borde inferior en coordenadas de centro ni se introduce una elevación por defecto distinta.

La misma función proporciona el centro a `OpeningFactory` y los bordes a `wallSegments`. Se conservan las expresiones históricas de cálculo, las posiciones horizontales, las cuatro orientaciones, los materiales, las rotaciones y la liberación de recursos existentes. No se escribe ningún valor calculado en ScenePlan o en el artefacto importado.

No se añade ni se interpreta `elevation`. Su propuesta de Fase 5B-A sigue pendiente de aprobación. La función es una utilidad del renderer, no una extensión del contrato compartido.

## Pruebas

Las 22 pruebas nuevas cubren:

- Tres alturas de puerta para comprobar centro y límites sin recorte.
- Doce combinaciones de ventana: cuatro orientaciones y alturas 0,4 / 1,4 / 2,4 m. Comparan dimensiones del mesh con cotas históricas independientes; rayos inmediatamente dentro y fuera de ambos bordes verifican el hueco construido realmente por `RoomFactory`.
- Cuatro orientaciones de puerta: centro, desplazamiento y rayos dentro y por encima del hueco.
- Una ventana histórica alta que excede una habitación baja: conserva centro y tamaño; solo el hueco se recorta a la pared.
- Dos importaciones representativas de `.lumic` 1.0.0/1.1.0 mediante `LumicFileService`, con puertas/ventanas que usan exclusivamente campos existentes. Verifican cotas históricas, versión y ausencia de mutaciones antes y después de construir geometría.

Las pruebas de Fase 5B-A y las expectativas anteriores no se modificaron. Las geometrías, matrices y rayos Three.js son reales; el contexto 2D del canvas de textura se simula con `null`. No son pruebas gráficas WebGL ni mediciones de GPU.

Validación:

- Pruebas relevantes: 121 aprobadas en 11 archivos (viewport, fábricas, selección, propiedades, cámara y servicio `.lumic`).
- Suite completa del renderer, con benchmark optativo: 889 aprobadas en 70 archivos, 33,87 segundos. Ejecutada con `LUMI_VIEWPORT_BENCH=1` y `npm run test:run -- --cache=false --maxWorkers=4`.
- `npm run lint`: correcto; ejecuta TypeScript sin emitir para aplicación y pruebas. No hay un linter adicional configurado en este paquete.
- `npm run build`: correcto, 5,27 segundos. Se mantiene el aviso de Vite por el chunk JS mayor de 500 kB: 1.106,08 kB minificado / 287,88 kB gzip.
- `git diff --check`: correcto. Los archivos nuevos se comprueban también por espacios finales y UTF-8, ya que todavía no están en staging.
- Los hashes finales de los dos archivos de Fase 5B-A y de los dos archivos preexistentes en `.vite/` coinciden con los iniciales. La carpeta no se editó ni se eliminó.

## Auditoría de selección arquitectónica

Recorrido actual:

1. `ThreeSceneManager.renderRoom` registra los grupos de puertas y ventanas mediante `registerPickable(group, id)`.
2. `ObjectSelectionController` hace raycast recursivo y resuelve el ID del grupo antecesor registrado. Ignora resaltados con `ignorePicking` y no considera un arrastre como selección.
3. `Viewport3D.tsx` busca el ID en objetos, puertas y ventanas, activa la habitación correspondiente y crea `SelectedEntity`.
4. `ObjectPropertiesCard.tsx` admite únicamente `object`, `door` y `window`. Muestra orientación, desplazamiento y dimensiones; utiliza `sourceRef` para ofrecer navegación al código.
5. `App.tsx` resuelve el elemento seleccionado y resalta su línea. `handleNavigateToSource` ya resuelve archivo, línea y columna mediante la referencia fuente existente.

Las paredes actuales solo tienen configuración de apariencia por orientación. Sus nombres de mesh (`wall-norte`, etc.) y `WallMeshRecord` sirven a geometría/oclusión; no son identificadores de una declaración. Sus segmentos no se registran para picking.

Para seleccionar paredes declaradas después de aprobar el contrato habría que revisar:

- Tipos de dominio, DTO, validadores y esquema: transportar identidad y referencia fuente aprobadas. No se modifican en esta fase.
- `RoomFactory.ts` / `WallMeshRecord`: exponer los segmentos de una misma cara para asociarlos con una única identidad recibida; no generar IDs de declaración por segmento.
- `ThreeSceneManager.ts`: registrar esos segmentos o un grupo de cara con el ID aprobado. Mantener caras automáticas sin identidad declarada fuera de esta selección.
- `Viewport3D.tsx`: ampliar resolución de entidad, selección entre habitaciones y comprobación de pertenencia al cambiar habitación. No basta con registrar los meshes.
- `ObjectPropertiesCard.tsx`: ampliar `SelectedEntity` y su presentación, conservando la navegación mediante referencia real.
- `App.tsx`: ampliar la resolución de selección para paredes. La navegación genérica puede reutilizarse cuando exista una referencia aprobada.
- Pruebas de selección/navegación: todos los segmentos deben seleccionar la misma declaración; sin referencias ficticias para caras automáticas, sin colisiones de IDs y sin interferencia con OrbitControls.

No es necesario cambiar el algoritmo genérico de raycast solo para registrar otro grupo, pero sí probar los casos de caras segmentadas y resaltados. No se implementó ninguno de estos cambios de selección.

## Decisiones pendientes y estado de entrega

Siguen pendientes del equipo la identidad y referencia de paredes declaradas, su relación con caras automáticas, la elevación explícita, la compatibilidad/versionado para lectores antiguos y las reglas/códigos de límites y solapes. También sigue pendiente el alcance visual de color/material en aberturas.

La refactorización interna actual no necesita resolver esas decisiones. No implementa geometría declarada ni modifica el comportamiento de archivos `.lumic` existentes. La siguiente implementación que dependa de esos campos debe detenerse hasta su aprobación por Gaby/Grei.
