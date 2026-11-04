import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import capture from '../fixtures/python/readCapabilities.real.json';
import { validateProtocolResponse } from '../../services/integration/protocol/responseValidator';
import { PythonCompilerService } from '../../services/integration/PythonCompilerService';
import type { DesktopBridge } from '../../services/integration/desktopBridge';
import { useCompiler } from '../../hooks/useCompiler';
import { createMockProject } from '../fixtures/testFixtures';

describe('real leer producer capability; injected host input is separate from worker input', () => {
  it.each(capture.cases)('validates captured analyze/execute for $name', item => {
    for (const response of item.workerResponses) expect(validateProtocolResponse(response).valid).toBe(true);
    if (item.name === 'invalid-assignment') {
      expect(item.workerResponses[1].status).toBe('blocked');
      expect(item.directHostExecution.prompts).toEqual([]);
    } else {
      expect(item.workerResponses[0].result?.capabilities.interactiveInput).toBe(false);
      const executed = validateProtocolResponse(item.workerResponses[1]);
      if (executed.valid === false || executed.value.status !== 'error') throw new Error('Missing real input error');
      expect(executed.value.error.code).toBe('INPUT_UNAVAILABLE');
      expect(item.workerReportedInputUnavailable).toBe(true);
    }
  });

  it('records actual one/multiple/empty host reads without claiming they crossed IPC', () => {
    const find = (name: string) => capture.cases.find(item => item.name === name)!.directHostExecution;
    expect(find('one-read').output).toEqual(['Lumi']);
    expect(find('consecutive-reads').prompts).toEqual(['Primero:', 'Segundo:']);
    expect(find('consecutive-reads').output).toEqual(['uno', 'dos']);
    expect(find('empty-value').output).toEqual(['']);
    expect(find('mostrar-before-read').output).toEqual(['Antes', 'despues']);
    expect(find('runtime-error').diagnostics[0].code).toBe('RUN_DIVISION_BY_ZERO');
  });

  it('keeps raw stdin data separate from Lumi values and proves worker recovery', () => {
    for (const response of capture.stdinProbe) expect(validateProtocolResponse(response).valid).toBe(true);
    expect(capture.stdinProbe[0].error?.code).toBe('INPUT_UNAVAILABLE');
    expect(capture.stdinProbe[1].error?.code).toBe('MALFORMED_JSON');
    expect(capture.stdinProbe[2].result?.output).toEqual(['Recuperado']);
    expect(capture.preloadedInputProbe.error.code).toBe('INVALID_REQUEST');
  });

  it('shows the real input error without creating a waiting request, then accepts another execution', async () => {
    const first = capture.cases[0];
    const validate = (raw: unknown) => {
      const result = validateProtocolResponse(raw);
      if (result.valid === false) throw new Error(result.errors.join(' '));
      return result.value;
    };
    const bridge: DesktopBridge = {
      analyze: async () => { throw new Error('Not used'); },
      execute: async input => ({ ok: true, response: validate(input.entryFile === first.file
        ? first.workerResponses[1] : capture.stdinProbe[2]) }),
      availability: async () => ({ available: true, message: 'Captured worker responses' }),
    };
    const service = new PythonCompilerService(bridge);
    const { result } = renderHook(() => useCompiler({ customCompilerService: service }));
    const project = (file: string, source: string) => createMockProject({ entryFileId: file,
      files: [{ id: file, name: file, path: file, isEntry: true, content: source }] });
    await act(async () => { await result.current.runExecute(project(first.file, first.source)); });
    expect(result.current.lumiState).toBe('error');
    expect(result.current.logs.join()).toContain('[INPUT_UNAVAILABLE]');
    expect(result.current.logs.join()).toContain('leer requiere un canal de entrada interactiva');
    expect(result.current.lastCompileResult).toBeNull(); expect(result.current.debugSteps).toEqual([]);
    expect(result.current.isCompiling).toBe(false);
    await act(async () => { await result.current.runExecute(project('principal.lumi', 'principal { mostrar("Recuperado")>> }')); });
    expect(result.current.lastCompileResult?.success).toBe(true);
    expect(result.current.logs).toContain('Recuperado');
  });
});
