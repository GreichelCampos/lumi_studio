import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCompiler } from '../../hooks/useCompiler';
import type { CompileResult } from '../../types';
import type { CompilerService } from '../../services/compiler/CompilerService';
import { createMockProject } from '../fixtures/testFixtures';
import { FIXTURE_COMPILATION_SUCCESS } from '../../data/contracts';
import { ideLogger } from '../../services/logger/IdeLogService';
import { lumiAssistant } from '../../services/assistant/LumiAssistantService';

function deferred() {
  let resolve!: (result: CompileResult) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<CompileResult>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('Python asynchronous state', () => {
  it('does not invoke the backend or show infrastructure failure for invalid compile requests', async () => {
    ideLogger.clear();
    const service: CompilerService = { mode: 'python', compile: vi.fn() };
    const { result } = renderHook(() => useCompiler({ customCompilerService: service }));

    await act(async () => { await result.current.runCompile(createMockProject({ files: [], entryFileId: undefined })); });

    expect(service.compile).not.toHaveBeenCalled();
    expect(result.current.logs).toEqual([]);
    expect(result.current.diagnostics).toEqual([]);
    expect(result.current.lumiState).toBe('ready');
    expect(lumiAssistant.getMessage().text).toBe(
      'No hay archivos para compilar. Primero creá un archivo .lumi en tu proyecto para comenzar.'
    );
    expect(ideLogger.getHistory().some(event => event.message.includes('No hay archivos para compilar'))).toBe(true);
    expect(ideLogger.getHistory().some(event => event.message.includes('[Infraestructura]'))).toBe(false);
  });

  it.each([
    ['without main file', createMockProject({ entryFileId: undefined, files: [
      { id: 'file', name: 'uno.lumi', path: 'uno.lumi', content: '' },
    ] }), 'Seleccioná un archivo principal desde el explorador'],
    ['with deleted main file', createMockProject({ entryFileId: 'deleted', files: [
      { id: 'file', name: 'uno.lumi', path: 'uno.lumi', content: '' },
    ] }), 'Seleccioná otro archivo principal'],
  ])('does not invoke the backend for a project %s', async (_label, selected, notice) => {
    const service: CompilerService = { mode: 'python', compile: vi.fn() };
    const { result } = renderHook(() => useCompiler({ customCompilerService: service }));

    await act(async () => { await result.current.runCompile(selected); });

    expect(service.compile).not.toHaveBeenCalled();
    expect(lumiAssistant.getMessage().text).toContain(notice);
  });

  it('logs the configured main entry while a secondary file is active', async () => {
    ideLogger.clear();
    const service: CompilerService = { mode: 'python', compile: vi.fn().mockResolvedValue(FIXTURE_COMPILATION_SUCCESS) };
    const selected = createMockProject({ entryFileId: 'main', activeFileId: 'secondary', files: [
      { id: 'main', name: 'principal.lumi', path: 'principal.lumi', content: '', isEntry: true },
      { id: 'secondary', name: 'pruebas.lumi', path: 'pruebas.lumi', content: '@' },
    ] });
    const { result } = renderHook(() => useCompiler({ customCompilerService: service }));

    await act(async () => { await result.current.runCompile(selected, 'secondary'); });

    expect(service.compile).toHaveBeenCalledWith(selected, { activeFileId: 'secondary' });
    expect(ideLogger.getHistory().some(event => event.message.includes('Archivo de entrada: principal.lumi'))).toBe(true);
  });

  it('does not invoke execution without an explicitly selected main file', async () => {
    const service: CompilerService = { mode: 'python', compile: vi.fn(), execute: vi.fn() };
    const selected = createMockProject({ entryFileId: undefined, files: [
      { id: 'active', name: 'principal.lumi', path: 'principal.lumi', content: 'principal {}' },
    ] });
    const { result } = renderHook(() => useCompiler({ customCompilerService: service }));

    await act(async () => { await result.current.runExecute(selected); });

    expect(service.execute).not.toHaveBeenCalled();
    expect(lumiAssistant.getMessage().text).toContain('Seleccioná un archivo principal desde el explorador');
  });

  it('logs the main entry when the requested active file no longer exists', async () => {
    ideLogger.clear();
    const service: CompilerService = { mode: 'python', compile: vi.fn().mockResolvedValue(FIXTURE_COMPILATION_SUCCESS) };
    const selected = createMockProject({ entryFileId: 'main', files: [
      { id: 'main', name: 'principal.lumi', path: 'principal.lumi', content: '', isEntry: true },
    ] });
    const { result } = renderHook(() => useCompiler({ customCompilerService: service }));

    await act(async () => { await result.current.runCompile(selected, 'missing'); });

    expect(ideLogger.getHistory().some(event => event.message.includes('Archivo de entrada: principal.lumi'))).toBe(true);
  });
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
