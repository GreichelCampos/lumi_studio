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
    expect(screen.getByText(/El depurador muestra la escena en cada paso espacial/)).toBeInTheDocument();
    expect(screen.getByText(/comprueba colisiones, elementos fuera de límites y puertas bloqueadas/)).toBeInTheDocument();
    expect(screen.getByText(/Las listas pueden mostrarse en la consola/)).toBeInTheDocument();
    expect(screen.getAllByText('Ejemplo para ejecutar')).toHaveLength(11);
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
    expect(screen.getByRole('link', { name: '@GreichelCampos' })).toHaveAttribute('href', 'https://github.com/GreichelCampos');
    expect(screen.getByRole('link', { name: '@GabyGamboa08' })).toHaveAttribute('href', 'https://github.com/GabyGamboa08');
    expect(screen.getByRole('link', { name: '@Pilar-Monge' })).toHaveAttribute('href', 'https://github.com/Pilar-Monge');
  });

  it('finds topics without accents and steps through the debugger guide', () => {
    render(<DocumentationModal isOpen onClose={vi.fn()} />);
    const search = screen.getByRole('searchbox', { name: 'Buscar en la ayuda' });
    fireEvent.change(search, { target: { value: 'parametros' } });
    expect(screen.getByText('Parámetros y argumentos de funciones')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'sin coincidencias' } });
    expect(screen.getByText(/Sin resultados/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Depurador espacial' }));
    expect(search).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByText('Paso 1 de 4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('Paso 2 de 4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(screen.getByText('Paso 1 de 4')).toBeInTheDocument();
  });
});
