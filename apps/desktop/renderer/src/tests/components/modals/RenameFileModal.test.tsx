import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RenameFileModal } from '../../../components/modals/RenameFileModal';
import { createMockFile } from '../../fixtures/testFixtures';

describe('RenameFileModal Component', () => {
  const file = createMockFile({ id: 'file-123', name: 'dormitorio.lumi' });

  it('no debe renderizar nada si isOpen es false o file es null', () => {
    const { container } = render(
      <RenameFileModal
        isOpen={false}
        onClose={vi.fn()}
        file={file}
        onRename={vi.fn()}
        existingFileNames={['principal.lumi', 'dormitorio.lumi']}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('debe permitir renombrar el archivo y llamar a onRename con el nombre normalizado', async () => {
    const handleRename = vi.fn();
    const handleClose = vi.fn();

    render(
      <RenameFileModal
        isOpen={true}
        onClose={handleClose}
        file={file}
        onRename={handleRename}
        existingFileNames={['principal.lumi', 'dormitorio.lumi']}
      />
    );

    const input = screen.getByDisplayValue('dormitorio.lumi');
    fireEvent.change(input, { target: { value: 'dormitorio_suite' } });

    const submitBtn = screen.getByRole('button', { name: /guardar nombre/i });
    fireEvent.click(submitBtn);

    expect(handleRename).toHaveBeenCalledWith('file-123', 'dormitorio_suite.lumi');
    await waitFor(() => expect(handleClose).toHaveBeenCalledTimes(1));
  });

  it('debe bloquear nombres duplicados contra otros archivos existentes', () => {
    const handleRename = vi.fn();

    render(
      <RenameFileModal
        isOpen={true}
        onClose={vi.fn()}
        file={file}
        onRename={handleRename}
        existingFileNames={['principal.lumi', 'dormitorio.lumi']}
      />
    );

    const input = screen.getByDisplayValue('dormitorio.lumi');
    fireEvent.change(input, { target: { value: 'principal.lumi' } });

    const submitBtn = screen.getByRole('button', { name: /guardar nombre/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/ya existe/i)).toBeInTheDocument();
    expect(handleRename).not.toHaveBeenCalled();
  });
});
