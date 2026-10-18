import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpatialDebugger } from '../../hooks/useSpatialDebugger';
import { createMockDebugSteps } from '../fixtures/testFixtures';

describe('useSpatialDebugger', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('debe inicializarse en "idle" si no hay pasos y en "ready" si se proporcionan pasos', () => {
    const { result: idleResult } = renderHook(() =>
      useSpatialDebugger({ debugSteps: [] })
    );
    expect(idleResult.current.status).toBe('idle');
    expect(idleResult.current.currentStepIndex).toBe(0);
    expect(idleResult.current.currentStep).toBeNull();

    const steps = createMockDebugSteps();
    const { result: readyResult } = renderHook(() =>
      useSpatialDebugger({ debugSteps: steps })
    );
    expect(readyResult.current.status).toBe('ready');
    expect(readyResult.current.currentStepIndex).toBe(0);
    expect(readyResult.current.currentStep).toEqual(steps[0]);
  });

  it('debe avanzar y retroceder pasos respetando los límites del array', () => {
    const steps = createMockDebugSteps(); // 3 steps: index 0, 1, 2
    const { result } = renderHook(() =>
      useSpatialDebugger({ debugSteps: steps })
    );

    act(() => {
      result.current.nextStep();
    });
    expect(result.current.currentStepIndex).toBe(1);

    act(() => {
      result.current.nextStep();
    });
    expect(result.current.currentStepIndex).toBe(2);

    // Intentar avanzar más allá del último paso activa estado finished y conserva índice 2
    act(() => {
      result.current.nextStep();
    });
    expect(result.current.currentStepIndex).toBe(2);
    expect(result.current.status).toBe('finished');

    act(() => {
      result.current.prevStep();
    });
    expect(result.current.currentStepIndex).toBe(1);
    expect(result.current.status).toBe('paused');

    act(() => {
      result.current.prevStep();
    });
    expect(result.current.currentStepIndex).toBe(0);

    // Intentar retroceder antes de 0 no debe ser menor a 0
    act(() => {
      result.current.prevStep();
    });
    expect(result.current.currentStepIndex).toBe(0);
  });

  it('debe ejecutar saltos a inicio, fin y paso específico', () => {
    const steps = createMockDebugSteps();
    const { result } = renderHook(() =>
      useSpatialDebugger({ debugSteps: steps })
    );

    act(() => {
      result.current.jumpToEnd();
    });
    expect(result.current.currentStepIndex).toBe(2);
    expect(result.current.status).toBe('finished');

    act(() => {
      result.current.jumpToStart();
    });
    expect(result.current.currentStepIndex).toBe(0);
    expect(result.current.status).toBe('ready');

    act(() => {
      result.current.jumpToStep(1);
    });
    expect(result.current.currentStepIndex).toBe(1);

    act(() => {
      result.current.resetDebugger();
    });
    expect(result.current.currentStepIndex).toBe(0);
    expect(result.current.status).toBe('ready');
  });

  it('debe reproducir automáticamente con temporizador y detenerse al pausar', () => {
    const steps = createMockDebugSteps();
    const { result } = renderHook(() =>
      useSpatialDebugger({ debugSteps: steps })
    );

    act(() => {
      result.current.play();
    });
    expect(result.current.status).toBe('running');
    expect(result.current.isPlaying).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.currentStepIndex).toBe(1);

    act(() => {
      result.current.pause();
    });
    expect(result.current.status).toBe('paused');
    expect(result.current.isPlaying).toBe(false);

    // Avanzar tiempo con pausa no debe alterar el paso
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.currentStepIndex).toBe(1);
  });

  it('debe responder a cambios de velocidad de reproducción', () => {
    const steps = createMockDebugSteps();
    const { result } = renderHook(() =>
      useSpatialDebugger({ debugSteps: steps })
    );

    act(() => {
      result.current.changeSpeed(2);
    });
    expect(result.current.playbackSpeed).toBe(2);

    act(() => {
      result.current.play();
    });
    expect(result.current.status).toBe('running');

    // Con velocidad 2x cada paso toma 500ms
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.currentStepIndex).toBe(1);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.currentStepIndex).toBe(2);
  });

  it('debe pausarse automáticamente al alcanzar un punto de interrupción (Breakpoint)', () => {
    const steps = createMockDebugSteps();
    const breakpoints = [{ id: 'bp-1', file: 'principal.lumi', line: 3, enabled: true }];
    const onBreakpointHit = vi.fn();

    const { result } = renderHook(() =>
      useSpatialDebugger({
        debugSteps: steps,
        breakpoints,
        onBreakpointHit,
      })
    );

    act(() => {
      result.current.play();
    });
    expect(result.current.status).toBe('running');

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.currentStepIndex).toBe(1);
    expect(result.current.status).toBe('paused');
    expect(onBreakpointHit).toHaveBeenCalledTimes(1);
    expect(onBreakpointHit).toHaveBeenCalledWith(steps[1]);
  });

  it('debe reiniciarse cuando cambian los pasos de depuración', () => {
    const initialSteps = createMockDebugSteps();
    const { result, rerender } = renderHook(
      ({ steps }) => useSpatialDebugger({ debugSteps: steps }),
      { initialProps: { steps: initialSteps } }
    );

    act(() => {
      result.current.nextStep();
    });
    expect(result.current.currentStepIndex).toBe(1);

    const newSteps = [
      {
        ...initialSteps[0],
        title: 'Paso modificado',
      },
    ];

    rerender({ steps: newSteps });

    expect(result.current.currentStepIndex).toBe(0);
    expect(result.current.status).toBe('ready');
  });
});
