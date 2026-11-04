import { fireEvent, render, screen, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSpatialDebugger } from '../../hooks/useSpatialDebugger';
import { SpatialDebuggerView } from '../../components/console/SpatialDebuggerView';
import { createMockDebugSteps } from '../fixtures/testFixtures';
import { resolveDebugStep } from '../../services/editor/debugStepNavigation';
import { createMockProject, createMockFile } from '../fixtures/testFixtures';

describe('imported step state, not Python variable inspection', () => {
  it('shows only recorded values and keeps source, snapshot and cursor synchronized on next, previous and reset', () => {
    const steps = createMockDebugSteps().slice(0, 2).map((step, index) => ({
      ...step, spatialState: { contador: index + 1, etiqueta: index === 0 ? 'inicio' : 'final' },
      sourceRef: { file: index === 0 ? 'principal.lumi' : 'lib/other.lumi', line: index + 1 },
    }));
    const before = structuredClone(steps); const changed = vi.fn();
    const project = createMockProject({ files: [createMockFile(), createMockFile({ id: 'other', name: 'other.lumi', path: 'ProyectoTest/lib/other.lumi' })] });
    function Harness() {
      const debug = useSpatialDebugger({ debugSteps: steps, onStepChange: changed });
      const state = resolveDebugStep(project, debug.currentStep);
      return <><SpatialDebuggerView debugSteps={steps} currentStepIndex={debug.currentStepIndex}
        onStepChange={debug.jumpToStep} onPrevStep={debug.prevStep} onNextStep={debug.nextStep}
        onResetDebugger={debug.resetDebugger} onFocusObject={vi.fn()} />
        <output data-testid="navigation">{JSON.stringify(state.navigation)}</output></>;
    }
    render(<Harness />);
    expect(screen.getByText(/"contador": 1/)).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Paso siguiente'));
    expect(screen.getByText(/"contador": 2/)).toBeInTheDocument();
    expect(JSON.parse(screen.getByTestId('navigation').textContent!)).toMatchObject({ fileId: 'other', line: 2 });
    expect(changed).toHaveBeenLastCalledWith(steps[1]);
    fireEvent.click(screen.getByTitle('Paso anterior'));
    expect(screen.getByText(/"contador": 1/)).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Paso siguiente'));
    fireEvent.click(screen.getByTitle('Reiniciar depuración'));
    expect(changed).toHaveBeenLastCalledWith(steps[0]);
    expect(steps).toEqual(before);
  });

  it('stops imported playback at the exact relative-file breakpoint and continues locally', () => {
    vi.useFakeTimers();
    const steps = createMockDebugSteps().map((step, index) => ({ ...step,
      sourceRef: { file: index === 1 ? 'lib/other.lumi' : 'principal.lumi', line: index + 1 },
    }));
    const hit = vi.fn();
    function Harness() {
      const debug = useSpatialDebugger({ debugSteps: steps, breakpoints: [{ file: 'lib/other.lumi', line: 2 }], onBreakpointHit: hit });
      return <><button onClick={debug.play}>Continuar reproducción</button><output>{debug.status}:{debug.currentStepIndex}</output></>;
    }
    try {
      const view = render(<Harness />);
      fireEvent.click(screen.getByText('Continuar reproducción'));
      act(() => vi.advanceTimersByTime(1000));
      expect(hit).toHaveBeenCalledWith(steps[1]);
      expect(screen.getByText('paused:1')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Continuar reproducción'));
      act(() => vi.advanceTimersByTime(1000));
      expect(screen.getByText('running:2')).toBeInTheDocument();
      view.unmount();
    } finally { vi.useRealTimers(); }
  });
});
