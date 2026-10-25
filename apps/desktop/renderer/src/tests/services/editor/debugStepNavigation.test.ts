import { describe, expect, it } from 'vitest';
import { resolveDebugStep } from '../../../services/editor/debugStepNavigation';
import { createMockDebugSteps, createMockFile, createMockProject, createMockSpatialObject } from '../../fixtures/testFixtures';
import type { DebugStep } from '../../../types';

const file = createMockFile({ id: 'other', name: 'other.lumi', path: 'ProyectoTest/lib/other.lumi' });
const project = createMockProject({ files: [createMockFile(), file] });
const step = { ...createMockDebugSteps()[1], sourceRef: { file: 'lib/other.lumi', line: 2, column: 3 } };

describe('debug step project boundaries', () => {
  it('preserves historical positioned entities in snapshots without interpreting extra placed metadata', () => {
    const object = { ...createMockSpatialObject(), placed: false };
    const snapshot = structuredClone(step.sceneSnapshot);
    snapshot.rooms[0].objects = [object];
    const current = { ...step, sceneSnapshot: snapshot, activeObjectId: object.id, roomId: snapshot.rooms[0].id };
    expect(resolveDebugStep(project, current, true).activeObjectId).toBe(object.id);
    expect(resolveDebugStep(project, current, true).scenePlan).toEqual(snapshot);
    expect(resolveDebugStep(project, current).scenePlan).toBeNull();
  });
  it('retains unplaced snapshot data and source navigation without activating a spatial entity', () => {
    const { position, ...properties } = createMockSpatialObject();
    const snapshot = structuredClone(step.sceneSnapshot);
    snapshot.rooms[0].objects = [{ ...properties, placed: false }];
    const current = { ...step, sceneSnapshot: snapshot, activeObjectId: properties.id, roomId: snapshot.rooms[0].id };
    const result = resolveDebugStep(project, current);
    expect(result.navigation?.fileId).toBe(file.id);
    expect(result.activeObjectId).toBeNull();
    expect(result.scenePlan).toEqual(snapshot);
    expect(result.scenePlan?.rooms[0].objects[0]).not.toHaveProperty('position');
  });
  it('resolves an existing relative file without reading the disk', () => {
    expect(resolveDebugStep(project, step).navigation).toEqual({ fileId: 'other', line: 2, column: 3 });
  });

  it.each(['../other.lumi', '/other.lumi', 'C:/other.lumi', '//host/other.lumi',
    'file:///other.lumi', 'https://host/other.lumi', 'lib/../other.lumi', 'lib\\other.lumi',
    'lib//other.lumi', 'missing.lumi', 'lib/other.lumi\0'])('rejects untrusted or missing file %s', identity => {
    expect(resolveDebugStep(project, { ...step, sourceRef: { file: identity, line: 1 } }).navigation).toBeNull();
  });

  it('rejects ambiguous names and legacy matches to external paths', () => {
    const duplicate = createMockFile({ id: 'duplicate', name: 'other.lumi', path: 'ProyectoTest/other.lumi' });
    expect(resolveDebugStep(createMockProject({ files: [file, duplicate] }), {
      ...step, sourceRef: { file: 'other.lumi', line: 1 },
    }).navigation?.fileId).toBe('duplicate');
    const external = createMockFile({ name: 'other.lumi', path: 'C:/outside/other.lumi' });
    expect(resolveDebugStep(createMockProject({ files: [external] }), {
      ...step, sourceRef: { file: 'other.lumi', line: 1 },
    }).navigation).toBeNull();
    expect(resolveDebugStep(createMockProject({ files: [file, { ...file, id: 'duplicate' }] }), step).navigation).toBeNull();
  });

  it.each([0, -1, 1.5, NaN, Infinity])('rejects invalid source line %s', line => {
    expect(resolveDebugStep(project, { ...step, sourceRef: { ...step.sourceRef, line } }).navigation).toBeNull();
  });

  it.each([0, -1, 1.5, NaN])('rejects invalid source column %s', column => {
    expect(resolveDebugStep(project, { ...step, sourceRef: { ...step.sourceRef, column } }).navigation).toBeNull();
  });

  it('does not invent a file from the legacy line alias', () => {
    const incomplete = { ...step, sourceRef: undefined } as unknown as DebugStep;
    expect(resolveDebugStep(project, incomplete).navigation).toBeNull();
  });

  it('clears absent snapshots and unknown entities instead of reusing previous data', () => {
    expect(resolveDebugStep(project, { ...step, sceneSnapshot: undefined } as unknown as DebugStep))
      .toMatchObject({ scenePlan: null, activeObjectId: null });
    expect(resolveDebugStep(project, { ...step, activeObjectId: 'missing' }).activeObjectId).toBeNull();
    const invalid = { ...step, sceneSnapshot: { version: '1.0.0', rooms: [{}] } } as unknown as DebugStep;
    expect(resolveDebugStep(project, invalid).scenePlan).toBeNull();
    expect(resolveDebugStep(project, null)).toEqual({ navigation: null, scenePlan: null, activeObjectId: null });
  });
});
