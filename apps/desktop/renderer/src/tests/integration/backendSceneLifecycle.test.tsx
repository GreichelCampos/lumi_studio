import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCompiler } from '../../hooks/useCompiler';
import { PythonCompilerService } from '../../services/integration/PythonCompilerService';
import type { BackendReply, DesktopBridge } from '../../services/integration/desktopBridge';
import type { ResultResponse } from '../../services/integration/protocol/types';
import { FIXTURE_LUMIC_ARTIFACT } from '../../data/contracts';
import { createMockDebugSteps, createMockProject, createMockScenePlan } from '../fixtures/testFixtures';

const playbackArtifact = { ...FIXTURE_LUMIC_ARTIFACT, debugSteps: createMockDebugSteps() };

function fixtureResponse(name: string): BackendReply {
  const response: ResultResponse = {
    protocolVersion: '1.0.0', requestId: name, operation: 'execute', status: 'completed',
    result: {
      entryFile: 'principal.lumi', analysisStatus: 'incomplete', stage: 'semantic',
      output: [], diagnostics: [], limitations: ['spatial_semantics_unavailable'],
      executionAttempted: true,
      capabilities: { scenePlan: true, debugTrace: false, interactiveInput: false, cancellation: false },
      scenePlan: createMockScenePlan(),
    },
  };
  response.result.scenePlan!.rooms[0].name = name;
  return { ok: true, response };
}

function setup() {
  const execute = vi.fn<DesktopBridge['execute']>();
  const bridge: DesktopBridge = {
    execute, analyze: vi.fn(), availability: vi.fn(),
  };
  const service = new PythonCompilerService(bridge);
  const hook = renderHook(() => useCompiler({ customCompilerService: service }));
  const project = createMockProject();
  return { ...hook, execute, project };
}

describe('Backend scene lifecycle with explicit response fixtures', () => {
  it('shows unsupported geometry guidance with the original error and clears the previous scene', async () => {
    const { result, execute, project } = setup();
    act(() => result.current.loadCompiledArtifact(playbackArtifact));
    const message = "El elemento 'muro' de tipo 'wall' no contiene todavía la geometría requerida por el IDE.";
    execute.mockResolvedValueOnce({ ok: true, response: {
      protocolVersion: '1.0.0', requestId: 'geometry-fixture', operation: 'execute', status: 'error',
      error: { kind: 'infrastructure', code: 'SERIALIZATION_ERROR', message },
    } });
    await act(async () => { await result.current.runExecute(project); });
    expect(result.current.logs.join('\n')).toContain(`[SERIALIZATION_ERROR] ${message}`);
    expect(result.current.logs.join('\n')).toContain('La geometría de este elemento declarado todavía no puede publicarse');
    expect(result.current.scenePlan).toBeNull();
    expect(result.current.diagnostics).toEqual([]);
    expect(result.current.debugSteps).toEqual([]);
  });

  it('replaces imported playback with the validated Python result', async () => {
    const { result, execute, project } = setup();
    act(() => result.current.loadCompiledArtifact(playbackArtifact));
    expect(result.current.debugSteps.length).toBeGreaterThan(0);
    execute.mockResolvedValueOnce(fixtureResponse('new-scene'));
    await act(async () => { await result.current.runExecute(project); });
    expect(result.current.scenePlan?.rooms[0].name).toBe('new-scene');
    expect(result.current.sceneSource).toBe('python');
    expect(result.current.debugSteps).toEqual([]);
  });

  it('rejects malformed scene data and clears the previous scene', async () => {
    const { result, execute, project } = setup();
    act(() => result.current.loadCompiledArtifact(playbackArtifact));
    const invalid = fixtureResponse('invalid');
    if (!invalid.ok || invalid.response.status === 'error') throw new Error('fixture');
    invalid.response.result.scenePlan!.rooms[0].dimensions = [0, 4, 3];
    execute.mockResolvedValueOnce(invalid);
    await act(async () => { await result.current.runExecute(project); });
    expect(result.current.scenePlan).toBeNull();
    expect(result.current.sceneSource).toBeNull();
    expect(result.current.debugSteps).toEqual([]);
    expect(result.current.logs.join('\n')).toContain('[Infraestructura]');
  });

  it('ignores an older scene response after a newer execution', async () => {
    const { result, execute, project } = setup();
    let finishOlder!: (reply: BackendReply) => void;
    execute.mockImplementationOnce(() => new Promise(resolve => { finishOlder = resolve; }));
    execute.mockResolvedValueOnce(fixtureResponse('newer'));
    let older!: ReturnType<typeof result.current.runExecute>;
    act(() => { older = result.current.runExecute(project); });
    await act(async () => { await result.current.runExecute(project); });
    await act(async () => { finishOlder(fixtureResponse('older')); await older; });
    expect(result.current.scenePlan?.rooms[0].name).toBe('newer');
    expect(result.current.lastCompileResult?.compilationId).toBe('newer');
  });

  it('ignores a pending backend scene after importing an artifact', async () => {
    const { result, execute, project } = setup();
    let finish!: (reply: BackendReply) => void;
    execute.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    let pending!: ReturnType<typeof result.current.runExecute>;
    act(() => { pending = result.current.runExecute(project); });
    act(() => result.current.loadCompiledArtifact(playbackArtifact));
    await act(async () => { finish(fixtureResponse('obsolete')); await pending; });
    expect(result.current.scenePlan).toEqual(playbackArtifact.scenePlan);
    expect(result.current.sceneSource).toBe('artifact');
    expect(result.current.debugSteps).toEqual(playbackArtifact.debugSteps);
  });
});
