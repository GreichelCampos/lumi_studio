import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSpatialDebugger } from '../../hooks/useSpatialDebugger';
import { createMockDebugSteps } from '../fixtures/testFixtures';
import type { DebugStep } from '../../types';
import { useCompiler } from '../../hooks/useCompiler';
import { FIXTURE_COMPILATION_SUCCESS } from '../../data/contracts';
import { createMockProject } from '../fixtures/testFixtures';
import type { CompileResult } from '../../types';

afterEach(() => vi.useRealTimers());

describe('debugger dataset changes', () => {
  it('does not publish fixture events from a compilation that finished after an edit', async () => {
    let finish!: (value: CompileResult) => void;
    const service = { mode: 'demo' as const, compile: () => new Promise<CompileResult>(resolve => { finish = resolve; }) };
    const { result, rerender } = renderHook(({ context }) => useCompiler({ customCompilerService: service, contextKey: context }), {
      initialProps: { context: 'project:1' },
    });
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.runCompile(createMockProject()); });
    rerender({ context: 'project:2' });
    await act(async () => { finish(FIXTURE_COMPILATION_SUCCESS); await pending; });
    expect(result.current.debugSteps).toEqual([]);
    expect(result.current.scenePlan).toBeNull();
  });
  it('notifies only the first new step when replacing a list at a later index', () => {
    const onStepChange = vi.fn();
    const oldSteps = createMockDebugSteps();
    const { result, rerender } = renderHook(({ steps }) => useSpatialDebugger({ debugSteps: steps, onStepChange }), {
      initialProps: { steps: oldSteps },
    });
    act(() => result.current.jumpToEnd());
    onStepChange.mockClear();
    const nextSteps = createMockDebugSteps().map(step => ({ ...step, id: `new-${step.id}` }));
    rerender({ steps: nextSteps });
    expect(onStepChange.mock.calls).toEqual([[nextSteps[0]]]);
    expect(result.current.currentStep).toBe(nextSteps[0]);
    expect(result.current.status).toBe('ready');
  });

  it('stops old playback and clears the selected step when events disappear', () => {
    vi.useFakeTimers();
    const onStepChange = vi.fn();
    const { result, rerender } = renderHook(({ steps }) => useSpatialDebugger({ debugSteps: steps, onStepChange }), {
      initialProps: { steps: createMockDebugSteps() },
    });
    act(() => result.current.play());
    rerender({ steps: [] });
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.currentStep).toBeNull();
    expect(result.current.status).toBe('idle');
    expect(onStepChange).toHaveBeenLastCalledWith(null);
  });

  it('handles missing source references during playback and ignores fractional selections', () => {
    vi.useFakeTimers();
    const steps = createMockDebugSteps().map(step => ({ ...step, sourceRef: undefined })) as unknown as DebugStep[];
    const { result } = renderHook(() => useSpatialDebugger({ debugSteps: steps, breakpoints: [{ file: 'principal.lumi', line: 1 }] }));
    act(() => result.current.jumpToStep(0.5));
    expect(result.current.currentStepIndex).toBe(0);
    act(() => result.current.play());
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.currentStepIndex).toBe(1);
  });
});
