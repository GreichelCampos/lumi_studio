import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConsolePanel } from '../../../components/ConsolePanel';
import { DebugStep } from '../../../types';

const sampleDebugSteps: DebugStep[] = [
  {
    id: 's-1',
    stepIndex: 1,
    eventType: 'room_create',
    description: 'Habitación principal creada',
    actionDescription: 'Habitación principal creada',
    codeLine: 'habitacion principal [6, 6, 3] {',
    lineNumber: 5,
    sourceRef: { file: 'principal.lumi', line: 5, column: 1 },
    roomId: 'room-main',
    sceneSnapshot: {
      version: '1.0',
      rooms: [],
      metadata: { totalRooms: 1, totalObjects: 0, estimatedBuildTimeMs: 10 },
    },
  },
  {
    id: 's-2',
    stepIndex: 2,
    eventType: 'place_object',
    description: 'Mesa colocada',
    actionDescription: 'Mesa colocada',
    codeLine: '  objeto mesa_madera en [1, 0, 1]',
    lineNumber: 6,
    sourceRef: { file: 'principal.lumi', line: 6, column: 3 },
    roomId: 'room-main',
    activeObjectId: 'mesa-1',
    sceneSnapshot: {
      version: '1.0',
      rooms: [],
      metadata: { totalRooms: 1, totalObjects: 1, estimatedBuildTimeMs: 12 },
    },
  },
];

describe('ConsolePanel SpatialDebugger Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('permite cambiar a la pestaña Depurador Espacial y renderiza SpatialDebuggerView', () => {
    render(
      <ConsolePanel
        lumiState="success"
        logs={[]}
        diagnostics={[]}
        debugSteps={sampleDebugSteps}
        currentStepIndex={0}
        debuggerStatus="ready"
        onStepChange={vi.fn()}
        onNavigateToDiagnostic={vi.fn()}
        onFocusObject={vi.fn()}
        scenePlan={null}
      />
    );

    const tabDepuradorBtn = screen.getByRole('button', { name: /Depurador Espacial/i });
    expect(tabDepuradorBtn).toBeInTheDocument();

    fireEvent.click(tabDepuradorBtn);

    expect(screen.getByText('Paso 1 de 2')).toBeInTheDocument();
    expect(screen.getByText('Listo')).toBeInTheDocument();
    expect(screen.getByText('habitacion principal [6, 6, 3] {')).toBeInTheDocument();
  });

  it('propaga acciones de navegación y enfoque espacial desde SpatialDebuggerView hacia ConsolePanel', () => {
    const mockStepChange = vi.fn();
    const mockFocusObject = vi.fn();
    const mockTogglePlay = vi.fn();

    render(
      <ConsolePanel
        lumiState="success"
        logs={[]}
        diagnostics={[]}
        debugSteps={sampleDebugSteps}
        currentStepIndex={1}
        debuggerStatus="running"
        isPlaying={true}
        onStepChange={mockStepChange}
        onTogglePlay={mockTogglePlay}
        onNavigateToDiagnostic={vi.fn()}
        onFocusObject={mockFocusObject}
        scenePlan={null}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Depurador Espacial/i }));

    const pauseBtn = screen.getByTitle('Pausar depuración');
    fireEvent.click(pauseBtn);
    expect(mockTogglePlay).toHaveBeenCalledTimes(1);

    const objBtn = screen.getByText('Objeto activo: mesa-1');
    fireEvent.click(objBtn);
    expect(mockFocusObject).toHaveBeenCalledWith('mesa-1');
  });
});
