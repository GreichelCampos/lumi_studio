import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NewFileModal } from '../../../components/modals/NewFileModal';

describe('NewFileModal Component', () => {
  it('no debe renderizarse cuando isOpen es false', () => {
    const { container } = render(
      <NewFileModal
        isOpen={false}
        onClose={vi.fn()}
        onCreateFile={vi.fn()}
        existingFileNames={['principal.lumi']}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('debe validar y crear un archivo nuevo añadiendo la extensión .lumi si hace falta', () => {
    const handleCreateFile = vi.fn();
    const handleClose = vi.fn();

    render(
      <NewFileModal
        isOpen={true}
        onClose={handleClose}
        onCreateFile={handleCreateFile}
        existingFileNames={['principal.lumi']}
      />
    );

    const input = screen.getByPlaceholderText(/mobiliario_comedor/i);
    fireEvent.change(input, { target: { value: 'cocina_moderna' } });

    expect(screen.getByText('cocina_moderna.lumi')).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /crear y abrir/i });
    fireEvent.click(submitBtn);

    expect(handleCreateFile).toHaveBeenCalledWith('cocina_moderna.lumi');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('debe rechazar nombres duplicados y mostrar el mensaje de error', () => {
    const handleCreateFile = vi.fn();

    render(
      <NewFileModal
        isOpen={true}
        onClose={vi.fn()}
        onCreateFile={handleCreateFile}
        existingFileNames={['principal.lumi']}
      />
    );

    const input = screen.getByPlaceholderText(/mobiliario_comedor/i);
    fireEvent.change(input, { target: { value: 'principal.lumi' } });

    const submitBtn = screen.getByRole('button', { name: /crear y abrir/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/ya existe/i)).toBeInTheDocument();
    expect(handleCreateFile).not.toHaveBeenCalled();
  });
});
