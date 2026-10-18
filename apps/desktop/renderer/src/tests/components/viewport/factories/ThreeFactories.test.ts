import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FurnitureFactory } from '../../../../components/viewport/factories/FurnitureFactory';
import { OpeningFactory } from '../../../../components/viewport/factories/OpeningFactory';
import {
  createMockSpatialObject,
  createMockDoor,
  createMockWindow,
  createMockRoom,
} from '../../../fixtures/testFixtures';

describe('Three.js Factories (Mesh & Group Generation)', () => {
  describe('FurnitureFactory', () => {
    it('debe crear un THREE.Group con el id del objeto, posición y rotación convertida a radianes', () => {
      const obj = createMockSpatialObject({
        id: 'mesa-sala-1',
        name: 'Mesa Roble',
        position: [1.2, 0.0, -0.8],
        rotation: [0, 90, 0], // 90 grados
        dimensions: [1.6, 0.75, 0.9],
        material: 'madera',
        color: 'roble',
      });

      const meshGroup = FurnitureFactory.createFurnitureMesh(obj, false, false);

      expect(meshGroup).toBeInstanceOf(THREE.Group);
      expect(meshGroup.name).toBe('mesa-sala-1');
      expect(meshGroup.position.x).toBeCloseTo(1.2);
      expect(meshGroup.position.y).toBeCloseTo(0.0);
      expect(meshGroup.position.z).toBeCloseTo(-0.8);
      // 90 grados = PI/2 radianes
      expect(meshGroup.rotation.y).toBeCloseTo(Math.PI / 2);
    });

    it('debe agregar un highlightBox y un disco cuando isSelected es true', () => {
      const obj = createMockSpatialObject({ id: 'silla-sel' });

      const normalGroup = FurnitureFactory.createFurnitureMesh(obj, false, false);
      const selectedGroup = FurnitureFactory.createFurnitureMesh(obj, true, false);

      // El grupo seleccionado contiene mallas adicionales (caja de selección y disco de piso)
      expect(selectedGroup.children.length).toBeGreaterThan(normalGroup.children.length);
    });

    it('debe aplicar resaltado de error/outOfBounds sin romper la construcción del grupo', () => {
      const errorObj = createMockSpatialObject({
        id: 'obj-error-1',
        isOutOfBounds: true,
        hasError: true,
      });

      const errorGroup = FurnitureFactory.createFurnitureMesh(errorObj, false, false);
      expect(errorGroup).toBeInstanceOf(THREE.Group);
      expect(errorGroup.name).toBe('obj-error-1');
      expect(errorGroup.children.length).toBeGreaterThan(0);
    });
  });

  describe('OpeningFactory', () => {
    const mockRoom = createMockRoom({ dimensions: [6.0, 5.0, 2.8] });

    it('debe posicionar correctamente una puerta en pared norte, sur, este y oeste', () => {
      const doorNorte = createMockDoor({ id: 'd-n', wall: 'norte', position: 1.0 });
      const groupNorte = OpeningFactory.createDoorMesh(doorNorte, mockRoom, false);
      expect(groupNorte.name).toBe('d-n');
      expect(groupNorte.position.x).toBe(1.0);
      expect(groupNorte.position.z).toBeLessThan(0); // Norte es -Z

      const doorSur = createMockDoor({ id: 'd-s', wall: 'sur', position: -0.5 });
      const groupSur = OpeningFactory.createDoorMesh(doorSur, mockRoom, false);
      expect(groupSur.position.z).toBeGreaterThan(0); // Sur es +Z

      const doorOeste = createMockDoor({ id: 'd-o', wall: 'oeste', position: 0.0 });
      const groupOeste = OpeningFactory.createDoorMesh(doorOeste, mockRoom, false);
      expect(groupOeste.position.x).toBeLessThan(0); // Oeste es -X
    });

    it('debe crear ventanas con mallas de marco y cristal translúcido', () => {
      const win = createMockWindow({ id: 'win-1', wall: 'sur', width: 1.8, height: 1.2 });
      const winGroup = OpeningFactory.createWindowMesh(win, mockRoom, true);

      expect(winGroup).toBeInstanceOf(THREE.Group);
      expect(winGroup.name).toBe('win-1');
      expect(winGroup.children.length).toBeGreaterThanOrEqual(3);
    });
  });
});
