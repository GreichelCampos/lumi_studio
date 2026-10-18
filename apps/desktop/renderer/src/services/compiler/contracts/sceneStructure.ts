import {
  booleanValue, compatibleVersion, finiteNumber, integerAtLeast, listOf,
  nonemptyText, objectFields, oneOf, positiveNumber, text, tupleOf,
} from './structureChecks';

export const sourceReferenceStructure = objectFields({
  file: nonemptyText, line: integerAtLeast(1),
}, { column: integerAtLeast(1) });

const spatialObjectStructure = objectFields({
  id: nonemptyText, type: nonemptyText, name: nonemptyText,
  position: tupleOf(finiteNumber), rotation: tupleOf(finiteNumber), dimensions: tupleOf(positiveNumber),
}, {
  color: text, material: text, sourceRef: sourceReferenceStructure, roomId: text,
  hasCollision: booleanValue, isOutOfBounds: booleanValue, hasError: booleanValue, hasWarning: booleanValue,
});

const openingStructure = objectFields({
  id: text, wall: oneOf(['norte', 'sur', 'este', 'oeste'], 'INVALID_SPATIAL_REFERENCE'),
  position: finiteNumber, width: positiveNumber, height: positiveNumber,
}, { sourceRef: sourceReferenceStructure });

const wallStructure = objectFields({ color: text }, { material: text });

const roomStructure = objectFields({
  id: nonemptyText, name: nonemptyText, dimensions: tupleOf(positiveNumber),
  floor: objectFields({ material: text }, { color: text }),
  walls: objectFields({ north: wallStructure, south: wallStructure, east: wallStructure, west: wallStructure }),
  doors: listOf(openingStructure), windows: listOf(openingStructure), objects: listOf(spatialObjectStructure),
  calculatedArea: finiteNumber, calculatedVolume: finiteNumber,
}, { originOffset: tupleOf(finiteNumber) });

export const sceneStructure = objectFields({
  version: compatibleVersion, rooms: listOf(roomStructure),
}, {
  metadata: objectFields({}),
  debugInfo: objectFields({
    totalEntities: finiteNumber, collisionCount: finiteNumber, warningsCount: finiteNumber, compiledAt: text,
  }),
});

export const debugStepStructure = objectFields({
  id: nonemptyText, stepIndex: integerAtLeast(0),
  eventType: oneOf([
    'start', 'declaration', 'assignment', 'condition', 'loop', 'room_create',
    'place_object', 'move_object', 'rotate_object', 'spatial_warning', 'spatial_error', 'end',
  ]),
  description: nonemptyText, sourceRef: sourceReferenceStructure,
  lineNumber: integerAtLeast(1), codeLine: text, actionDescription: text, sceneSnapshot: sceneStructure,
}, {
  roomId: text, activeObjectId: text, spatialState: objectFields({}), assistantMessage: text,
});
