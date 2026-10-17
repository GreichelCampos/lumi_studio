import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OutputLogView } from '../../../components/console/OutputLogView';
import { IdeLogEvent, CompileResult, ScenePlan } from '../../../types';

describe('OutputLogView', () => {
  const mockEvents: IdeLogEvent[] = [
    { id: 'evt-1', timestamp: '12:00:01', type: 'info', message: 'Sistema iniciado correctamente', source: 'Sistema' },
    { id: 'evt-2', timestamp: '12:00:02', type: 'compile', message: 'Compilación #1 iniciada', source: 'Compilador' },
    { id: 'evt-3', timestamp: '12:00:03', type: 'warning', message: 'Advertencia de separación mínima', source: 'Compilador' },
    { id: 'evt-4', timestamp: '12:00:04', type: 'error', message: 'Error de identificador no reconocido', source: 'Compilador' },
  ];

  it('debe renderizar correctamente los registros con marcas de tiempo, fuentes y mensajes', () => {
    render(<OutputLogView events={mockEvents} />);

    expect(screen.getByText('Sistema iniciado correctamente')).toBeInTheDocument();
    expect(screen.getByText('[12:00:01]')).toBeInTheDocument();
    expect(screen.getByText('[Sistema]')).toBeInTheDocument();

    expect(screen.getByText('Error de identificador no reconocido')).toBeInTheDocument();
    expect(screen.getByText('[12:00:04]')).toBeInTheDocument();
    expect(screen.getAllByText('[Compilador]').length).toBeGreaterThanOrEqual(2);
  });

  it('debe conservar rigurosamente el orden secuencial de los mensajes recibidos', () => {
    const { container } = render(<OutputLogView events={mockEvents} />);
    const renderedMessages = container.querySelectorAll('[data-testid^="log-event-"]');

    expect(renderedMessages).toHaveLength(4);
    expect(renderedMessages[0]).toHaveTextContent('Sistema iniciado correctamente');
    expect(renderedMessages[1]).toHaveTextContent('Compilación #1 iniciada');
    expect(renderedMessages[2]).toHaveTextContent('Advertencia de separación mínima');
    expect(renderedMessages[3]).toHaveTextContent('Error de identificador no reconocido');
  });

  it('debe permitir filtrar por niveles (por ejemplo, solo errores)', () => {
    render(<OutputLogView events={mockEvents} />);

    const filterSelect = screen.getByRole('combobox', { name: /filtrar eventos por nivel/i });
    expect(filterSelect).toHaveValue('all');

    // Cambiar a errores
    fireEvent.change(filterSelect, { target: { value: 'error' } });

    expect(screen.getByText('Error de identificador no reconocido')).toBeInTheDocument();
    expect(screen.queryByText('Sistema iniciado correctamente')).not.toBeInTheDocument();
    expect(screen.queryByText('Compilación #1 iniciada')).not.toBeInTheDocument();
    expect(screen.queryByText('Advertencia de separación mínima')).not.toBeInTheDocument();
  });

  it('debe invocar onClear al presionar el botón de limpiar registros', () => {
    const handleClear = vi.fn();
    render(<OutputLogView events={mockEvents} onClear={handleClear} />);

    const clearBtn = screen.getByRole('button', { name: /limpiar registros/i });
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);
    expect(handleClear).toHaveBeenCalledTimes(1);
  });

  it('debe mostrar mensaje amigable cuando la lista de eventos está vacía', () => {
    render(<OutputLogView events={[]} />);
    expect(screen.getByText(/no hay registros de eventos para mostrar/i)).toBeInTheDocument();
  });

  it('debe renderizar la tarjeta de resumen de compilación si lastCompileResult está presente', () => {
    const mockCompileResult: CompileResult = {
      success: true,
      compilationId: 'c-42',
      durationMs: 85,
      status: 'completed_with_spatial_issues',
      diagnostics: [],
      scenePlan: null,
      debugSteps: [],
      timestamp: '2026-10-12T12:00:00.000Z',
      logs: [],
      entryFileInfo: { id: 'f1', name: 'principal.lumi', path: '/principal.lumi' },
    };

    render(
      <OutputLogView
        events={mockEvents}
        lastCompileResult={mockCompileResult}
        errorCount={0}
        warningCount={2}
      />
    );

    expect(screen.getByText('ID: #c-42')).toBeInTheDocument();
    expect(screen.getByText('85ms')).toBeInTheDocument();
    expect(screen.getByText(/válido para 3d \(con problemas espaciales\)/i)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('debe renderizar las líneas de stdout y la habitación principal si se proporcionan', () => {
    const mockScenePlan: ScenePlan = {
      version: '1.0',
      rooms: [
        {
          id: 'r1',
          name: 'Sala Experimental',
          dimensions: [10, 8, 3],
          walls: {
            north: { color: '#ffffff', material: 'standard' },
            south: { color: '#ffffff', material: 'standard' },
            east: { color: '#ffffff', material: 'standard' },
            west: { color: '#ffffff', material: 'standard' },
          },
          floor: { material: 'parquet_roble', color: '#885533' },
          doors: [],
          windows: [],
          calculatedArea: 80,
          calculatedVolume: 240,
          objects: [
            { id: 'o1', name: 'Mesa', type: 'furniture', position: [0, 0, 0], dimensions: [2, 1, 1], rotation: [0, 0, 0], material: 'madera', color: '#553311' },
          ],
        },
      ],
    };

    render(
      <OutputLogView
        events={mockEvents}
        logs={['stdout: habitación generada con 1 objeto', 'stdout: compilación finalizada']}
        scenePlan={mockScenePlan}
      />
    );

    expect(screen.getByText('stdout: habitación generada con 1 objeto')).toBeInTheDocument();
    expect(screen.getByText('stdout: compilación finalizada')).toBeInTheDocument();
    expect(screen.getByText(/Sala Experimental/i)).toBeInTheDocument();
    expect(screen.getByText('1 objetos')).toBeInTheDocument();
  });

  it('no debe duplicar eventos al volver a renderizar con las mismas props', () => {
    const { rerender } = render(<OutputLogView events={mockEvents} />);
    expect(screen.getAllByText('Compilación #1 iniciada')).toHaveLength(1);

    rerender(<OutputLogView events={mockEvents} />);
    expect(screen.getAllByText('Compilación #1 iniciada')).toHaveLength(1);
  });
});
