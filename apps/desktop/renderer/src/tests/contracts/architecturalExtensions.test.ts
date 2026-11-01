import { describe, expect, it, vi } from 'vitest';
import { createMockRoom, createMockScenePlan, createMockDebugSteps } from '../fixtures/testFixtures';
import { sceneStructure } from '../../services/compiler/contracts/sceneStructure';
import { validateScenePlan, validateLumicArtifact, serializeLumicArtifact, createLumicArtifactFromCompileResult } from '../../services/compiler/contracts/contractValidator';
import { validateViewportScene } from '../../components/viewport/helpers/validateViewportScene';
import { validateProtocolResponse } from '../../services/integration/protocol/responseValidator';
import { LumicFileService } from '../../services/storage/LumicFileService';
import { FIXTURE_COMPILATION_SUCCESS, FIXTURE_LUMIC_ARTIFACT } from '../../data/contracts';
import type { ContractValidationError } from '../../types';

function protocol(scenePlan: unknown) {
  return { protocolVersion: '1.0.0', requestId: 'architecture-test', operation: 'execute', status: 'completed',
    result: { entryFile: 'principal.lumi', analysisStatus: 'completed', stage: 'semantic', output: [], diagnostics: [],
      limitations: [], executionAttempted: true,
      capabilities: { scenePlan: true, debugTrace: false, interactiveInput: false, cancellation: false }, scenePlan,
    } };
}

describe('IDE architectural fields (producer data simulated)', () => {
  it('accepts all approved TS extensions without changing data or the protocol version', () => {
    const room = createMockRoom();
    Object.assign(room.walls.north, { id: 'wall-from-producer', name: 'principal', sourceRef: { file: 'principal.lumi', line: 3, column: 4 } });
    Object.assign(room.windows[0], { elevation: 0, name: 'lateral', color: '#123456', material: 'acero' });
    Object.assign(room.doors[0], { name: 'entrada', color: 'rojo', material: 'roble' });
    const scene = createMockScenePlan({ rooms: [room] });
    const before = structuredClone(scene);
    const errors: ContractValidationError[] = [];
    sceneStructure(scene, 'scene', errors);
    expect(errors).toEqual([]);
    expect(validateScenePlan(scene).isValid).toBe(true);
    expect(validateViewportScene(scene)).toBeNull();
    expect(validateProtocolResponse(protocol(scene)).valid).toBe(true);
    expect(scene).toEqual(before);
  });

  it.each([NaN, Infinity, -Infinity, -0.1, null, '0'])('rejects invalid elevation %s on every TS scene entry point', elevation => {
    const room = createMockRoom(); Object.assign(room.windows[0], { elevation });
    const scene = createMockScenePlan({ rooms: [room] });
    const errors: ContractValidationError[] = [];
    sceneStructure(scene, 'scene', errors);
    expect(errors.some(error => error.path.endsWith('.elevation'))).toBe(true);
    expect(validateScenePlan(scene).isValid).toBe(false);
    expect(validateViewportScene(scene)).not.toBeNull();
    expect(validateProtocolResponse(protocol(scene)).valid).toBe(false);
  });

  it('rejects overflow in resolved vertical limits', () => {
    const room = createMockRoom(); Object.assign(room.windows[0], { elevation: Number.MAX_VALUE, height: Number.MAX_VALUE });
    expect(validateViewportScene(createMockScenePlan({ rooms: [room] }))).not.toBeNull();
  });

  it.each([
    ['wall', { id: '' }], ['wall', { id: ' ' }], ['wall', { id: 12 }], ['wall', { name: null }],
    ['wall', { sourceRef: { file: 'principal.lumi', line: 0 } }],
    ['wall', { sourceRef: { file: 'principal.lumi', line: 1, column: 0 } }],
    ['door', { name: 1 }], ['door', { color: null }], ['door', { material: false }],
    ['window', { name: [] }], ['window', { color: 1 }], ['window', { material: {} }],
  ])('validates optional %s fields: %j', (kind, fields) => {
    const room = createMockRoom();
    Object.assign(kind === 'wall' ? room.walls.north : kind === 'door' ? room.doors[0] : room.windows[0], fields);
    const scene = createMockScenePlan({ rooms: [room] });
    expect(validateScenePlan(scene).isValid).toBe(false);
    expect(validateViewportScene(scene)).not.toBeNull();
  });

  it('rejects ambiguous declared-wall identities across rooms and existing furniture', () => {
    const first = createMockRoom(); const second = createMockRoom({ id: 'other' });
    first.walls.north.id = 'declared'; second.walls.south.id = 'declared';
    expect(validateScenePlan(createMockScenePlan({ rooms: [first, second] })).isValid).toBe(false);
    first.walls.north.id = first.objects[0].id;
    expect(validateViewportScene(createMockScenePlan({ rooms: [first] }))).not.toBeNull();
  });
});

describe('architectural persistence fence: no new lumic format published', () => {
  it.each(['1.0.0', '1.1.0'])('keeps historical %s import/export unchanged', schemaVersion => {
    const artifact = structuredClone(FIXTURE_LUMIC_ARTIFACT); artifact.schemaVersion = schemaVersion;
    const raw = serializeLumicArtifact(artifact);
    const imported = LumicFileService.parseAndValidateContent(raw);
    expect(imported.success).toBe(true); expect(imported.artifact).toEqual(artifact);
    expect(serializeLumicArtifact(imported.artifact!)).toBe(raw);
  });

  it.each(['elevation', 'wallIdentity', 'openingAppearance', 'declaredName'])('blocks %s in legacy files instead of losing semantics', extension => {
    const artifact = structuredClone(FIXTURE_LUMIC_ARTIFACT);
    const room = createMockRoom(); artifact.scenePlan.rooms = [room];
    if (extension === 'elevation') room.windows[0].elevation = 0;
    if (extension === 'wallIdentity') room.walls.north.id = 'received-wall';
    if (extension === 'openingAppearance') room.doors[0].color = '#123456';
    if (extension === 'declaredName') room.windows[0].name = 'lateral';
    const before = structuredClone(artifact);
    expect(validateLumicArtifact(artifact).errors.some(error => error.code === 'INCOMPATIBLE_VERSION')).toBe(true);
    expect(LumicFileService.parseAndValidateContent(JSON.stringify(artifact)).success).toBe(false);
    expect(() => serializeLumicArtifact(artifact)).toThrow(/arquitectónicas/);
    const result = { ...structuredClone(FIXTURE_COMPILATION_SUCCESS), scenePlan: artifact.scenePlan };
    expect(createLumicArtifactFromCompileResult(result, { id: 'project', name: 'Project' })).toBeNull();
    const download = vi.spyOn(LumicFileService, 'downloadInBrowser').mockReturnValue(true);
    try {
      expect(LumicFileService.exportLumic(result, null).success).toBe(false);
      expect(download).not.toHaveBeenCalled();
    } finally { download.mockRestore(); }
    expect(artifact).toEqual(before);
  });

  it('checks debug snapshots too, including any future version label', () => {
    const artifact = structuredClone(FIXTURE_LUMIC_ARTIFACT); artifact.schemaVersion = '1.2.0';
    artifact.debugSteps = createMockDebugSteps();
    artifact.debugSteps[0].sceneSnapshot.rooms[0].windows[0].elevation = 0.5;
    expect(validateLumicArtifact(artifact).errors.some(error => error.path.includes('debugSteps'))).toBe(true);
    expect(() => serializeLumicArtifact(artifact)).toThrow();
  });
});
