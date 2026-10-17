import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfirmDeleteModal } from '../../../components/modals/ConfirmDeleteModal';
import { createMockFile } from '../../fixtures/testFixtures';

describe('ConfirmDeleteModal Component', () => {
  const mockFile = createMockFile({ id: 'file-delete', name: 'dormitorio.lumi' });

  it('no debe renderizar nada si isOpen es false o no hay archivo seleccionado', () => {
    const { container } = render(
      <ConfirmDeleteModal
        isOpen={false}
        onClose={vi.fn()}
        file={mockFile}
        hasUnsavedChanges={false}
        isEntryFile={false}
        totalFilesInProject={2}
        onConfirmDelete={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('debe mostrar el nombre del archivo y advertencia de cambios sin guardar si aplica', () => {
    render(
      <ConfirmDeleteModal
        isOpen={true}
        onClose={vi.fn()}
        file={mockFile}
        hasUnsavedChanges={true}
        isEntryFile={false}
        totalFilesInProject={2}
        onConfirmDelete={vi.fn()}
      />
    );

    expect(screen.getByText('Eliminar Archivo')).toBeInTheDocument();
    expect(screen.getByText('dormitorio.lumi', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText(/cambios sin guardar/i)).toBeInTheDocument();
  });

  it('debe mostrar advertencia de archivo principal si isEntryFile es true', () => {
    render(
      <ConfirmDeleteModal
        isOpen={true}
        onClose={vi.fn()}
        file={mockFile}
        hasUnsavedChanges={false}
        isEntryFile={true}
        totalFilesInProject={3}
        onConfirmDelete={vi.fn()}
      />
    );

    expect(screen.getByText(/archivo principal del proyecto/i)).toBeInTheDocument();
  });

  it('debe llamar a onConfirmDelete con el fileId y cerrar el modal al confirmar', async () => {
    const handleConfirm = vi.fn();
    const handleClose = vi.fn();

    render(
      <ConfirmDeleteModal
        isOpen={true}
        onClose={handleClose}
        file={mockFile}
        hasUnsavedChanges={false}
        isEntryFile={false}
        totalFilesInProject={2}
        onConfirmDelete={handleConfirm}
      />
    );

    const deleteBtn = screen.getByRole('button', { name: /eliminar definitivamente/i });
    fireEvent.click(deleteBtn);

    expect(handleConfirm).toHaveBeenCalledWith('file-delete');
    await waitFor(() => expect(handleClose).toHaveBeenCalledTimes(1));
  });
});
