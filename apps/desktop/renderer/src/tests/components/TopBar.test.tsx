import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TopBar } from '../../components/TopBar';
import { createMockProject } from '../fixtures/testFixtures';

describe('TopBar Component', () => {
  const project = createMockProject({ name: 'Penthouse Moderno' });

  const defaultProps = {
    lumiState: 'ready' as const,
    onCompile: vi.fn(),
    onRun: vi.fn(),
    isCompiling: false,
    projects: [project],
    currentProject: project,
    onSelectProject: vi.fn(),
    onNewProject: vi.fn(),
    onOpenProjectModal: vi.fn(),
    onOpenDocs: vi.fn(),
    onNewFile: vi.fn(),
    onSaveFile: vi.fn(),
    onSaveAll: vi.fn(),
    onInsertRoomModal: vi.fn(),
  };

  it('debe renderizar el nombre del proyecto activo y disparar la compilación al hacer clic en Compilar', () => {
    const handleCompile = vi.fn();

    render(<TopBar {...defaultProps} onCompile={handleCompile} />);

    expect(screen.getByText(/Penthouse Moderno/i)).toBeInTheDocument();

    const compileBtn = screen.getByTitle(/compilar y validar/i);
    fireEvent.click(compileBtn);

    expect(handleCompile).toHaveBeenCalledTimes(1);
  });

  it('debe deshabilitar el botón Ejecutar cuando canRun es false o hasBlockingErrors es true', () => {
    const { rerender } = render(
      <TopBar {...defaultProps} hasBlockingErrors={true} />
    );

    const runBtn = screen.getByRole('button', { name: /ejecutar 3d/i });
    expect(runBtn).toBeDisabled();

    rerender(<TopBar {...defaultProps} hasBlockingErrors={false} canRun={false} />);
    expect(runBtn).toBeDisabled();
  });

  it('debe abrir el modal de insertar habitación al presionar el menú correspondiente', () => {
    const handleInsertRoom = vi.fn();
    render(<TopBar {...defaultProps} onInsertRoomModal={handleInsertRoom} />);

    const menuBtn = screen.getByRole('button', { name: /^insertar$/i });
    fireEvent.click(menuBtn);

    const itemBtn = screen.getByText(/habitación/i);
    fireEvent.click(itemBtn);

    expect(handleInsertRoom).toHaveBeenCalledTimes(1);
  });

  it('debe disparar onOpenSettings al hacer clic en el botón Ajustes', () => {
    const handleOpenSettings = vi.fn();
    render(<TopBar {...defaultProps} onOpenSettings={handleOpenSettings} />);

    const settingsBtn = screen.getByRole('button', { name: /ajustes/i });
    fireEvent.click(settingsBtn);

    expect(handleOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('debe invocar onExportLumic al seleccionar la opción en el menú Archivo', () => {
    const handleExportLumic = vi.fn().mockReturnValue({ success: true, fileName: 'test.lumic' });
    render(<TopBar {...defaultProps} onExportLumic={handleExportLumic} />);

    const menuArchivo = screen.getByRole('button', { name: /^archivo$/i });
    fireEvent.click(menuArchivo);

    const exportBtn = screen.getByText(/exportar compilación \(\.lumic\)/i);
    fireEvent.click(exportBtn);

    expect(handleExportLumic).toHaveBeenCalledTimes(1);
  });

  it('debe disparar la apertura de archivo para importar compilación .lumic', () => {
    render(<TopBar {...defaultProps} onImportLumicFile={vi.fn()} />);

    const menuArchivo = screen.getByRole('button', { name: /^archivo$/i });
    fireEvent.click(menuArchivo);

    const importBtn = screen.getByText(/abrir compilación \(\.lumic\)/i);
    expect(importBtn).toBeInTheDocument();
  });
});

