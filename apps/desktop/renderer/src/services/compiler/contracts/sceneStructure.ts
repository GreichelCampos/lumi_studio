import {
  booleanValue, compatibleVersion, finiteNumber, integerAtLeast, listOf,
  nonemptyText, objectFields, oneOf, positiveNumber, text, tupleOf,
} from './structureChecks.ts';
import type { StructureRule } from './structureChecks.ts';

const spatialVector: StructureRule = (value, path, errors) => {
  const vectorErrors: typeof errors = [];
  tupleOf(finiteNumber)(value, path, vectorErrors);
  errors.push(...vectorErrors.map(error => ({ ...error, code: 'INVALID_SPATIAL_REFERENCE' as const })));
};

export const sourceReferenceStructure = objectFields({
  file: nonemptyText, line: integerAtLeast(1),
}, { column: integerAtLeast(1) });

const requiredObjectProperties = {
  id: nonemptyText, type: nonemptyText, name: nonemptyText,
  rotation: spatialVector, dimensions: tupleOf(positiveNumber),
};
const optionalObjectProperties = {
  color: text, material: text, sourceRef: sourceReferenceStructure, roomId: text,
  hasCollision: booleanValue, isOutOfBounds: booleanValue, hasError: booleanValue, hasWarning: booleanValue,
};
const objectProperties = objectFields(requiredObjectProperties, {
  ...optionalObjectProperties, placed: booleanValue,
});
const legacyObjectStructure = objectFields({
  ...requiredObjectProperties, position: spatialVector,
}, optionalObjectProperties);

export const spatialObjectStructure: StructureRule = (value, path, errors) => {
  objectProperties(value, path, errors);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const object = value as Record<string, unknown>;
  if (Object.hasOwn(object, 'placed') && object.placed === undefined) {
    booleanValue(object.placed, `${path}.placed`, errors);
  }
  if (object.placed === false) {
    if (Object.hasOwn(object, 'position')) errors.push({
      path: `${path}.position`, code: 'INVALID_SPATIAL_REFERENCE',
      message: 'Un objeto sin colocar no debe contener position.',
    });
  } else if (!Object.hasOwn(object, 'position')) {
    errors.push({ path: `${path}.position`, code: 'MISSING_REQUIRED_FIELD', message: 'Falta la posición del objeto colocado.' });
  } else {
    spatialVector(object.position, `${path}.position`, errors);
  }
};

const openingStructure = objectFields({
  id: text, wall: oneOf(['norte', 'sur', 'este', 'oeste'], 'INVALID_SPATIAL_REFERENCE'),
  position: finiteNumber, width: positiveNumber, height: positiveNumber,
}, { sourceRef: sourceReferenceStructure });

const wallStructure = objectFields({ color: text }, { material: text });

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const elevation: StructureRule = (value, path, errors) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) errors.push({
    path, code: 'INVALID_SPATIAL_REFERENCE', message: 'elevation debe ser un número finito mayor o igual que cero.',
  });
};

/** IDE extensions only; no new Python diagnostic codes or language semantics. */
export const architecturalRoomFields: StructureRule = (value, path, errors) => {
  if (!record(value)) return;
  if (record(value.walls)) for (const key of ['north', 'south', 'east', 'west']) {
    const face = value.walls[key];
    if (record(face)) objectFields({}, { id: nonemptyText, name: text, sourceRef: sourceReferenceStructure })(face, `${path}.walls.${key}`, errors);
  }
  for (const kind of ['doors', 'windows']) {
    const items = value[kind];
    if (!Array.isArray(items)) continue;
    items.forEach((item, index) => {
      if (!record(item)) return;
      objectFields({}, { name: text, color: text, material: text,
        ...(kind === 'windows' ? { elevation } : {}),
      })(item, `${path}.${kind}[${index}]`, errors);
      if (kind === 'windows' && typeof item.elevation === 'number' && Number.isFinite(item.elevation)
        && typeof item.height === 'number' && Number.isFinite(item.height)
        && !Number.isFinite(item.elevation + item.height)) errors.push({
        path: `${path}.${kind}[${index}].elevation`, code: 'INVALID_SPATIAL_REFERENCE', message: 'Los límites verticales deben ser finitos.',
      });
    });
  }
};

export const architecturalWallIdentities: StructureRule = (value, path, errors) => {
  if (!record(value) || !Array.isArray(value.rooms)) return;
  const ids: string[] = [];
  const declared: { id: string; path: string }[] = [];
  value.rooms.forEach((room, index) => {
    if (!record(room)) return;
    for (const kind of ['objects', 'doors', 'windows']) {
      const items = room[kind];
      if (Array.isArray(items)) for (const item of items) if (record(item) && typeof item.id === 'string') ids.push(item.id);
    }
    if (record(room.walls)) for (const key of ['north', 'south', 'east', 'west']) {
      const face = room.walls[key];
      if (record(face) && typeof face.id === 'string' && face.id.trim()) {
        ids.push(face.id); declared.push({ id: face.id, path: `${path}.rooms[${index}].walls.${key}.id` });
      }
    }
  });
  const counts = new Map<string, number>();
  ids.forEach(id => counts.set(id, (counts.get(id) ?? 0) + 1));
  for (const item of declared) if (counts.get(item.id)! > 1) errors.push({
    path: item.path, code: 'INVALID_SPATIAL_REFERENCE', message: 'El ID de una pared declarada debe identificar una única entidad en la escena.',
  });
};

function roomStructure(objectRule: StructureRule): StructureRule {
  const base = objectFields({
    id: nonemptyText, name: nonemptyText, dimensions: tupleOf(positiveNumber),
    floor: objectFields({ material: text }, { color: text }),
    walls: objectFields({ north: wallStructure, south: wallStructure, east: wallStructure, west: wallStructure }),
    doors: listOf(openingStructure), windows: listOf(openingStructure), objects: listOf(objectRule),
    calculatedArea: finiteNumber, calculatedVolume: finiteNumber,
  }, { originOffset: tupleOf(finiteNumber) });
  return (value, path, errors) => { base(value, path, errors); architecturalRoomFields(value, path, errors); };
}

function createSceneStructure(objectRule: StructureRule): StructureRule {
  const base = objectFields({
    version: compatibleVersion, rooms: listOf(roomStructure(objectRule)),
  }, {
    metadata: objectFields({}),
    debugInfo: objectFields({
      totalEntities: finiteNumber, collisionCount: finiteNumber, warningsCount: finiteNumber, compiledAt: text,
    }),
  });
  return (value, path, errors) => { base(value, path, errors); architecturalWallIdentities(value, path, errors); };
}

export const sceneStructure = createSceneStructure(spatialObjectStructure);
export const legacySceneStructure = createSceneStructure(legacyObjectStructure);

export function createDebugStepStructure(sceneRule: StructureRule): StructureRule {
  return objectFields({
    id: nonemptyText, stepIndex: integerAtLeast(0),
    eventType: oneOf([
      'start', 'declaration', 'assignment', 'condition', 'loop', 'room_create',
      'place_object', 'move_object', 'rotate_object', 'spatial_warning', 'spatial_error', 'end',
    ]),
    description: nonemptyText, sourceRef: sourceReferenceStructure,
    lineNumber: integerAtLeast(1), codeLine: text, actionDescription: text, sceneSnapshot: sceneRule,
  }, {
    roomId: text, activeObjectId: text, spatialState: objectFields({}), assistantMessage: text,
  });
}

export const debugStepStructure = createDebugStepStructure(sceneStructure);
