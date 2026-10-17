import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ConsolePanel } from '../../../components/ConsolePanel';
import { ideLogger } from '../../../services/logger/IdeLogService';

describe('ConsolePanel & OutputLogView Integration', () => {
  const defaultProps = {
    lumiState: 'success' as const,
    logs: ['[Lumi] Ejecución normal'],
    diagnostics: [],
    debugSteps: [],
    currentStepIndex: 0,
    onStepChange: vi.fn(),
    onNavigateToDiagnostic: vi.fn(),
    onFocusObject: vi.fn(),
    scenePlan: null,
  };

  beforeEach(() => {
    ideLogger.clear();
  });

  it('debe renderizar por defecto la pestaña Salida con OutputLogView integrado', () => {
    ideLogger.log('info', 'Mensaje de prueba de integración', undefined, 'Sistema');

    render(<ConsolePanel {...defaultProps} />);

    // La pestaña activa por defecto es Salida
    expect(screen.getByTestId('output-log-view')).toBeInTheDocument();
    expect(screen.getByText('Mensaje de prueba de integración')).toBeInTheDocument();
    expect(screen.getByText('[Sistema]')).toBeInTheDocument();
  });

  it('debe actualizarse en tiempo real al registrar nuevos eventos con ideLogger sin duplicarlos', () => {
    render(<ConsolePanel {...defaultProps} />);

    act(() => {
      ideLogger.log('warning', 'Alerta en tiempo real', undefined, 'Compilador');
    });

    expect(screen.getByText('Alerta en tiempo real')).toBeInTheDocument();
    expect(screen.getAllByText('Alerta en tiempo real')).toHaveLength(1);
  });

  it('debe limpiar los registros del IDE y vaciar el stream al presionar "Limpiar"', () => {
    ideLogger.log('info', 'Evento a limpiar', undefined, 'Editor');

    render(<ConsolePanel {...defaultProps} />);
    expect(screen.getByText('Evento a limpiar')).toBeInTheDocument();

    const clearBtn = screen.getByRole('button', { name: /limpiar registros/i });
    fireEvent.click(clearBtn);

    expect(screen.queryByText('Evento a limpiar')).not.toBeInTheDocument();
    expect(screen.getByText(/no hay registros de eventos para mostrar/i)).toBeInTheDocument();
    expect(ideLogger.getHistory()).toHaveLength(0);
  });

  it('debe alternar entre pestañas conservando la funcionalidad de salida intacta', () => {
    ideLogger.log('info', 'Evento permanente', undefined, 'Editor');

    render(<ConsolePanel {...defaultProps} />);

    expect(screen.getByTestId('output-log-view')).toBeInTheDocument();

    // Cambiar a pestaña Diagnósticos
    fireEvent.click(screen.getByRole('button', { name: /diagnósticos/i }));
    expect(screen.queryByTestId('output-log-view')).not.toBeInTheDocument();

    // Volver a pestaña Salida
    fireEvent.click(screen.getByRole('button', { name: /^salida$/i }));
    expect(screen.getByTestId('output-log-view')).toBeInTheDocument();
    expect(screen.getByText('Evento permanente')).toBeInTheDocument();
  });
});
