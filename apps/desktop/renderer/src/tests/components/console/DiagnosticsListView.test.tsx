import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiagnosticsListView } from '../../../components/console/DiagnosticsListView';
import { DiagnosticItem } from '../../../types';

const mockDiagnostics: DiagnosticItem[] = [
  {
    id: 'diag-err-1',
    code: 'LUMI-E101',
    severity: 'error',
    category: 'sintactico',
    blocking: true,
    file: 'main.lumi',
    line: 12,
    column: 4,
    description: 'Sintaxis inválida en definición de habitación',
    solution: 'Revisa las llaves de cierre',
  },
  {
    id: 'diag-warn-1',
    code: 'LUMI-W201',
    severity: 'warning',
    category: 'semantico',
    blocking: false,
    file: 'main.lumi',
    line: 18,
    column: 6,
    description: 'Dimensión de ventana excede el muro asignado',
    solution: 'Ajusta el ancho de la ventana',
  },
  {
    id: 'diag-err-spatial',
    code: 'LUMI-E301',
    severity: 'error',
    category: 'espacial',
    blocking: false, // Error no bloqueante
    file: 'sala.lumi',
    line: 25,
    column: 2,
    description: 'Superposición espacial entre mesa y silla',
    targetObjectId: 'mesa-centro',
  },
  {
    id: 'diag-info-1',
    code: 'LUMI-I001',
    severity: 'info',
    category: 'ejecucion',
    blocking: false,
    file: 'aux.lumi',
    line: 5,
    column: 1,
    description: 'Tiempo estimado de renderizado: 12ms',
  },
];

describe('DiagnosticsListView', () => {
  it('renderiza la lista de diagnósticos con sus badges, códigos y ubicaciones', () => {
    const handleNavigate = vi.fn();
    render(
      <DiagnosticsListView
        diagnostics={mockDiagnostics}
        onNavigateToDiagnostic={handleNavigate}
      />
    );

    expect(screen.getByText('Todos (4)')).toBeInTheDocument();
    expect(screen.getByText('Errores (2)')).toBeInTheDocument();
    expect(screen.getByText('Advertencias (1)')).toBeInTheDocument();
    expect(screen.getByText('Información (1)')).toBeInTheDocument();

    expect(screen.getByText('LUMI-E101')).toBeInTheDocument();
    expect(screen.getByText('LUMI-W201')).toBeInTheDocument();
    expect(screen.getByText('LUMI-E301')).toBeInTheDocument();
    expect(screen.getByText('LUMI-I001')).toBeInTheDocument();

    expect(screen.getByText('main.lumi:12:4')).toBeInTheDocument();
    expect(screen.getByText('main.lumi:18:6')).toBeInTheDocument();
    expect(screen.getByText('sala.lumi:25:2')).toBeInTheDocument();
    expect(screen.getByText('aux.lumi:5:1')).toBeInTheDocument();
  });

  it('distingue entre diagnóstico bloqueante y error no bloqueante (3D Disponible)', () => {
    render(
      <DiagnosticsListView
        diagnostics={mockDiagnostics}
        onNavigateToDiagnostic={vi.fn()}
      />
    );

    // El error sintáctico es blocking: true
    expect(screen.getByText('Bloqueante')).toBeInTheDocument();

    // El error espacial es blocking: false, category: 'espacial'
    expect(screen.getByText('3D Disponible')).toBeInTheDocument();
  });

  it('filtra por severidad al pulsar los botones de filtro', () => {
    render(
      <DiagnosticsListView
        diagnostics={mockDiagnostics}
        onNavigateToDiagnostic={vi.fn()}
      />
    );

    const errorBtn = screen.getByText(/Errores \(2\)/);
    fireEvent.click(errorBtn);

    expect(screen.getByText('LUMI-E101')).toBeInTheDocument();
    expect(screen.getByText('LUMI-E301')).toBeInTheDocument();
    expect(screen.queryByText('LUMI-W201')).not.toBeInTheDocument();
    expect(screen.queryByText('LUMI-I001')).not.toBeInTheDocument();

    const warnBtn = screen.getByText(/Advertencias \(1\)/);
    fireEvent.click(warnBtn);

    expect(screen.queryByText('LUMI-E101')).not.toBeInTheDocument();
    expect(screen.getByText('LUMI-W201')).toBeInTheDocument();

    const allBtn = screen.getByText(/Todos \(4\)/);
    fireEvent.click(allBtn);

    expect(screen.getByText('LUMI-E101')).toBeInTheDocument();
    expect(screen.getByText('LUMI-W201')).toBeInTheDocument();
  });

  it('filtra por categoría usando el select', () => {
    render(
      <DiagnosticsListView
        diagnostics={mockDiagnostics}
        onNavigateToDiagnostic={vi.fn()}
      />
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'espacial' } });

    expect(screen.getByText('LUMI-E301')).toBeInTheDocument();
    expect(screen.queryByText('LUMI-E101')).not.toBeInTheDocument();
    expect(screen.queryByText('LUMI-W201')).not.toBeInTheDocument();
  });

  it('muestra mensaje amigable cuando no hay diagnósticos o el filtro no tiene coincidencias', () => {
    render(
      <DiagnosticsListView
        diagnostics={[]}
        onNavigateToDiagnostic={vi.fn()}
      />
    );

    expect(
      screen.getByText('No se encontraron diagnósticos para el filtro actual')
    ).toBeInTheDocument();
    expect(
      screen.getByText('El proyecto no presenta errores ni advertencias de sintaxis o espaciales.')
    ).toBeInTheDocument();
  });

  it('invoca onNavigateToDiagnostic al hacer clic en "Ir al código" o doble clic en la tarjeta', () => {
    const handleNavigate = vi.fn();
    render(
      <DiagnosticsListView
        diagnostics={mockDiagnostics}
        onNavigateToDiagnostic={handleNavigate}
      />
    );

    const goToCodeBtns = screen.getAllByText(/Ir al código/);
    fireEvent.click(goToCodeBtns[0]);

    expect(handleNavigate).toHaveBeenCalledWith(mockDiagnostics[0]);

    const diagCards = screen.getAllByTitle('Haz doble clic para abrir el archivo y resaltar la línea');
    fireEvent.doubleClick(diagCards[1]);

    expect(handleNavigate).toHaveBeenCalledWith(mockDiagnostics[1]);
  });

  it('invoca onFocusObject al hacer clic en "Enfocar en 3D" cuando el diagnóstico tiene targetObjectId', () => {
    const handleFocus = vi.fn();
    render(
      <DiagnosticsListView
        diagnostics={mockDiagnostics}
        onNavigateToDiagnostic={vi.fn()}
        onFocusObject={handleFocus}
      />
    );

    // Solo el diagnóstico espacial tiene botón "Enfocar en 3D"
    const focus3DBtn = screen.getByText('Enfocar en 3D');
    expect(focus3DBtn).toBeInTheDocument();

    fireEvent.click(focus3DBtn);
    expect(handleFocus).toHaveBeenCalledWith('mesa-centro');
  });

  it('muestra solución sugerida con icono si está disponible', () => {
    render(
      <DiagnosticsListView
        diagnostics={mockDiagnostics}
        onNavigateToDiagnostic={vi.fn()}
      />
    );

    const solutionLabels = screen.getAllByText(/Solución:/);
    expect(solutionLabels.length).toBeGreaterThan(0);
    expect(screen.getByText(/Revisa las llaves de cierre/)).toBeInTheDocument();
    expect(screen.getByText(/Ajusta el ancho de la ventana/)).toBeInTheDocument();
  });
});
