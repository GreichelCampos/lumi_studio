import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { UnsavedChangesModal } from '../../../components/modals/UnsavedChangesModal';
import { createMockFile } from '../../fixtures/testFixtures';

describe('UnsavedChangesModal Component', () => {
  const file = createMockFile({ id: 'file-mod', name: 'modulo1.lumi' });
  it('waits for persistence and keeps the modal open after a failed save', async () => {
    let complete!: (saved: boolean) => void;
    const pending = new Promise<boolean>(resolve => { complete = resolve; });
    const close = vi.fn();
    render(<UnsavedChangesModal isOpen onClose={close} file={file}
      onSaveAndClose={() => pending} onDiscardAndClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    await act(async () => { complete(false); await pending; });
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Guardar' })).not.toBeDisabled();
  });

  it('no debe renderizarse si isOpen es false o file es null', () => {
    const { container } = render(
      <UnsavedChangesModal
        isOpen={false}
        onClose={vi.fn()}
        file={file}
        onSaveAndClose={vi.fn()}
        onDiscardAndClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('debe permitir la acción Guardar y cerrar el modal', () => {
    const handleSaveAndClose = vi.fn();
    const handleClose = vi.fn();

    render(
      <UnsavedChangesModal
        isOpen={true}
        onClose={handleClose}
        file={file}
        onSaveAndClose={handleSaveAndClose}
        onDiscardAndClose={vi.fn()}
      />
    );

    expect(screen.getByText('Cambios sin Guardar')).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /guardar/i });
    fireEvent.click(saveBtn);

    expect(handleSaveAndClose).toHaveBeenCalledWith('file-mod');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('debe permitir la acción Descartar y cerrar el modal', () => {
    const handleDiscardAndClose = vi.fn();
    const handleClose = vi.fn();

    render(
      <UnsavedChangesModal
        isOpen={true}
        onClose={handleClose}
        file={file}
        onSaveAndClose={vi.fn()}
        onDiscardAndClose={handleDiscardAndClose}
      />
    );

    const discardBtn = screen.getByRole('button', { name: /descartar/i });
    fireEvent.click(discardBtn);

    expect(handleDiscardAndClose).toHaveBeenCalledWith('file-mod');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
