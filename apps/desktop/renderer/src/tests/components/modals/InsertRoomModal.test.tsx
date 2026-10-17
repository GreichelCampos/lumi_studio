import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InsertRoomModal } from '../../../components/modals/InsertRoomModal';

describe('InsertRoomModal', () => {
  it('no debe renderizarse cuando isOpen es false', () => {
    const { container } = render(
      <InsertRoomModal isOpen={false} onClose={vi.fn()} onInsertRoom={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('debe renderizar los campos con valores por defecto e insertar código válido al enviar', () => {
    const handleClose = vi.fn();
    const handleInsert = vi.fn();

    render(
      <InsertRoomModal
        isOpen={true}
        onClose={handleClose}
        onInsertRoom={handleInsert}
      />
    );

    expect(screen.getByText('Insertar Habitación Lumi')).toBeInTheDocument();

    // Modificar datos
    const nameInput = screen.getByPlaceholderText(/sala, cocina/i);
    fireEvent.change(nameInput, { target: { value: 'dormitorio_suite' } });

    const widthInput = screen.getByPlaceholderText('5.0');
    fireEvent.change(widthInput, { target: { value: '4.5' } });

    const submitBtn = screen.getByRole('button', { name: /insertar en editor/i });
    fireEvent.click(submitBtn);

    expect(handleInsert).toHaveBeenCalledTimes(1);
    expect(handleInsert).toHaveBeenCalledWith(
      'habitacion dormitorio_suite(4.5, 4.0, 2.7) {\n}'
    );
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('debe mostrar errores de validación si el usuario introduce valores inválidos', () => {
    const handleInsert = vi.fn();

    render(
      <InsertRoomModal
        isOpen={true}
        onClose={vi.fn()}
        onInsertRoom={handleInsert}
      />
    );

    const nameInput = screen.getByPlaceholderText(/sala, cocina/i);
    fireEvent.change(nameInput, { target: { value: '123_invalido' } });

    const submitBtn = screen.getByRole('button', { name: /insertar en editor/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/identificador válido/i)).toBeInTheDocument();
    expect(handleInsert).not.toHaveBeenCalled();
  });

  it('debe cerrar el modal al hacer clic en Cancelar o en la X', () => {
    const handleClose = vi.fn();

    render(
      <InsertRoomModal
        isOpen={true}
        onClose={handleClose}
        onInsertRoom={vi.fn()}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /cancelar/i });
    fireEvent.click(cancelBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
