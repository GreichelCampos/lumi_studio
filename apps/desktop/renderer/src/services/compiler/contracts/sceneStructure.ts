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

function roomStructure(objectRule: StructureRule): StructureRule {
  return objectFields({
    id: nonemptyText, name: nonemptyText, dimensions: tupleOf(positiveNumber),
    floor: objectFields({ material: text }, { color: text }),
    walls: objectFields({ north: wallStructure, south: wallStructure, east: wallStructure, west: wallStructure }),
    doors: listOf(openingStructure), windows: listOf(openingStructure), objects: listOf(objectRule),
    calculatedArea: finiteNumber, calculatedVolume: finiteNumber,
  }, { originOffset: tupleOf(finiteNumber) });
}

function createSceneStructure(objectRule: StructureRule): StructureRule {
  return objectFields({
    version: compatibleVersion, rooms: listOf(roomStructure(objectRule)),
  }, {
    metadata: objectFields({}),
    debugInfo: objectFields({
      totalEntities: finiteNumber, collisionCount: finiteNumber, warningsCount: finiteNumber, compiledAt: text,
    }),
  });
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
