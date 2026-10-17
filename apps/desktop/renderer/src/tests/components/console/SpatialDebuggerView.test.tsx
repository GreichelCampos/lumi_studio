import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpatialDebuggerView } from '../../../components/console/SpatialDebuggerView';
import { DebugStep } from '../../../types';

const mockDebugSteps: DebugStep[] = [
  {
    id: 'step-0',
    stepIndex: 1,
    eventType: 'room_create',
    description: 'Creación de habitación principal',
    actionDescription: 'Creación de habitación principal',
    codeLine: 'habitacion principal [8, 6, 3] {',
    lineNumber: 12,
    sourceRef: { file: 'principal.lumi', line: 12, column: 1 },
    roomId: 'room-1',
    sceneSnapshot: {
      version: '1.0',
      rooms: [],
      metadata: { totalRooms: 1, totalObjects: 0, estimatedBuildTimeMs: 10 },
    },
  },
  {
    id: 'step-1',
    stepIndex: 2,
    eventType: 'place_object',
    description: 'Colocación de sofá en posición [2, 0, 1]',
    actionDescription: 'Colocación de sofá en posición [2, 0, 1]',
    codeLine: '  objeto sofa_moderno en [2, 0, 1]',
    lineNumber: 14,
    sourceRef: { file: 'principal.lumi', line: 14, column: 3 },
    roomId: 'room-1',
    activeObjectId: 'sofa-1',
    sceneSnapshot: {
      version: '1.0',
      rooms: [],
      metadata: { totalRooms: 1, totalObjects: 1, estimatedBuildTimeMs: 12 },
    },
  },
];

describe('SpatialDebuggerView', () => {
  it('renderiza el estado vacío cuando no hay pasos disponibles', () => {
    render(
      <SpatialDebuggerView
        debugSteps={[]}
        currentStepIndex={0}
        onStepChange={vi.fn()}
        onFocusObject={vi.fn()}
      />
    );

    expect(screen.getByText('No hay pasos de depuración disponibles')).toBeInTheDocument();
    expect(screen.getByText(/Compila el proyecto sin errores bloqueantes/)).toBeInTheDocument();
    expect(screen.getByText('Paso 0 de 0')).toBeInTheDocument();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });

  it('renderiza los detalles del paso activo y sus metadatos (línea, archivo, evento, código y descripción)', () => {
    render(
      <SpatialDebuggerView
        debugSteps={mockDebugSteps}
        currentStepIndex={0}
        debuggerStatus="ready"
        onStepChange={vi.fn()}
        onFocusObject={vi.fn()}
      />
    );

    // Encabezado
    expect(screen.getByText('Paso 1 de 2')).toBeInTheDocument();
    expect(screen.getByText('Listo')).toBeInTheDocument();

    // Detalles del paso 0
    expect(screen.getByText(/Línea 12 \(principal.lumi\):/)).toBeInTheDocument();
    expect(screen.getByText('room_create')).toBeInTheDocument();
    expect(screen.getByText('Paso #1')).toBeInTheDocument();
    expect(screen.getByText('habitacion principal [8, 6, 3] {')).toBeInTheDocument();
    expect(screen.getByText('Col 1')).toBeInTheDocument();
    expect(screen.getByText('Creación de habitación principal')).toBeInTheDocument();
    expect(screen.getByText('room-1')).toBeInTheDocument();
  });

  it('muestra el objeto activo y permite enfocarlo en el visor 3D al hacer clic', () => {
    const handleFocusObject = vi.fn();
    render(
      <SpatialDebuggerView
        debugSteps={mockDebugSteps}
        currentStepIndex={1}
        debuggerStatus="running"
        onStepChange={vi.fn()}
        onFocusObject={handleFocusObject}
      />
    );

    expect(screen.getByText('Paso 2 de 2')).toBeInTheDocument();
    expect(screen.getByText('Ejecutando')).toBeInTheDocument();

    // Botón de objeto activo
    const objBtn = screen.getByText('Objeto activo: sofa-1');
    expect(objBtn).toBeInTheDocument();

    fireEvent.click(objBtn);
    expect(handleFocusObject).toHaveBeenCalledWith('sofa-1');
  });

  it('renderiza badges correctos de estado para paused y finished', () => {
    const { rerender } = render(
      <SpatialDebuggerView
        debugSteps={mockDebugSteps}
        currentStepIndex={0}
        debuggerStatus="paused"
        onStepChange={vi.fn()}
        onFocusObject={vi.fn()}
      />
    );

    expect(screen.getByText('Pausado')).toBeInTheDocument();

    rerender(
      <SpatialDebuggerView
        debugSteps={mockDebugSteps}
        currentStepIndex={1}
        debuggerStatus="finished"
        onStepChange={vi.fn()}
        onFocusObject={vi.fn()}
      />
    );

    expect(screen.getByText('Completado')).toBeInTheDocument();
  });
});
