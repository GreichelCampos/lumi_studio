import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentationModal } from '../../components/DocumentationModal';

describe('DocumentationModal', () => {
  it('identifies the current limits without presenting the help as an official specification', () => {
    render(<DocumentationModal isOpen onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Ayuda de Lumi' })).toBeInTheDocument();
    expect(screen.queryByText('Manual y Especificación Oficial de Lumi')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Errores frecuentes' })).toBeInTheDocument();
    expect(screen.getByText('Paréntesis, corchetes y comas')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Palabras reservadas' }));
    expect(screen.getByRole('heading', { name: 'Palabras Reservadas y Estructuras Principales' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guía del IDE' }));
    expect(screen.getByText('Estados Visuales del Asistente Lumi')).toBeInTheDocument();
    expect(screen.getByText(/Compilar analiza el archivo principal/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ejemplos' }));
    expect(screen.getByRole('heading', { name: 'Ejemplos de Lumi' })).toBeInTheDocument();
    expect(screen.getByText(/El IDE reproduce los pasos y snapshots generados por Python/)).toBeInTheDocument();
    expect(screen.getByText(/comprueba colisiones, elementos fuera de límites y puertas bloqueadas/)).toBeInTheDocument();
    expect(screen.getByText(/Las listas pueden mostrarse en la consola/)).toBeInTheDocument();
    expect(screen.getAllByText('Ejemplo ejecutable con Python')).toHaveLength(4);
    expect(screen.queryByText('Ejemplo sintáctico · ejecución no soportada')).not.toBeInTheDocument();
    expect(screen.getByText('Información · no es un programa ejecutable')).toBeInTheDocument();
    expect(screen.getByText(/Ejecutar Lumi dibuja el piso, la pared, la puerta, la ventana y los muebles/)).toBeInTheDocument();
    expect(screen.getByText(/La pared requiere orientacion/)).toBeInTheDocument();
    expect(screen.getByText(/Las variables vectoriales pueden reutilizarse como operandos de colocar, mover y rotar/)).toBeInTheDocument();
  });

  it('shows project information without the syntax guide in About', () => {
    render(<DocumentationModal isOpen view="about" onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Acerca de Estudio Lumi' })).toBeInTheDocument();
    expect(screen.getByText(/Lenguaje Unificado de Modelado de Interiores/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Errores frecuentes' })).not.toBeInTheDocument();
  });
});
