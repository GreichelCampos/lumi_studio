import { describe, expect, it } from 'vitest';
import { parseProtocolResponse, validateProtocolResponse } from '../../services/integration/protocol/responseValidator';
import { backendSceneFixture } from '../fixtures/backendSceneFixtures';
import { readExample } from './lumicSchemaFixtures';
import type { LumiCompiledArtifact } from '../../types';

describe('candidate backend scene response fixtures', () => {
  it.each(['analyze', 'execute'] as const)('accepts an optional validated scene for %s', operation => {
    const fixture = backendSceneFixture('fixture', operation);
    expect(parseProtocolResponse(JSON.stringify(fixture))).toEqual({ valid: true, value: fixture });
  });

  it.each([false, true])('accepts absent or null scenes with capability %s', capability => {
    const fixture = backendSceneFixture();
    fixture.result.capabilities.scenePlan = capability;
    delete fixture.result.scenePlan;
    expect(validateProtocolResponse(fixture).valid).toBe(true);
    fixture.result.scenePlan = null;
    expect(validateProtocolResponse(fixture).valid).toBe(true);
  });

  it.each(['valid-basic', 'valid-debug'])('reuses the scene contract from the published %s artifact', name => {
    const artifact = readExample(name) as LumiCompiledArtifact;
    const fixture = backendSceneFixture();
    fixture.result.scenePlan = artifact.scenePlan;
    expect(validateProtocolResponse(fixture).valid).toBe(true);
  });

  it.each([{}, [], undefined, { rooms: [] }, { version: '2.0.0', rooms: [] },
    { node: 'ProgramNode', statements: [] }, readExample('valid-basic'),
  ])('rejects malformed scenes, ASTs and complete lumic containers: %j', scenePlan => {
    const fixture = backendSceneFixture();
    const validation = validateProtocolResponse({ ...fixture, result: { ...fixture.result, scenePlan } });
    expect(validation.valid).toBe(false);
    if (validation.valid === false) expect(validation.errors.join()).toContain('result.scenePlan');
  });

  it.each([
    ['dimensions', [0, 4, 2.7]], ['dimensions', [5, -4, 2.7]],
    ['dimensions', [5, Infinity, 2.7]], ['dimensions', [5, NaN, 2.7]],
    ['dimensions', [5, 4]], ['id', ''], ['calculatedArea', NaN], ['floor', {}],
    ['walls', {}], ['objects', null],
    ['windows', [{ id: 'window', wall: 'north', position: 0, width: 1, height: 1 }]],
    ['doors', [{ id: 'door', wall: 'norte', position: 0, width: -1, height: 2 }]],
    ['objects', [{ id: 'cube', name: 'cube', type: 'cubo', position: [0, 0, 0], rotation: [0, 0, 0], dimensions: [1, 1, 1], sourceRef: { file: 'principal.lumi', line: 0 } }]],
  ])('rejects invalid room field %s without normalizing or repairing it', (field, value) => {
    const fixture = backendSceneFixture();
    const scene = fixture.result.scenePlan!;
    const scenePlan = { ...scene, rooms: [{ ...scene.rooms[0], [field as string]: value }] };
    expect(validateProtocolResponse({ ...fixture, result: { ...fixture.result, scenePlan } }).valid).toBe(false);
  });

  it('accepts an empty scene and keeps candidate ID rules unchanged', () => {
    const fixture = backendSceneFixture();
    fixture.result.scenePlan!.rooms.push({ ...fixture.result.scenePlan!.rooms[0] });
    expect(validateProtocolResponse(fixture).valid).toBe(true);
    fixture.result.scenePlan!.rooms = [];
    expect(validateProtocolResponse(fixture).valid).toBe(true);
  });

  it('rejects scenes without the advertised capability and unimplemented trace capabilities', () => {
    const fixture = backendSceneFixture();
    fixture.result.capabilities.scenePlan = false;
    expect(validateProtocolResponse(fixture).valid).toBe(false);
    fixture.result.capabilities.scenePlan = true;
    expect(validateProtocolResponse({ ...fixture, result: { ...fixture.result,
      capabilities: { ...fixture.result.capabilities, debugTrace: true } } }).valid).toBe(false);
  });

  it.each(['failed', 'blocked', 'incomplete'])('rejects a scene accompanying %s status', status => {
    const fixture = backendSceneFixture();
    const result = { ...fixture.result };
    if (status === 'incomplete') {
      result.analysisStatus = 'incomplete'; result.limitations = ['spatial_semantics_unavailable'];
    } else {
      result.analysisStatus = 'failed';
      result.diagnostics = [{ category: 'SEMANTIC', code: 'FIXTURE_FAILURE', file: 'principal.lumi', line: 1, column: 1, description: 'Fixture de error' }];
    }
    const raw = { ...fixture, operation: status === 'blocked' ? 'execute' : 'analyze', status, result };
    expect(validateProtocolResponse(raw).valid).toBe(false);
    result.scenePlan = null;
    expect(validateProtocolResponse(raw).valid).toBe(true);
  });
});
