import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentationModal } from '../../components/DocumentationModal';

vi.mock('../../components/LumiMascot', () => ({ LumiMascot: () => null }));

describe('DocumentationModal', () => {
  it('identifies the current limits without presenting the help as an official specification', () => {
    render(<DocumentationModal isOpen onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Ayuda de Lumi' })).toBeInTheDocument();
    expect(screen.queryByText('Manual y Especificación Oficial de Lumi')).not.toBeInTheDocument();
    expect(screen.getByText(/El depurador reproduce los snapshots espaciales publicados por Python/)).toBeInTheDocument();
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
});
