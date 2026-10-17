import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, render, screen } from '@testing-library/react';
import { PythonCompilerService } from '../../services/integration/PythonCompilerService';
import { useCompiler } from '../../hooks/useCompiler';
import { Viewport3D } from '../../components/Viewport3D';
import { ThreeSceneManager } from '../../components/viewport/ThreeSceneManager';
import { lumiAssistant } from '../../services/assistant/LumiAssistantService';
import { backendSceneFixture, backendSceneProject } from '../fixtures/backendSceneFixtures';
import type { DesktopBridge, BackendReply } from '../../services/integration/desktopBridge';
import type { ResultResponse } from '../../services/integration/protocol/types';
import { FIXTURE_LUMIC_ARTIFACT } from '../../data/contracts';

vi.mock('three', async importOriginal => {
  const actual = await importOriginal<typeof import('three')>();
  return { ...actual, WebGLRenderer: class {
    domElement = document.createElement('canvas'); shadowMap = {};
    dispose = vi.fn(); render = vi.fn(); setSize = vi.fn(); setPixelRatio = vi.fn(); setClearColor = vi.fn();
  } };
});

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); disconnect = vi.fn(); });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function deferredReply() {
  let resolve!: (value: BackendReply) => void;
  const promise = new Promise<BackendReply>(yes => { resolve = yes; });
  return { promise, resolve };
}
function setup(replies: Array<ResultResponse | Promise<BackendReply>>) {
  const analyze = vi.fn();
  for (const reply of replies) analyze.mockResolvedValueOnce(reply instanceof Promise ? reply : { ok: true, response: reply });
  const bridge: DesktopBridge = {
    analyze, execute: vi.fn(), availability: vi.fn(),
  };
  return { service: new PythonCompilerService(bridge), analyze };
}

describe('IDE scene flow using simulated backend replies, not Python-generated scenes', () => {
  it('validates a fixture reply through the service and hook and sends the original room to Three.js', async () => {
    const fixture = backendSceneFixture();
    const { service, analyze } = setup([fixture]);
    const hook = renderHook(() => useCompiler({ customCompilerService: service }));
    await act(async () => { await hook.result.current.runCompile(backendSceneProject()); });
    expect(analyze).toHaveBeenCalledWith({ entryFile: 'principal.lumi', files: { 'principal.lumi': 'principal { habitacion sala(5, 4, 2.7) {} }' } });
    expect(hook.result.current.scenePlan).toBe(fixture.result.scenePlan);
    expect(hook.result.current.sceneSource).toBe('python');
    expect(hook.result.current.debugSteps).toEqual([]);
    expect(lumiAssistant.getMessage().text).not.toContain('ScenePlan y trazas todavía no están disponibles');
    const renderRoom = vi.spyOn(ThreeSceneManager.prototype, 'renderRoom');
    const view = render(<Viewport3D scenePlan={hook.result.current.scenePlan} sceneSource={hook.result.current.sceneSource} sceneGenerationUnavailable />);
    expect(renderRoom).toHaveBeenCalledWith(fixture.result.scenePlan!.rooms[0], null, null);
    expect(screen.queryByText('Sin ScenePlan para esta compilación')).not.toBeInTheDocument();
    view.unmount(); hook.unmount();
  });

  it.each(['absent', 'null', 'invalid'] as const)('clears a previous scene on a subsequent %s reply', async kind => {
    const next = backendSceneFixture('fixture-next');
    if (kind === 'absent') { delete next.result.scenePlan; next.result.capabilities.scenePlan = false; }
    if (kind === 'null') next.result.scenePlan = null;
    if (kind === 'invalid') next.result.scenePlan!.rooms[0].dimensions[0] = 0;
    const { service } = setup([backendSceneFixture(), next]);
    const hook = renderHook(() => useCompiler({ customCompilerService: service }));
    await act(async () => { await hook.result.current.runCompile(backendSceneProject()); });
    expect(hook.result.current.scenePlan).not.toBeNull();
    await act(async () => { await hook.result.current.runCompile(backendSceneProject()); });
    expect(hook.result.current.scenePlan).toBeNull();
    expect(hook.result.current.sceneSource).toBeNull();
    if (kind === 'invalid') {
      expect(hook.result.current.lastCompileResult).toBeNull();
      expect(hook.result.current.logs.join()).toContain('result.scenePlan.rooms[0].dimensions');
      expect(hook.result.current.diagnostics).toEqual([]);
    }
  });

  it('accepts a validated scene accompanying an execution fixture without generating traces', async () => {
    const fixture = backendSceneFixture('fixture-execution', 'execute');
    const bridge: DesktopBridge = { analyze: vi.fn(), execute: vi.fn().mockResolvedValue({ ok: true, response: fixture }), availability: vi.fn() };
    const result = await new PythonCompilerService(bridge).execute(backendSceneProject());
    expect(result.scenePlan).toBe(fixture.result.scenePlan);
    expect(result.debugSteps).toEqual([]);
    expect(result.operation).toBe('execute');
  });

  it.each([false, true])('does not overwrite a newer scene with an old %s-invalid fixture reply', async invalid => {
    const old = deferredReply();
    const latest = backendSceneFixture('fixture-latest');
    const { service } = setup([old.promise, latest]);
    const hook = renderHook(() => useCompiler({ customCompilerService: service }));
    let pending!: Promise<unknown>;
    act(() => { pending = hook.result.current.runCompile(backendSceneProject()); });
    await act(async () => { await hook.result.current.runCompile(backendSceneProject()); });
    const stale = backendSceneFixture('fixture-stale');
    if (invalid) stale.result.scenePlan!.rooms[0].dimensions[0] = -1;
    await act(async () => { old.resolve({ ok: true, response: stale }); await pending; });
    expect(hook.result.current.scenePlan).toBe(latest.result.scenePlan);
    expect(hook.result.current.lastCompileResult?.compilationId).toBe('fixture-latest');
  });

  it('discards a delayed fixture scene after editing the compilation context', async () => {
    const old = deferredReply(); const { service } = setup([old.promise]);
    const hook = renderHook(({ context }) => useCompiler({ customCompilerService: service, contextKey: context }), {
      initialProps: { context: 'project:revision-1' },
    });
    let pending!: Promise<unknown>;
    act(() => { pending = hook.result.current.runCompile(backendSceneProject()); });
    hook.rerender({ context: 'project:revision-2' });
    await act(async () => { old.resolve({ ok: true, response: backendSceneFixture() }); await pending; });
    expect(hook.result.current.scenePlan).toBeNull();
    expect(hook.result.current.isCompiling).toBe(false);
  });

  it('clears the scene and discards an outstanding fixture when switching projects', async () => {
    const old = deferredReply(); const { service } = setup([backendSceneFixture(), old.promise]);
    const hook = renderHook(({ project }) => useCompiler({ customCompilerService: service, contextKey: project, scopeKey: project }), {
      initialProps: { project: 'fixture-project-1' },
    });
    await act(async () => { await hook.result.current.runCompile(backendSceneProject()); });
    let pending!: Promise<unknown>;
    act(() => { pending = hook.result.current.runCompile(backendSceneProject()); });
    hook.rerender({ project: 'fixture-project-2' });
    await act(async () => { old.resolve({ ok: true, response: backendSceneFixture('fixture-old-project') }); await pending; });
    expect(hook.result.current.scenePlan).toBeNull();
    expect(hook.result.current.sceneSource).toBeNull();
    expect(hook.result.current.lastCompileResult).toBeNull();
  });

  it('preserves an imported artifact when an older backend fixture finishes', async () => {
    const old = deferredReply(); const { service } = setup([old.promise]);
    const hook = renderHook(() => useCompiler({ customCompilerService: service }));
    let pending!: Promise<unknown>;
    act(() => { pending = hook.result.current.runCompile(backendSceneProject()); });
    act(() => hook.result.current.loadCompiledArtifact(FIXTURE_LUMIC_ARTIFACT));
    await act(async () => { old.resolve({ ok: true, response: backendSceneFixture() }); await pending; });
    expect(hook.result.current.sceneSource).toBe('artifact');
    expect(hook.result.current.scenePlan).toBe(FIXTURE_LUMIC_ARTIFACT.scenePlan);
  });
});
