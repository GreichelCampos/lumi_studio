import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import capture from '../fixtures/python/debugCapabilities.real.json';
import { validateProtocolResponse } from '../../services/integration/protocol/responseValidator';
import { PythonCompilerService } from '../../services/integration/PythonCompilerService';
import type { DesktopBridge } from '../../services/integration/desktopBridge';
import { useCompiler } from '../../hooks/useCompiler';
import { useSpatialDebugger } from '../../hooks/useSpatialDebugger';
import { SpatialDebuggerView } from '../../components/console/SpatialDebuggerView';
import { createMockProject, createMockDebugSteps } from '../fixtures/testFixtures';
import { FIXTURE_LUMIC_ARTIFACT } from '../../data/contracts';

function project(index: number) {
  return createMockProject({ entryFileId: 'principal.lumi', files: Object.entries(capture.cases[index].sources)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([file, content]) => ({ id: file, name: file, path: file, content, isEntry: file === 'principal.lumi' })) });
}

function response(index: number) {
  const validation = validateProtocolResponse(capture.cases[index].responses[1]);
  if (validation.valid === false) throw new Error(validation.errors.join(' '));
  return validation.value;
}

function service(index: number) {
  const bridge: DesktopBridge = {
    execute: async () => ({ ok: true, response: response(index) }),
    analyze: async () => { throw new Error('Not used'); },
    availability: async () => ({ available: true, message: 'Captured real worker response' }),
  };
  return new PythonCompilerService(bridge);
}

describe('real Python capability captures, not execution traces', () => {
  it('validates the worker responses and preserves the unsupported debug operations', () => {
    for (const item of capture.cases) for (const raw of item.responses) {
      expect(validateProtocolResponse(raw).valid).toBe(true);
      expect(raw.result.capabilities.debugTrace).toBe(false);
      expect(raw.result.capabilities.cancellation).toBe(false);
      expect(raw.result).not.toHaveProperty('debugSteps');
      expect(raw.result).not.toHaveProperty('variables');
      expect(raw.result).not.toHaveProperty('callStack');
    }
    for (const raw of capture.unsupportedOperations) {
      expect(validateProtocolResponse(raw).valid).toBe(true);
      expect(raw.error.code).toBe('UNKNOWN_OPERATION');
      expect(raw.error.message).toBe('Operación no disponible.');
    }
  });

  it.each([0, 1, 2])('presents real result %i without enabling playback or inventing execution data', async index => {
    const result = await service(index).execute(project(index));
    const navigate = vi.fn(); const step = vi.fn();
    render(<SpatialDebuggerView debugSteps={result.debugSteps} currentStepIndex={0} lastCompileResult={result}
      onStepChange={step} onFocusObject={vi.fn()} onChangeSpeed={vi.fn()} onNavigateToDiagnostic={navigate} />);
    expect(result.debugSteps).toEqual([]);
    expect(screen.getByText(/Python todavía no publica pasos, variables ni pila/)).toBeInTheDocument();
    for (const button of screen.getAllByRole('button').filter(button => !button.textContent?.includes('Ver diagnóstico'))) {
      expect(button).toBeDisabled(); fireEvent.click(button);
    }
    expect(step).not.toHaveBeenCalled();
    expect(screen.queryByText('Estado registrado del paso')).not.toBeInTheDocument();
    if (index === 0) expect(result.logs).toEqual(expect.arrayContaining(['1', '2']));
    if (index === 1) {
      const diagnostic = result.diagnostics[0];
      expect(diagnostic).toMatchObject({ code: 'RUN_DIVISION_BY_ZERO', file: 'principal.lumi', line: 1, column: 42 });
      fireEvent.click(screen.getByText('Ver diagnóstico en principal.lumi:1'));
      expect(navigate).toHaveBeenCalledWith(diagnostic);
    }
    if (index === 2) {
      expect(screen.getByText('El visor muestra el ScenePlan final recibido de Python.')).toBeInTheDocument();
      expect(result.scenePlan?.rooms).toHaveLength(2);
      const raw = response(index);
      if (raw.status === 'error') throw new Error('Missing successful result');
      expect(result.scenePlan).toEqual(raw.result.scenePlan);
    }
  });

  it('clears imported replay before a real run, then publishes only real output and diagnostics', async () => {
    let finish!: () => void;
    const api = service(1);
    const delayed = { mode: 'python' as const, compile: api.compile.bind(api), execute: () =>
      new Promise<Awaited<ReturnType<typeof api.execute>>>(resolve => { finish = () => { void api.execute(project(1)).then(resolve); }; }) };
    const { result } = renderHook(() => {
      const compiler = useCompiler({ customCompilerService: delayed });
      const debuggerState = useSpatialDebugger({ debugSteps: compiler.debugSteps });
      return { compiler, debuggerState };
    });
    act(() => result.current.compiler.loadCompiledArtifact({ ...FIXTURE_LUMIC_ARTIFACT, debugSteps: createMockDebugSteps() }));
    act(() => result.current.debuggerState.play());
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.compiler.runExecute(project(1)); });
    expect(result.current.debuggerState.currentStep).toBeNull();
    expect(result.current.debuggerState.status).toBe('idle');
    expect(result.current.compiler.scenePlan).toBeNull();
    expect(result.current.compiler.logs).toEqual([]);
    await act(async () => { finish(); await pending; });
    expect(result.current.compiler.diagnostics[0].code).toBe('RUN_DIVISION_BY_ZERO');
    expect(result.current.compiler.debugSteps).toEqual([]);
    expect(result.current.compiler.scenePlan).toBeNull();
  });
});
