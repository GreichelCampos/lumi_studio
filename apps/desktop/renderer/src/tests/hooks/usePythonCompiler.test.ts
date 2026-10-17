import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCompiler } from '../../hooks/useCompiler';
import type { CompileResult } from '../../types';
import type { CompilerService } from '../../services/compiler/CompilerService';
import { createMockProject } from '../fixtures/testFixtures';
import { FIXTURE_COMPILATION_SUCCESS } from '../../data/contracts';

function deferred() {
  let resolve!: (result: CompileResult) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<CompileResult>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('Python asynchronous state', () => {
  it('does not publish an old failure over a newer success', async () => {
    const old = deferred();
    const service: CompilerService = { mode: 'python', compile: vi.fn()
      .mockReturnValueOnce(old.promise).mockResolvedValueOnce(FIXTURE_COMPILATION_SUCCESS) };
    const { result } = renderHook(() => useCompiler({ customCompilerService: service }));
    let pending!: Promise<CompileResult | null>;
    act(() => { pending = result.current.runCompile(createMockProject()); });
    await act(async () => { await result.current.runCompile(createMockProject()); });
    await act(async () => { old.reject(new Error('old failure')); await pending; });
    expect(result.current.lastCompileResult?.compilationId).toBe(FIXTURE_COMPILATION_SUCCESS.compilationId);
    expect(result.current.logs.join()).not.toContain('old failure');
  });

  it('discards results after code revision or project changes', async () => {
    const response = deferred();
    const service: CompilerService = { mode: 'python', compile: () => response.promise };
    const { result, rerender } = renderHook(({ context }) => useCompiler({
      customCompilerService: service, contextKey: context,
    }), { initialProps: { context: 'project:1' } });
    let pending!: Promise<CompileResult | null>;
    act(() => { pending = result.current.runCompile(createMockProject()); });
    rerender({ context: 'project:2' });
    await act(async () => { response.resolve(FIXTURE_COMPILATION_SUCCESS); await pending; });
    expect(result.current.lastCompileResult).toBeNull();
    expect(result.current.isCompiling).toBe(false);
  });

  it('separates technical failures from student diagnostics', async () => {
    const service: CompilerService = { mode: 'python', compile: async () => { throw new Error('Python no disponible'); } };
    const { result } = renderHook(() => useCompiler({ customCompilerService: service }));
    await act(async () => { await result.current.runCompile(createMockProject()); });
    expect(result.current.diagnostics).toEqual([]);
    expect(result.current.logs.join()).toContain('[Infraestructura] Python no disponible');
    expect(result.current.lastCompileResult).toBeNull();
  });
});
