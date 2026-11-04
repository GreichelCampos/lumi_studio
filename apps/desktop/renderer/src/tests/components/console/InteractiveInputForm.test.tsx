import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InteractiveInputForm } from '../../../components/console/InteractiveInputForm';

const props = { scopeKey: 'project-one', requestKey: 'first', prompt: 'Nombre:' };

describe('independent input form; not a Python input protocol', () => {
  it('labels the prompt and accepts keyboard submission preserving the exact text', async () => {
    const user = userEvent.setup(); const submit = vi.fn().mockResolvedValue(undefined);
    render(<InteractiveInputForm {...props} onSubmit={submit} />);
    expect(screen.getByLabelText('Respuesta')).toHaveFocus();
    await user.type(screen.getByLabelText('Respuesta'), '  Luz  {Enter}');
    expect(submit).toHaveBeenCalledWith('  Luz  ');
    expect(screen.getByRole('status')).toHaveTextContent('Entrada enviada.');
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('allows empty text without inventing a mandatory-value language rule', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<InteractiveInputForm {...props} onSubmit={submit} />);
    await act(async () => fireEvent.submit(screen.getByRole('form')));
    expect(submit).toHaveBeenCalledWith('');
  });

  it('blocks invalid input using only the validator provided by its host', async () => {
    const submit = vi.fn();
    render(<InteractiveInputForm {...props} onSubmit={submit} validate={value => value === 'permitido' ? null : 'Valor no admitido por el host.'} />);
    fireEvent.change(screen.getByLabelText('Respuesta'), { target: { value: 'otro' } });
    await act(async () => fireEvent.submit(screen.getByRole('form')));
    expect(submit).not.toHaveBeenCalled(); expect(screen.getByRole('alert')).toHaveTextContent('Valor no admitido');
    expect(screen.getByLabelText('Respuesta')).toHaveAttribute('aria-invalid', 'true');
  });

  it('prevents duplicate submissions before render and after acknowledgement', async () => {
    let finish!: () => void;
    const submit = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    render(<InteractiveInputForm {...props} onSubmit={submit} />);
    act(() => { fireEvent.submit(screen.getByRole('form')); fireEvent.submit(screen.getByRole('form')); });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Enviando entrada');
    await act(async () => finish());
    fireEvent.submit(screen.getByRole('form'));
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('recovers from sending errors and supports consecutive independent requests', async () => {
    const submit = vi.fn().mockRejectedValueOnce(new Error('Canal desconectado')).mockResolvedValue(undefined);
    const view = render(<InteractiveInputForm {...props} onSubmit={submit} />);
    fireEvent.change(screen.getByLabelText('Respuesta'), { target: { value: 'uno' } });
    await act(async () => fireEvent.submit(screen.getByRole('form')));
    expect(screen.getByRole('alert')).toHaveTextContent('Canal desconectado');
    await act(async () => fireEvent.submit(screen.getByRole('form')));
    expect(screen.getByRole('status')).toHaveTextContent('Entrada enviada.');
    view.rerender(<InteractiveInputForm {...props} requestKey="second" prompt="Segundo:" onSubmit={submit} />);
    expect(screen.getByLabelText('Respuesta')).toHaveValue('');
    expect(screen.getByRole('status')).toHaveTextContent('Esperando datos.');
    fireEvent.change(screen.getByLabelText('Respuesta'), { target: { value: 'dos' } });
    await act(async () => fireEvent.submit(screen.getByRole('form')));
    expect(submit).toHaveBeenLastCalledWith('dos');
  });

  it('clears a project waiting or sending state and ignores an old completion', async () => {
    let finish!: () => void;
    const submit = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const view = render(<InteractiveInputForm {...props} onSubmit={submit} />);
    fireEvent.change(screen.getByLabelText('Respuesta'), { target: { value: 'privado' } });
    fireEvent.submit(screen.getByRole('form'));
    view.rerender(<InteractiveInputForm {...props} scopeKey="project-two" onSubmit={vi.fn()} />);
    await act(async () => finish());
    expect(screen.getByLabelText('Respuesta')).toHaveValue('');
    expect(screen.getByRole('status')).toHaveTextContent('Esperando datos.');
    expect(screen.getByRole('button')).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Respuesta'), { target: { value: 'otro' } });
    view.rerender(<InteractiveInputForm {...props} scopeKey="project-three" onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Respuesta')).toHaveValue('');
  });
});
