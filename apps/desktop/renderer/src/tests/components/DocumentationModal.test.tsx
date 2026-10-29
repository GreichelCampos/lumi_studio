import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentationModal } from '../../components/DocumentationModal';

vi.mock('../../components/LumiMascot', () => ({ LumiMascot: () => null }));

describe('DocumentationModal', () => {
  it('identifies the current limits without presenting the help as an official specification', () => {
    render(<DocumentationModal isOpen onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Ayuda de Lumi' })).toBeInTheDocument();
    expect(screen.queryByText('Manual y Especificación Oficial de Lumi')).not.toBeInTheDocument();
    expect(screen.getByText(/Ejecutar Python puede generar escenas con habitaciones, pisos y muebles colocados/)).toBeInTheDocument();
    expect(screen.getByText(/Python todavía no genera trazas espaciales/)).toBeInTheDocument();
    expect(screen.getByText(/La detección real de colisiones.*sigue pendiente/)).toBeInTheDocument();
    expect(screen.getByText(/este ejemplo permite comprobar su análisis, no una ejecución completa/)).toBeInTheDocument();
    expect(screen.getAllByText('Ejemplo ejecutable con Python')).toHaveLength(2);
    expect(screen.getAllByText('Ejemplo sintáctico · ejecución no soportada')).toHaveLength(2);
    expect(screen.getByText('Información · no es un programa ejecutable')).toBeInTheDocument();
    expect(screen.getByText(/Los muebles colocados sí se generan mediante un catálogo visual provisional/)).toBeInTheDocument();
    expect(screen.getByText(/la ejecución devuelve SERIALIZATION_ERROR, sin escena/)).toBeInTheDocument();
    expect(screen.getByText(/Los vectores de colocar, mover y rotar sí se evalúan/)).toBeInTheDocument();
  });
});
