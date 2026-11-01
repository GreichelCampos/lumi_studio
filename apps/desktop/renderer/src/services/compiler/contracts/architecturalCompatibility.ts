import type { ContractValidationError } from '../../../types';

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** A persistence fence, not a new file format: old readers ignore these semantics. */
export function architecturalArtifactErrors(raw: unknown, path = 'lumicArtifact'): ContractValidationError[] {
  const errors: ContractValidationError[] = [];
  if (!record(raw)) return errors;
  const inspectScene = (scene: unknown, scenePath: string) => {
    if (!record(scene) || !Array.isArray(scene.rooms)) return;
    scene.rooms.forEach((room, index) => {
      if (!record(room)) return;
      const inspectFields = (item: unknown, fields: string[], itemPath: string) => {
        if (!record(item)) return;
        for (const field of fields) if (Object.hasOwn(item, field) && item[field] !== undefined) errors.push({
          path: `${itemPath}.${field}`, code: 'INCOMPATIBLE_VERSION',
          message: 'Las extensiones arquitectónicas requieren un formato .lumic acordado con el productor Python. No pueden persistirse como 1.0.0 ni 1.1.0.',
        });
      };
      if (record(room.walls)) for (const key of ['north', 'south', 'east', 'west']) {
        inspectFields(room.walls[key], ['id', 'name', 'sourceRef'], `${scenePath}.rooms[${index}].walls.${key}`);
      }
      for (const kind of ['doors', 'windows']) {
        const items = room[kind];
        if (Array.isArray(items)) items.forEach((item, openingIndex) => inspectFields(item,
          kind === 'windows' ? ['name', 'color', 'material', 'elevation'] : ['name', 'color', 'material'],
          `${scenePath}.rooms[${index}].${kind}[${openingIndex}]`));
      }
    });
  };
  inspectScene(raw.scenePlan, `${path}.scenePlan`);
  if (Array.isArray(raw.debugSteps)) raw.debugSteps.forEach((step, index) => {
    if (record(step)) inspectScene(step.sceneSnapshot, `${path}.debugSteps[${index}].sceneSnapshot`);
  });
  return errors;
}
