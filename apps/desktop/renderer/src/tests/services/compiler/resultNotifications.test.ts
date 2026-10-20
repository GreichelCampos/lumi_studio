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
    [null, 'Esta respuesta no contiene ScenePlan ni trazas.'],
    [createMockScenePlan(), 'ScenePlan recibido; las trazas todavía no están disponibles.'],
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

  it('keeps analysis limitations visible', () => {
    const listener = vi.fn();
    const unsubscribe = lumiAssistant.subscribe(listener);
    try {
      notifyCompileResult(pythonResult({ operation: 'analyze', status: 'incomplete', success: false }), vi.fn());
      expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({
        text: 'El análisis espacial todavía está incompleto.', state: 'warning',
      }));
    } finally {
      unsubscribe();
    }
  });
});
