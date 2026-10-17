import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ObjectPropertiesCard } from '../../../components/viewport/ObjectPropertiesCard';
import {
  createMockSpatialObject,
  createMockDoor,
  createMockWindow,
} from '../../fixtures/testFixtures';

describe('ObjectPropertiesCard', () => {
  it('no debe renderizar nada cuando entity es null', () => {
    const { container } = render(
      <ObjectPropertiesCard entity={null} onClose={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('debe renderizar la información completa de un objeto espacial', () => {
    const objectData = createMockSpatialObject({
      id: 'mesa-centro-1',
      name: 'Mesa de Centro',
      type: 'mesa',
      position: [1.5, 0.0, -0.8],
      rotation: [0, 90, 0],
      dimensions: [1.2, 0.45, 0.6],
      color: 'nogal',
      material: 'madera',
      sourceRef: { file: 'principal.lumi', line: 15, column: 5 },
    });

    const handleClose = vi.fn();
    const handleNavigate = vi.fn();

    render(
      <ObjectPropertiesCard
        entity={{ kind: 'object', data: objectData }}
        onClose={handleClose}
        onNavigateToSource={handleNavigate}
      />
    );

    // Título y tipo
    expect(screen.getByText('Mesa de Centro')).toBeInTheDocument();
    expect(screen.getByText(/mueble • mesa/i)).toBeInTheDocument();

    // ID
    expect(screen.getByText('mesa-centro-1')).toBeInTheDocument();

    // Posición formateada
    expect(screen.getByText(/X: 1.50m, Y: 0.00m, Z: -0.80m/i)).toBeInTheDocument();

    // Dimensiones
    expect(screen.getByText(/1.20 × 0.45 × 0.60 m/i)).toBeInTheDocument();

    // Rotación
    expect(screen.getByText(/X: 0°, Y: 90°, Z: 0°/i)).toBeInTheDocument();

    // Acabado
    expect(screen.getByText(/madera • nogal/i)).toBeInTheDocument();

    // Referencia de código
    expect(screen.getByText('principal.lumi:15')).toBeInTheDocument();
  });

  it('debe llamar a onNavigateToSource con la referencia correcta al presionar "Ir al código"', () => {
    const sourceRef = { file: 'principal.lumi', line: 42, column: 3 };
    const objectData = createMockSpatialObject({ sourceRef });
    const handleNavigate = vi.fn();

    render(
      <ObjectPropertiesCard
        entity={{ kind: 'object', data: objectData }}
        onClose={vi.fn()}
        onNavigateToSource={handleNavigate}
      />
    );

    const btnGoCode = screen.getByRole('button', { name: /ir al código/i });
    fireEvent.click(btnGoCode);

    expect(handleNavigate).toHaveBeenCalledTimes(1);
    expect(handleNavigate).toHaveBeenCalledWith(sourceRef);
  });

  it('debe llamar a onClose tanto desde el botón de la X como desde el botón "Cerrar" del pie', () => {
    const objectData = createMockSpatialObject();
    const handleClose = vi.fn();

    render(
      <ObjectPropertiesCard
        entity={{ kind: 'object', data: objectData }}
        onClose={handleClose}
      />
    );

    // Botón X
    const btnX = screen.getByRole('button', { name: /cerrar detalles del objeto/i });
    fireEvent.click(btnX);
    expect(handleClose).toHaveBeenCalledTimes(1);

    // Botón Cerrar
    const btnFooterClose = screen.getByRole('button', { name: /^cerrar$/i });
    fireEvent.click(btnFooterClose);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('debe mostrar banner de alerta cuando el objeto tiene colisión o está fuera de límites', () => {
    const collisionObj = createMockSpatialObject({ hasCollision: true });
    const { rerender } = render(
      <ObjectPropertiesCard
        entity={{ kind: 'object', data: collisionObj }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/colisión detectada con otro elemento espacial/i)).toBeInTheDocument();

    const outOfBoundsObj = createMockSpatialObject({ isOutOfBounds: true });
    rerender(
      <ObjectPropertiesCard
        entity={{ kind: 'object', data: outOfBoundsObj }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/objeto fuera de los límites de la habitación/i)).toBeInTheDocument();
  });

  it('debe renderizar correctamente aberturas (puertas y ventanas)', () => {
    const door = createMockDoor({ wall: 'norte', position: 1.2, width: 0.9, height: 2.1 });
    const { rerender } = render(
      <ObjectPropertiesCard
        entity={{ kind: 'door', data: door }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Puerta (norte)')).toBeInTheDocument();
    expect(screen.getByText(/abertura • puerta \(norte\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Posición pared: 1.20m/i)).toBeInTheDocument();

    const win = createMockWindow({ wall: 'sur', position: -0.5, width: 1.8, height: 1.4 });
    rerender(
      <ObjectPropertiesCard
        entity={{ kind: 'window', data: win }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Ventana (sur)')).toBeInTheDocument();
    expect(screen.getByText(/abertura • ventana \(sur\)/i)).toBeInTheDocument();
  });
});
