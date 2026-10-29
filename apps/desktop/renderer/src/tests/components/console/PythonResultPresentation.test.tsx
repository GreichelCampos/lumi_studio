import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { OutputLogView } from '../../../components/console/OutputLogView';
import { ConsolePanel } from '../../../components/ConsolePanel';
import type { CompileResult } from '../../../types';
import { createMockRoom, createMockScenePlan, createMockSpatialObject } from '../../fixtures/testFixtures';

describe('Python result presentation', () => {
  it('passes legacy placement context through the console without modifying the imported scene', () => {
    const scene = createMockScenePlan({ rooms: [createMockRoom({ objects: [{ ...createMockSpatialObject(), placed: false }] })] });
    const before = structuredClone(scene);
    const props = { lumiState: 'ready' as const, logs: [], diagnostics: [], debugSteps: [], currentStepIndex: 0,
      onStepChange: () => {}, onNavigateToDiagnostic: () => {}, onFocusObject: () => {}, scenePlan: scene };
    const view = render(<ConsolePanel {...props} legacyPlacement />);
    expect(screen.getByText('1 objeto')).toBeInTheDocument();
    view.rerender(<ConsolePanel {...props} legacyPlacement={false} />);
    expect(screen.getByText('0 objetos')).toBeInTheDocument();
    expect(scene).toEqual(before);
  });
  it.each([
    ['analyze', 'completed', 'Análisis terminado'],
    ['analyze', 'incomplete', 'Análisis incompleto'],
    ['analyze', 'failed', 'Análisis fallido'],
    ['analyze', 'blocked', 'Análisis bloqueado'],
    ['execute', 'completed', 'Ejecución terminada'],
    ['execute', 'incomplete', 'Ejecución incompleta'],
    ['execute', 'failed', 'Ejecución fallida'],
    ['execute', 'blocked', 'Ejecución bloqueada'],
  ] as const)('shows %s / %s without claiming a generated scene', (operation, status, label) => {
    const result: CompileResult = {
      compilationId: 'python-result', durationMs: 5, origin: 'python', operation, status,
      success: status === 'completed', diagnostics: [], scenePlan: null, debugSteps: [], logs: [],
      timestamp: '2026-10-17T00:00:00Z', entryFileInfo: { id: 'main', name: 'main.lumi', path: 'main.lumi' },
    };
    render(<OutputLogView events={[]} lastCompileResult={result} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText(/Válido para 3D/)).not.toBeInTheDocument();
    expect(screen.getByText('Diagnósticos:')).toBeInTheDocument();
    expect(screen.queryByText('Errores:')).not.toBeInTheDocument();
    if (status === 'failed' || status === 'blocked') expect(screen.getByText(label)).toHaveClass('text-rose-400');
    if (status === 'incomplete') expect(screen.getByText(label)).toHaveClass('text-amber-400');
  });
  it('keeps a Python lexical failure separate from infrastructure errors', () => {
    const result: CompileResult = {
      compilationId: 'lexical-result', durationMs: 5, origin: 'python', operation: 'analyze', status: 'failed',
      success: false, diagnostics: [], scenePlan: null, debugSteps: [], logs: ['[Error léxico sin ubicación estructurada] Carácter inválido'],
      timestamp: '2026-10-17T00:00:00Z', entryFileInfo: { id: 'main', name: 'main.lumi', path: 'main.lumi' },
    };
    const props = { lumiState: 'error' as const, logs: result.logs, diagnostics: [], debugSteps: [], currentStepIndex: 0,
      onStepChange: () => {}, onNavigateToDiagnostic: () => {}, onFocusObject: () => {}, scenePlan: null };
    const view = render(<ConsolePanel {...props} lastCompileResult={result} />);
    expect(screen.getAllByText('Análisis fallido')).toHaveLength(2);
    expect(screen.queryByText('Fallo de infraestructura')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Diagnósticos/ }));
    expect(screen.getByText(/No hay diagnósticos estructurados/)).toBeInTheDocument();
    expect(screen.queryByText('El proyecto no presenta errores ni advertencias de sintaxis o espaciales.')).not.toBeInTheDocument();
    view.rerender(<ConsolePanel {...props} lastCompileResult={null} />);
    expect(screen.getByText('Fallo de infraestructura')).toBeInTheDocument();
  });
});
