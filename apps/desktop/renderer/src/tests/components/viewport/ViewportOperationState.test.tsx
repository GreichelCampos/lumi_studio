import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Viewport3D } from '../../../components/Viewport3D';
import { FIXTURE_COMPILATION_SUCCESS } from '../../../data/contracts';

vi.mock('../../../components/viewport/ThreeSceneManager', () => ({
  ThreeSceneManager: class {
    dispose() {}
    applyTheme() {}
    handleResize() {}
    setLegacyPlacement() {}
    clearRoom() {}
  },
}));

describe('Viewport operation lifecycle', () => {
  it('shows a neutral waiting state before any operation', () => {
    render(<Viewport3D scenePlan={null} isCompiled={false} />);
    expect(screen.getByText('Todo listo para comenzar')).toBeInTheDocument();
    expect(screen.getByText('F5')).toBeInTheDocument();
    expect(screen.getByText('Compilar')).toBeInTheDocument();
    expect(screen.getByText('F6')).toBeInTheDocument();
    expect(screen.getByText('Ejecutar')).toBeInTheDocument();
    expect(screen.queryByText('Sin ScenePlan en esta respuesta')).not.toBeInTheDocument();
  });

  it('shows a completed analysis as finalized', () => {
    const analysis = { ...FIXTURE_COMPILATION_SUCCESS, origin: 'python' as const,
      operation: 'analyze' as const, status: 'completed' as const, scenePlan: null };
    render(<Viewport3D scenePlan={null} isCompiled lastCompileResult={analysis} />);
    expect(screen.getByText('Análisis finalizado')).toBeInTheDocument();
    expect(screen.queryByText('Sin ScenePlan en esta respuesta')).not.toBeInTheDocument();
  });

  it('shows an incomplete analysis and its pending capabilities', () => {
    const analysis = { ...FIXTURE_COMPILATION_SUCCESS, origin: 'python' as const,
      operation: 'analyze' as const, status: 'incomplete' as const, success: false, scenePlan: null };
    render(<Viewport3D scenePlan={null} isCompiled lastCompileResult={analysis} />);
    expect(screen.getByText('Análisis incompleto')).toBeInTheDocument();
    expect(screen.getByText('El código fue analizado, pero algunas comprobaciones todavía no están disponibles. Revisá la consola para conocer las capacidades pendientes')).toBeInTheDocument();
  });

  it('keeps the analysis failure state', () => {
    const analysis = { ...FIXTURE_COMPILATION_SUCCESS, origin: 'python' as const,
      operation: 'analyze' as const, status: 'failed' as const, success: false, scenePlan: null };
    render(<Viewport3D scenePlan={null} isCompiled lastCompileResult={analysis} />);
    expect(screen.getByText('Compilación con errores')).toBeInTheDocument();
    expect(screen.queryByText('Análisis finalizado')).not.toBeInTheDocument();
    expect(screen.queryByText('Análisis incompleto')).not.toBeInTheDocument();
  });

  it('distinguishes an execution response without ScenePlan', () => {
    render(<Viewport3D scenePlan={null} isCompiled lastCompileResult={{
      ...FIXTURE_COMPILATION_SUCCESS, origin: 'python', operation: 'execute', status: 'completed', scenePlan: null,
    }} />);
    expect(screen.getByText('Sin ScenePlan en esta respuesta')).toBeInTheDocument();
  });

  it('shows an execution error without reusing an earlier scene', () => {
    render(<Viewport3D scenePlan={null} isCompiled lastCompileResult={{
      ...FIXTURE_COMPILATION_SUCCESS, origin: 'python', operation: 'execute', status: 'failed', success: false,
      scenePlan: null,
    }} />);
    expect(screen.getByText('La ejecución no pudo completarse')).toBeInTheDocument();
  });
});
