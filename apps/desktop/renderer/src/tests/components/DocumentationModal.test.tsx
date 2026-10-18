import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentationModal } from '../../components/DocumentationModal';

vi.mock('../../components/LumiMascot', () => ({ LumiMascot: () => null }));

describe('DocumentationModal', () => {
  it('identifies the current limits without presenting the help as an official specification', () => {
    render(<DocumentationModal isOpen onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Ayuda de Lumi' })).toBeInTheDocument();
    expect(screen.queryByText('Manual y Especificación Oficial de Lumi')).not.toBeInTheDocument();
    expect(screen.getByText(/Los ejemplos espaciales siguientes muestran sintaxis aceptada, no escenas generadas/)).toBeInTheDocument();
    expect(screen.getByText(/Python todavía no genera trazas espaciales/)).toBeInTheDocument();
    expect(screen.getByText(/La detección real de colisiones.*sigue pendiente/)).toBeInTheDocument();
    expect(screen.getByText(/este ejemplo permite comprobar su análisis, no una ejecución completa/)).toBeInTheDocument();
  });
});
