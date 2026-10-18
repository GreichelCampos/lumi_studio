import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectExplorer } from '../../components/ProjectExplorer';
import { createMockProject, createMockFile } from '../fixtures/testFixtures';

describe('ProjectExplorer Component', () => {
  const file1 = createMockFile({ id: 'f-1', name: 'principal.lumi', isEntry: true });
  const file2 = createMockFile({ id: 'f-2', name: 'cocina.lumi', isEntry: false });
  const project = createMockProject({ files: [file1, file2], activeFileId: 'f-1' });

  const defaultProps = {
    currentProject: project,
    projects: [project],
    onSelectProject: vi.fn(),
    activeFileId: 'f-1',
    onSelectFile: vi.fn(),
    onNewFile: vi.fn(),
    onNewProject: vi.fn(),
    onOpenProjectModal: vi.fn(),
    onRenameFile: vi.fn(),
    onDeleteFile: vi.fn(),
    onSetEntryFile: vi.fn(),
    onOpenDocs: vi.fn(),
  };

  it('debe mostrar la lista de archivos del proyecto y resaltar el archivo activo', () => {
    render(<ProjectExplorer {...defaultProps} />);

    expect(screen.getByText('principal.lumi')).toBeInTheDocument();
    expect(screen.getByText('cocina.lumi')).toBeInTheDocument();
    expect(screen.getByTitle(/Punto de entrada/i)).toBeInTheDocument();
  });

  it('debe llamar a onSelectFile al hacer clic en un archivo no activo', () => {
    const handleSelectFile = vi.fn();
    render(<ProjectExplorer {...defaultProps} onSelectFile={handleSelectFile} />);

    const cocinaBtn = screen.getByText('cocina.lumi');
    fireEvent.click(cocinaBtn);

    expect(handleSelectFile).toHaveBeenCalledWith('f-2');
  });

  it('debe disparar onNewFile al presionar el botón de nuevo archivo', () => {
    const handleNewFile = vi.fn();
    render(<ProjectExplorer {...defaultProps} onNewFile={handleNewFile} />);

    const btnNewFile = screen.getByTitle(/nuevo archivo/i);
    fireEvent.click(btnNewFile);

    expect(handleNewFile).toHaveBeenCalledTimes(1);
  });
});
