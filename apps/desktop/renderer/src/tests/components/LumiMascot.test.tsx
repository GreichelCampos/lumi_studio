import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LumiMascot } from '../../components/LumiMascot';

describe('LumiMascot Component', () => {
  it('debe renderizar la mascota con el estado por defecto y el título correspondiente', () => {
    render(<LumiMascot state="ready" size={60} />);
    const mascot = screen.getByTitle('Lumi (READY)');
    expect(mascot).toBeInTheDocument();
  });

  it('debe mostrar el globo de diálogo cuando showSpeechBubble es true y hay mensaje', () => {
    render(
      <LumiMascot
        state="warning"
        message="¡Atención con las dimensiones!"
        showSpeechBubble={true}
      />
    );

    expect(screen.getByText('¡Atención con las dimensiones!')).toBeInTheDocument();
    expect(screen.getByTitle('Lumi (WARNING)')).toBeInTheDocument();
  });

  it('no debe mostrar el globo de diálogo si showSpeechBubble es false', () => {
    render(
      <LumiMascot
        state="success"
        message="Todo correcto"
        showSpeechBubble={false}
      />
    );

    expect(screen.queryByText('Todo correcto')).not.toBeInTheDocument();
  });

  it('debe invocar onClick cuando se interactúa con la mascota', () => {
    const handleClick = vi.fn();
    render(<LumiMascot state="ready" onClick={handleClick} />);

    const mascot = screen.getByTitle('Lumi (READY)');
    fireEvent.click(mascot);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('debe renderizar la expresión visual correcta para error (ojos en cruz)', () => {
    const { container } = render(<LumiMascot state="error" size={80} />);
    expect(screen.getByTitle('Lumi (ERROR)')).toBeInTheDocument();
    // En error se renderizan trazos de ojos en X (path con d correspondiente)
    const eyePaths = container.querySelectorAll('g.lumi-face path');
    expect(eyePaths.length).toBeGreaterThan(0);
  });

  it('debe renderizar el elemento SVG con su clase de pulso reactivo en warning', () => {
    const { container } = render(<LumiMascot state="warning" size={80} />);
    const svgElement = container.querySelector('svg');
    expect(svgElement).toHaveClass('glow-lumi-yellow');
  });

  it('debe renderizar el elemento SVG con su clase de pulso reactivo en error', () => {
    const { container } = render(<LumiMascot state="error" size={80} />);
    const svgElement = container.querySelector('svg');
    expect(svgElement).toHaveClass('glow-lumi-red');
  });

  it('debe renderizar el elemento SVG con su clase de pulso reactivo en compiling', () => {
    const { container } = render(<LumiMascot state="compiling" size={80} />);
    const svgElement = container.querySelector('svg');
    expect(svgElement).toHaveClass('glow-lumi-purple');
  });
});
