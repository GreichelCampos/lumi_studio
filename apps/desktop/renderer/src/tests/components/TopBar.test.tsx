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
    projects: [project],
    currentProject: project,
    onSelectProject: vi.fn(),
    onNewProject: vi.fn(),
    onOpenProjectModal: vi.fn(),
    onOpenDocs: vi.fn(),
    onOpenAbout: vi.fn(),
    onNewFile: vi.fn(),
    onSaveFile: vi.fn(),
    onSaveAll: vi.fn(),
    onInsertRoomModal: vi.fn(),
  };

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

    const exportBtn = screen.getByText(/exportar escena \(\.lumic\)/i);
    fireEvent.click(exportBtn);

    expect(handleExportLumic).toHaveBeenCalledTimes(1);
  });

  it('does not report a successful export when the download fails', () => {
    const onExportLumic = vi.fn().mockReturnValue({ success: false, error: 'No se pudo iniciar la descarga' });
    render(<TopBar {...defaultProps} onExportLumic={onExportLumic} />);
    fireEvent.click(screen.getByRole('button', { name: 'Archivo' }));
    fireEvent.click(screen.getByText('Exportar escena (.lumic)...'));
    expect(onExportLumic).toHaveBeenCalledTimes(1);
    expect(screen.getByText('No se pudo iniciar la descarga')).toBeInTheDocument();
    expect(screen.queryByText(/Descarga iniciada:/)).not.toBeInTheDocument();
  });

  it('reports that export is unavailable when no action is connected', () => {
    render(<TopBar {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Archivo' }));
    fireEvent.click(screen.getByText('Exportar escena (.lumic)...'));
    expect(screen.getByText('Exportación no disponible')).toBeInTheDocument();
  });

  it('debe disparar la apertura de archivo para importar compilación .lumic', () => {
    render(<TopBar {...defaultProps} onImportLumicFile={vi.fn()} />);

    const menuArchivo = screen.getByRole('button', { name: /^archivo$/i });
    fireEvent.click(menuArchivo);

    const importBtn = screen.getByText(/abrir escena \(\.lumic\)/i);
    expect(importBtn).toBeInTheDocument();
  });

  it('compiles once from the direct Compilar action and keeps Ejecutar Lumi separate', () => {
    const onCompile = vi.fn();
    const onRun = vi.fn();
    render(<TopBar {...defaultProps} isRealBackend onCompile={onCompile} onRun={onRun} />);
    expect(screen.getByText(/Penthouse Moderno/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Compilar' })).toBeInTheDocument();
    expect(screen.queryByText('Analizar código')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Compilar' }));
    expect(onCompile).toHaveBeenCalledTimes(1);
    expect(onRun).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar Lumi' }));
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it('uses one direct execution button without a dropdown', () => {
    render(<TopBar {...defaultProps} isRealBackend />);
    expect(screen.getByRole('button', { name: 'Ejecutar Lumi' })).toHaveAttribute('title', 'Ejecutar archivo activo (F6)');
    expect(screen.queryByRole('button', { name: 'Opciones de ejecución' })).not.toBeInTheDocument();
    expect(screen.queryByText('Ejecutar proyecto')).not.toBeInTheDocument();
    expect(screen.queryByText('Ejecutar archivo actual')).not.toBeInTheDocument();
  });

  it('omits the unavailable formatter', () => {
    render(<TopBar {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.queryByText('Formatear código Lumi (no disponible)')).not.toBeInTheDocument();
    expect(screen.queryByText('Código formateado con indentación oficial Lumi')).not.toBeInTheDocument();
  });
});

