import React, { useState, useCallback } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useSpatialDebugger } from '../../hooks/useSpatialDebugger';
import { ObjectPropertiesCard } from '../../components/viewport/ObjectPropertiesCard';
import { DebugStep } from '../../types';
import { createMockSpatialObject, createMockScenePlan } from '../fixtures/testFixtures';

// Simulación de componente orquestador que coordina el debugger y la selección
const DebuggerSelectionOrchestrator: React.FC<{
  steps: DebugStep[];
  onRenderCount?: () => void;
}> = ({ steps, onRenderCount }) => {
  const [activeObjectId, setActiveObjectId] = useState<string | null>(null);
  const [renderCount, setRenderCount] = useState(0);

  const handleStepChange = useCallback((step: DebugStep) => {
    if (step.activeObjectId) {
      setActiveObjectId(step.activeObjectId);
    }
  }, []);

  const { nextStep } = useSpatialDebugger({
    debugSteps: steps,
    onStepChange: handleStepChange,
  });

  const selectedEntity = activeObjectId
    ? {
        kind: 'object' as const,
        data: createMockSpatialObject({ id: activeObjectId, name: activeObjectId }),
      }
    : null;

  onRenderCount?.();

  return (
    <div>
      <div data-testid="selected-id">{activeObjectId || 'none'}</div>
      <button data-testid="btn-next-step" onClick={nextStep}>
        Siguiente Paso
      </button>
      <button
        data-testid="btn-force-rerender"
        onClick={() => setRenderCount((c) => c + 1)}
      >
        Re-render ({renderCount})
      </button>

      <ObjectPropertiesCard
        entity={selectedEntity}
        onClose={() => setActiveObjectId(null)}
      />
    </div>
  );
};

describe('Regresión: Bug de persistencia indebida de selección activa', () => {
  it('cuando el usuario cierra la tarjeta, el objeto NO debe volver a seleccionarse en re-renders si el paso no cambia', () => {
    const steps: DebugStep[] = [
      {
        id: 'step-0',
        stepIndex: 0,
        eventType: 'place_object',
        description: 'Mesa ubicada',
        sourceRef: { file: 'principal.lumi', line: 5, column: 1 },
        lineNumber: 5,
        codeLine: 'objeto mesa[0.0, 0.0, 0.0] >>',
        actionDescription: 'Colocación mesa',
        activeObjectId: 'mesa-3',
        sceneSnapshot: createMockScenePlan(),
      },
      {
        id: 'step-1',
        stepIndex: 1,
        eventType: 'place_object',
        description: 'Silla ubicada',
        sourceRef: { file: 'principal.lumi', line: 6, column: 1 },
        lineNumber: 6,
        codeLine: 'objeto silla[1.0, 0.0, 0.0] >>',
        actionDescription: 'Colocación silla',
        activeObjectId: 'silla-1',
        sceneSnapshot: createMockScenePlan(),
      },
    ];

    render(<DebuggerSelectionOrchestrator steps={steps} />);

    expect(screen.getByTestId('selected-id')).toHaveTextContent('mesa-3');
    expect(screen.getByRole('button', { name: /cerrar detalles del objeto/i })).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /cerrar detalles del objeto/i });
    fireEvent.click(closeBtn);

    expect(screen.getByTestId('selected-id')).toHaveTextContent('none');
    expect(screen.queryByRole('button', { name: /cerrar detalles del objeto/i })).not.toBeInTheDocument();

    // 4. Ocurre un re-render en la aplicación (e.g. cambio de tema, resize, render cíclico)
    const rerenderBtn = screen.getByTestId('btn-force-rerender');
    fireEvent.click(rerenderBtn);
    fireEvent.click(rerenderBtn);

    // 5. El objeto NO debe volver a seleccionarse mágicamente mientras el paso de depuración no cambie
    expect(screen.getByTestId('selected-id')).toHaveTextContent('none');
    expect(screen.queryByRole('button', { name: /cerrar detalles del objeto/i })).not.toBeInTheDocument();

    // 6. Al avanzar explícitamente al siguiente paso, el nuevo paso sí debe actualizar la selección
    const nextBtn = screen.getByTestId('btn-next-step');
    fireEvent.click(nextBtn);

    expect(screen.getByTestId('selected-id')).toHaveTextContent('silla-1');
  });
});
