import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DebuggerControls } from '../../../components/console/DebuggerControls';

describe('DebuggerControls', () => {
  it('deshabilita todos los botones cuando no hay pasos (stepCount === 0)', () => {
    render(
      <DebuggerControls
        stepCount={0}
        currentStepIndex={0}
        onStepChange={vi.fn()}
      />
    );

    expect(screen.getByTitle('Ir al inicio (Paso 1)')).toBeDisabled();
    expect(screen.getByTitle('Paso anterior')).toBeDisabled();
    expect(screen.getByTitle('Reproducir paso a paso')).toBeDisabled();
    expect(screen.getByTitle('Paso siguiente')).toBeDisabled();
    expect(screen.getByTitle('Ir al paso final')).toBeDisabled();
    expect(screen.getByTitle('Reiniciar depuración')).toBeDisabled();
  });

  it('deshabilita controles de inicio/retroceso cuando currentStepIndex === 0 pero habilita avance', () => {
    render(
      <DebuggerControls
        stepCount={5}
        currentStepIndex={0}
        onStepChange={vi.fn()}
      />
    );

    expect(screen.getByTitle('Ir al inicio (Paso 1)')).toBeDisabled();
    expect(screen.getByTitle('Paso anterior')).toBeDisabled();
    expect(screen.getByTitle('Paso siguiente')).not.toBeDisabled();
    expect(screen.getByTitle('Ir al paso final')).not.toBeDisabled();
  });

  it('deshabilita controles de avance/fin cuando está en el último paso', () => {
    render(
      <DebuggerControls
        stepCount={5}
        currentStepIndex={4}
        onStepChange={vi.fn()}
      />
    );

    expect(screen.getByTitle('Ir al inicio (Paso 1)')).not.toBeDisabled();
    expect(screen.getByTitle('Paso anterior')).not.toBeDisabled();
    expect(screen.getByTitle('Paso siguiente')).toBeDisabled();
    expect(screen.getByTitle('Ir al paso final')).toBeDisabled();
  });

  it('alterna visualmente y funcionalmente entre reproducir y pausar según isPlaying', () => {
    const handleTogglePlay = vi.fn();
    const { rerender } = render(
      <DebuggerControls
        stepCount={5}
        currentStepIndex={2}
        isPlaying={false}
        onTogglePlay={handleTogglePlay}
        onStepChange={vi.fn()}
      />
    );

    const playBtn = screen.getByTitle('Reproducir paso a paso');
    expect(playBtn).toBeInTheDocument();
    expect(screen.getByText('Reproducir')).toBeInTheDocument();

    fireEvent.click(playBtn);
    expect(handleTogglePlay).toHaveBeenCalledTimes(1);

    rerender(
      <DebuggerControls
        stepCount={5}
        currentStepIndex={2}
        isPlaying={true}
        onTogglePlay={handleTogglePlay}
        onStepChange={vi.fn()}
      />
    );

    const pauseBtn = screen.getByTitle('Pausar depuración');
    expect(pauseBtn).toBeInTheDocument();
    expect(screen.getByText('Pausar')).toBeInTheDocument();
  });

  it('invoca callbacks de navegación hacia adelante, atrás, inicio y fin', () => {
    const onPrevStep = vi.fn();
    const onNextStep = vi.fn();
    const onJumpToStart = vi.fn();
    const onJumpToEnd = vi.fn();
    const onResetDebugger = vi.fn();

    render(
      <DebuggerControls
        stepCount={5}
        currentStepIndex={2}
        onPrevStep={onPrevStep}
        onNextStep={onNextStep}
        onJumpToStart={onJumpToStart}
        onJumpToEnd={onJumpToEnd}
        onResetDebugger={onResetDebugger}
        onStepChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle('Ir al inicio (Paso 1)'));
    expect(onJumpToStart).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Paso anterior'));
    expect(onPrevStep).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Paso siguiente'));
    expect(onNextStep).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Ir al paso final'));
    expect(onJumpToEnd).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Reiniciar depuración'));
    expect(onResetDebugger).toHaveBeenCalledTimes(1);
  });

  it('utiliza fallbacks de onStepChange cuando no se proporcionan handlers específicos de navegación', () => {
    const onStepChange = vi.fn();

    render(
      <DebuggerControls
        stepCount={5}
        currentStepIndex={2}
        onStepChange={onStepChange}
      />
    );

    fireEvent.click(screen.getByTitle('Ir al inicio (Paso 1)'));
    expect(onStepChange).toHaveBeenCalledWith(0);

    fireEvent.click(screen.getByTitle('Paso anterior'));
    expect(onStepChange).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByTitle('Paso siguiente'));
    expect(onStepChange).toHaveBeenCalledWith(3);

    fireEvent.click(screen.getByTitle('Ir al paso final'));
    expect(onStepChange).toHaveBeenCalledWith(4);

    fireEvent.click(screen.getByTitle('Reiniciar depuración'));
    expect(onStepChange).toHaveBeenCalledWith(0);
  });

  it('permite cambiar la velocidad de reproducción si onChangeSpeed está presente', () => {
    const onChangeSpeed = vi.fn();

    render(
      <DebuggerControls
        stepCount={5}
        currentStepIndex={2}
        playbackSpeed={1}
        onChangeSpeed={onChangeSpeed}
        onStepChange={vi.fn()}
      />
    );

    expect(screen.getByText('0.5x')).toBeInTheDocument();
    expect(screen.getByText('1x')).toBeInTheDocument();
    expect(screen.getByText('2x')).toBeInTheDocument();

    fireEvent.click(screen.getByText('2x'));
    expect(onChangeSpeed).toHaveBeenCalledWith(2);
  });
});
