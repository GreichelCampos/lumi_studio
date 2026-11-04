import { describe, expect, it } from 'vitest';
import capture from '../fixtures/python/grei296fd57.real.json';
import { validateProtocolResponse } from '../../services/integration/protocol/responseValidator';
import { PythonCompilerService } from '../../services/integration/PythonCompilerService';
import type { DesktopBridge } from '../../services/integration/desktopBridge';
import { createMockProject } from '../fixtures/testFixtures';

// Real producer captures from an isolated worktree; live reproduction is in scripts/architectural-python-e2e.mjs.
describe('Grei 296fd57 real architectural boundary', () => {
  it.each(capture.cases)('validates both real responses for $name', item => {
    for (const response of item.responses) expect(validateProtocolResponse(response).valid).toBe(true);
  });

  it('uses the agreed edge-offset conversion at both ends of every orientation', () => {
    for (const item of capture.cases.filter(item => item.name.startsWith('door-') && !item.name.startsWith('door-clearance'))) {
      const validation = validateProtocolResponse(item.responses[1]);
      if (validation.valid === false || validation.value.status !== 'completed') throw new Error('Missing real door DTO');
      const room = validation.value.result.scenePlan!.rooms[0]; const door = room.doors[0];
      const raw = item.geometry[0].geometry;
      const span = door.wall === 'norte' || door.wall === 'sur' ? room.dimensions[0] : room.dimensions[1];
      expect(door.position).toBe(-span / 2 + Number(raw.offset!.value) + door.width / 2);
      expect(door.sourceRef).toEqual(item.geometry[0].source);
      expect(door.id).toBe(`element:${item.file}:2:1:entrada`);
      expect(door).not.toHaveProperty('color'); // Producer currently drops optional opening appearance.
      expect(door).not.toHaveProperty('material');
    }
  });

  it('retains zero/positive internal elevation but never fabricates a published window', () => {
    for (const item of capture.cases.filter(item => item.name.startsWith('window-') && item.name !== 'window-top-outside')) {
      const value = item.geometry[0].geometry.elevation!.value;
      expect(value === 0 || value === 0.9).toBe(true);
      expect(item.executionStatus).toBe('completed');
      const validation = validateProtocolResponse(item.responses[1]);
      if (validation.valid === false || validation.value.status !== 'error') throw new Error('Missing producer publication error');
      const response = validation.value;
      expect(response.status).toBe('error');
      expect(response.error.code).toBe('SERIALIZATION_ERROR');
    }
  });

  it('records authentic mandatory-property, duplicate-wall, overlap, collision, clearance and bounds results', () => {
    const find = (name: string) => capture.cases.find(item => item.name === name)!;
    for (const item of capture.cases.filter(item => item.name.startsWith('missing-'))) {
      expect(item.compilationDiagnostics.map(d => d.code)).toEqual(['SEM_MISSING_SPATIAL_PROPERTY']);
      expect(item.executionStatus).toBe('blocked');
    }
    expect(find('duplicate-wall').compilationDiagnostics[0].code).toBe('SEM_DUPLICATE_WALL_ORIENTATION');
    for (const name of ['overlap', 'colliding-furniture']) expect(find(name).executionDiagnostics[0].code).toBe('SPA_OBJECT_COLLISION');
    expect(find('door-clearance-blocked').executionDiagnostics[0].code).toBe('SPA_BLOCKED_DOOR');
    for (const name of ['door-clearance-clear', 'separate-furniture']) expect(find(name).executionStatus).toBe('completed');
    for (const name of ['negative-offset', 'outside-offset', 'too-high', 'invalid-elevation', 'window-top-outside']) {
      expect(find(name).executionDiagnostics[0].code).toBe('SPA_OBJECT_OUT_OF_BOUNDS');
    }
    expect(find('invalid-width').executionDiagnostics[0].code).toBe('SPA_INVALID_PROPERTY');
  });

  it('does not invent wall identity absent from the producer', () => {
    const response = capture.cases.find(item => item.name === 'four-walls')!.responses[1];
    const validation = validateProtocolResponse(response);
    if (validation.valid === false || validation.value.status !== 'completed') throw new Error('Missing real wall DTO');
    const walls = validation.value.result.scenePlan!.rooms[0].walls;
    expect(Object.keys(walls)).toEqual(['north', 'south', 'east', 'west']);
    for (const wall of Object.values(walls)) {
      expect(wall.color).toBe('#123456'); expect(wall.material).toBe('acero');
      expect(wall.id).toBeUndefined(); expect(wall.sourceRef).toBeUndefined();
    }
  });

  it('explains the producer window blocker while retaining its original error', async () => {
    const item = capture.cases.find(item => item.name === 'window-norte-0')!;
    const project = createMockProject({ entryFileId: 'entry', activeFileId: 'entry', files: [
      { id: 'entry', name: item.file, path: item.file, isEntry: true, content: item.source },
    ] });
    const bridge = { execute: async () => ({ ok: true, response: item.responses[1] }) } as unknown as DesktopBridge;
    await expect(new PythonCompilerService(bridge).execute(project)).rejects.toThrow('El visor ya admite elevation');
    await expect(new PythonCompilerService(bridge).execute(project)).rejects.toThrow('[SERIALIZATION_ERROR]');
  });
});
