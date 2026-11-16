import { describe, expect, it, vi } from 'vitest';
import type { CompileResult } from '../../../types';
import { notifyCompileResult } from '../../../services/compiler/resultNotifications';
import { lumiAssistant } from '../../../services/assistant/LumiAssistantService';
import { createMockScenePlan } from '../../fixtures/testFixtures';

function pythonResult(overrides: Partial<CompileResult> = {}): CompileResult {
  return {
    origin: 'python', operation: 'execute', compilationId: 'fixture-result',
    status: 'completed', success: true, diagnostics: [], scenePlan: null,
    entryFileInfo: null, durationMs: 1, logs: [], debugSteps: [], timestamp: '',
    ...overrides,
  };
}

describe('Python result notifications', () => {
  it.each([
    [null, 'Este programa no generó una escena 3D.'],
    [createMockScenePlan(), 'La escena está lista para el visor 3D.'],
  ])('reports scene availability without claiming real traces', (scenePlan, expected) => {
    const listener = vi.fn();
    const unsubscribe = lumiAssistant.subscribe(listener);
    const setState = vi.fn();
    try {
      notifyCompileResult(pythonResult({ scenePlan }), setState);
      expect(setState).toHaveBeenCalledWith('success');
      expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({
        text: expect.stringContaining(expected), state: 'success',
      }));
    } finally {
      unsubscribe();
    }
  });

  it('explains how to check spatial rules after analysis', () => {
    const listener = vi.fn();
    const unsubscribe = lumiAssistant.subscribe(listener);
    try {
      const result = pythonResult({ operation: 'analyze', status: 'incomplete', success: false });
      const before = structuredClone(result);
      notifyCompileResult(result, vi.fn());
      expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({
        text: expect.stringContaining('Usá Ejecutar Lumi (F6) para comprobar el espacio'), state: 'warning',
      }));
      expect(result).toEqual(before);
    } finally {
      unsubscribe();
    }
  });

  it.each([
    ['analyze', 'completed', 'success', 'Usá Ejecutar Lumi (F6)'],
    ['analyze', 'failed', 'error', 'El análisis encontró un problema'],
    ['execute', 'failed', 'error', 'La ejecución de Lumi se detuvo'],
    ['execute', 'blocked', 'error', 'La ejecución de Lumi se detuvo'],
  ] as const)('distinguishes %s results with status %s', (operation, status, state, message) => {
    const listener = vi.fn();
    const unsubscribe = lumiAssistant.subscribe(listener);
    const setState = vi.fn();
    try {
      const result = pythonResult({ operation, status, success: status === 'completed' });
      const before = structuredClone(result);
      notifyCompileResult(result, setState);
      expect(setState).toHaveBeenCalledWith(state);
      expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({
        text: expect.stringContaining(message), state,
      }));
      expect(result).toEqual(before);
    } finally {
      unsubscribe();
    }
  });
});
