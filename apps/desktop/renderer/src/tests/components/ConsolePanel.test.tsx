import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConsolePanel } from '../../components/ConsolePanel';
import { DiagnosticItem } from '../../types';
import { createMockDiagnostic } from '../fixtures/testFixtures';

describe('ConsolePanel (Diagnósticos y Filtros)', () => {
  const defaultProps = {
    lumiState: 'error' as const,
    logs: ['Compilación finalizada'],
    diagnostics: [] as DiagnosticItem[],
    debugSteps: [],
    currentStepIndex: 0,
    onStepChange: vi.fn(),
    onNavigateToDiagnostic: vi.fn(),
    onFocusObject: vi.fn(),
    scenePlan: null,
  };

  it('debe mostrar el contador de diagnósticos en la pestaña y renderizar la lista', () => {
    const diag1 = createMockDiagnostic({
      id: 'd1',
      code: 'LUMI-S103',
      severity: 'error',
      category: 'sintactico',
      blocking: true,
      description: 'Falta de terminador >>',
    });
    const diag2 = createMockDiagnostic({
      id: 'd2',
      code: 'LUMI-W301',
      severity: 'error',
      category: 'espacial',
      blocking: false,
      description: 'Objeto fuera de los límites de la habitación',
      targetObjectId: 'mesa-3',
    });

    render(
      <ConsolePanel
        {...defaultProps}
        diagnostics={[diag1, diag2]}
      />
    );

    // Badge con contador total 2
    expect(screen.getByText('Diagnósticos')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    // Cambiar a la pestaña Diagnósticos
    fireEvent.click(screen.getByRole('button', { name: /diagnósticos/i }));

    // Ver ambos diagnósticos
    expect(screen.getByText('LUMI-S103')).toBeInTheDocument();
    expect(screen.getByText('LUMI-W301')).toBeInTheDocument();

    // Ver insignias de bloqueo vs 3D disponible
    expect(screen.getByText(/bloqueante/i)).toBeInTheDocument();
    expect(screen.getByText(/3d disponible/i)).toBeInTheDocument();
  });

  it('debe filtrar diagnósticos por categoría correctamente', () => {
    const diagSintactico = createMockDiagnostic({
      id: 'd-sint',
      code: 'LUMI-S103',
      category: 'sintactico',
      description: 'Error de sintaxis sintactico',
    });
    const diagEspacial = createMockDiagnostic({
      id: 'd-esp',
      code: 'LUMI-W302',
      category: 'espacial',
      description: 'Advertencia espacial de colision',
    });

    render(
      <ConsolePanel
        {...defaultProps}
        diagnostics={[diagSintactico, diagEspacial]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /diagnósticos/i }));

    // Filtrar por categoría "Espacial"
    const categorySelect = screen.getByRole('combobox');
    fireEvent.change(categorySelect, { target: { value: 'espacial' } });

    expect(screen.queryByText('LUMI-S103')).not.toBeInTheDocument();
    expect(screen.getByText('LUMI-W302')).toBeInTheDocument();
  });

  it('debe ejecutar la navegación "Ir al código" al hacer clic en el botón correspondiente', () => {
    const diag = createMockDiagnostic({
      id: 'd-nav',
      code: 'LUMI-S103',
      file: 'principal.lumi',
      line: 22,
    });
    const handleNavigate = vi.fn();

    render(
      <ConsolePanel
        {...defaultProps}
        diagnostics={[diag]}
        onNavigateToDiagnostic={handleNavigate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /diagnósticos/i }));

    const btnGoCode = screen.getByRole('button', { name: /ir al código/i });
    fireEvent.click(btnGoCode);

    expect(handleNavigate).toHaveBeenCalledTimes(1);
    expect(handleNavigate).toHaveBeenCalledWith(diag);
  });

  it('debe ejecutar "Enfocar en 3D" con el targetObjectId del diagnóstico', () => {
    const diag = createMockDiagnostic({
      id: 'd-focus',
      code: 'LUMI-W301',
      category: 'espacial',
      targetObjectId: 'obj-mesa-saliente',
    });
    const handleFocus = vi.fn();

    render(
      <ConsolePanel
        {...defaultProps}
        diagnostics={[diag]}
        onFocusObject={handleFocus}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /diagnósticos/i }));

    const btnFocus3D = screen.getByRole('button', { name: /enfocar en 3d/i });
    fireEvent.click(btnFocus3D);

    expect(handleFocus).toHaveBeenCalledTimes(1);
    expect(handleFocus).toHaveBeenCalledWith('obj-mesa-saliente');
  });
});
