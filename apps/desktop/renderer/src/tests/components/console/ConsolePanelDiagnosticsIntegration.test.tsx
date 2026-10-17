import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConsolePanel } from '../../../components/ConsolePanel';
import { DiagnosticItem } from '../../../types';

const sampleDiagnostics: DiagnosticItem[] = [
  {
    id: 'diag-int-1',
    code: 'LUMI-E101',
    severity: 'error',
    category: 'sintactico',
    blocking: true,
    file: 'principal.lumi',
    line: 10,
    column: 3,
    description: 'Error de prueba en ConsolePanel',
    solution: 'Corrige la línea 10',
  },
  {
    id: 'diag-int-2',
    code: 'LUMI-E301',
    severity: 'error',
    category: 'espacial',
    blocking: false,
    file: 'habitacion.lumi',
    line: 20,
    column: 1,
    description: 'Conflicto espacial',
    targetObjectId: 'puerta-1',
  },
];

describe('ConsolePanel Diagnostics Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('permite cambiar a la pestaña Diagnósticos y renderiza DiagnosticsListView con los diagnósticos provistos', () => {
    render(
      <ConsolePanel
        lumiState="error"
        logs={[]}
        diagnostics={sampleDiagnostics}
        debugSteps={[]}
        currentStepIndex={0}
        onStepChange={vi.fn()}
        onNavigateToDiagnostic={vi.fn()}
        onFocusObject={vi.fn()}
        scenePlan={null}
      />
    );

    // Salida está activa por defecto
    const tabDiagBtn = screen.getByRole('button', { name: /Diagnósticos/i });
    expect(tabDiagBtn).toBeInTheDocument();

    // Cambiar a pestaña Diagnósticos
    fireEvent.click(tabDiagBtn);

    // DiagnosticsListView debe estar visible con sus elementos
    expect(screen.getByText('LUMI-E101')).toBeInTheDocument();
    expect(screen.getByText('LUMI-E301')).toBeInTheDocument();
    expect(screen.getByText('Error de prueba en ConsolePanel')).toBeInTheDocument();
  });

  it('delega onNavigateToDiagnostic y onFocusObject desde DiagnosticsListView hacia los callbacks de ConsolePanel', () => {
    const mockNavigate = vi.fn();
    const mockFocus = vi.fn();

    render(
      <ConsolePanel
        lumiState="error"
        logs={[]}
        diagnostics={sampleDiagnostics}
        debugSteps={[]}
        currentStepIndex={0}
        onStepChange={vi.fn()}
        onNavigateToDiagnostic={mockNavigate}
        onFocusObject={mockFocus}
        scenePlan={null}
      />
    );

    // Cambiar a pestaña Diagnósticos
    fireEvent.click(screen.getByRole('button', { name: /Diagnósticos/i }));

    // Clic en "Ir al código"
    const goToCodeBtn = screen.getAllByText(/Ir al código/)[0];
    fireEvent.click(goToCodeBtn);
    expect(mockNavigate).toHaveBeenCalledWith(sampleDiagnostics[0]);

    // Clic en "Enfocar en 3D"
    const focusBtn = screen.getByText('Enfocar en 3D');
    fireEvent.click(focusBtn);
    expect(mockFocus).toHaveBeenCalledWith('puerta-1');
  });
});
