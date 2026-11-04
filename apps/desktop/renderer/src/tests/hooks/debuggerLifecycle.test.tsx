import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEditorState } from '../../hooks/useEditorState';
import { useCompiler } from '../../hooks/useCompiler';
import { useSpatialDebugger } from '../../hooks/useSpatialDebugger';
import { createMockDebugSteps, createMockProject } from '../fixtures/testFixtures';
import { FIXTURE_COMPILATION_SUCCESS, FIXTURE_LUMIC_ARTIFACT } from '../../data/contracts';
import type { CompileResult } from '../../types';

afterEach(() => vi.useRealTimers());

describe('debugger lifecycle and local replay (not Python stepping)', () => {
  it('keeps per-file breakpoints within a project and clears them with spatial selection on project change', () => {
    const { result, rerender } = renderHook(({ file, scope }) => useEditorState(file, scope), {
      initialProps: { file: 'principal.lumi', scope: 'first' },
    });
    act(() => { result.current.toggleBreakpoint(2); result.current.setActiveObjectId('old-object'); result.current.navigateToLocation('entry', 2); });
    rerender({ file: 'other.lumi', scope: 'first' });
    expect(result.current.breakpoints).toEqual([]);
    expect(result.current.allBreakpoints).toEqual([{ file: 'principal.lumi', line: 2 }]);
    rerender({ file: 'principal.lumi', scope: 'first' });
    act(() => result.current.toggleBreakpoint(2));
    expect(result.current.allBreakpoints).toEqual([]);
    act(() => result.current.toggleBreakpoint(3));
    rerender({ file: 'principal.lumi', scope: 'second' });
    expect(result.current.allBreakpoints).toEqual([]); expect(result.current.activeObjectId).toBeNull();
    expect(result.current.sourceNavigation).toBeNull(); expect(result.current.highlightedLine).toBeNull();
  });

  it('pauses timed replay when stepping manually and does not advance later', () => {
    vi.useFakeTimers();
    const steps = createMockDebugSteps();
    const { result } = renderHook(() => useSpatialDebugger({ debugSteps: steps }));
    act(() => result.current.play()); act(() => result.current.nextStep());
    const index = result.current.currentStepIndex;
    expect(result.current.status).toBe('paused');
    act(() => vi.advanceTimersByTime(5000)); expect(result.current.currentStepIndex).toBe(index);
    act(() => result.current.play()); act(() => result.current.prevStep());
    expect(result.current.status).toBe('paused');
    act(() => result.current.resetDebugger());
    expect(result.current.currentStepIndex).toBe(0); expect(result.current.status).toBe('ready');
  });

  it('keeps an empty debugger idle when pause, reset and navigation controls are called', () => {
    const { result } = renderHook(() => useSpatialDebugger({ debugSteps: [] }));
    act(() => { result.current.pause(); result.current.nextStep(); result.current.jumpToStart(); result.current.resetDebugger(); });
    expect(result.current.status).toBe('idle'); expect(result.current.currentStep).toBeNull();
  });

  it('invalidates in-flight work on project change and ignores its late completion', async () => {
    let finish!: (value: CompileResult) => void;
    const service = { mode: 'python' as const, compile: () => new Promise<CompileResult>(resolve => { finish = resolve; }) };
    const { result, rerender } = renderHook(({ scope }) => useCompiler({ customCompilerService: service, scopeKey: scope }), {
      initialProps: { scope: 'first' },
    });
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.runCompile(createMockProject()); });
    rerender({ scope: 'second' });
    expect(result.current.lumiState).toBe('ready'); expect(result.current.isCompiling).toBe(false);
    await act(async () => { finish(FIXTURE_COMPILATION_SUCCESS); await pending; });
    expect(result.current.lastCompileResult).toBeNull(); expect(result.current.scenePlan).toBeNull();
    expect(result.current.debugSteps).toEqual([]);
  });

  it('stops stale replay when code changes without pretending to cancel Python', () => {
    const { result, rerender } = renderHook(({ context }) => useCompiler({ contextKey: context }), {
      initialProps: { context: 'project:1' },
    });
    act(() => result.current.loadCompiledArtifact({ ...FIXTURE_LUMIC_ARTIFACT, debugSteps: createMockDebugSteps() }));
    rerender({ context: 'project:2' });
    expect(result.current.debugSteps).toEqual([]);
    expect(result.current.scenePlan).toEqual(FIXTURE_LUMIC_ARTIFACT.scenePlan);
  });
});
