import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  calculateRoomCenter,
  calculateDynamicViewSpan,
  calculateCameraDistance,
  calculateWallOcclusion,
} from '../../../../components/viewport/helpers/spatialMath';
import { createMockRoom } from '../../../fixtures/testFixtures';

describe('Spatial Math Pure Functions', () => {
  it('calculateRoomCenter debe calcular el centro óptimo en base a la altura', () => {
    const room = createMockRoom({ dimensions: [6.0, 4.0, 3.0] });
    const center = calculateRoomCenter(room);

    expect(center.x).toBe(0);
    expect(center.y).toBeCloseTo(3.0 * 0.35);
    expect(center.z).toBe(0);
  });

  it('calculateDynamicViewSpan debe escalar dinámicamente según la dimensión máxima', () => {
    const smallRoom = createMockRoom({ dimensions: [2.0, 2.0, 2.0] });
    const spanSmall = calculateDynamicViewSpan(smallRoom);
    expect(spanSmall).toBeGreaterThan(1.8);

    const largeRoom = createMockRoom({ dimensions: [10.0, 8.0, 3.0] });
    const spanLarge = calculateDynamicViewSpan(largeRoom);
    expect(spanLarge).toBeGreaterThan(spanSmall);

    // En pantallas panorámicas adapta el span adecuadamente
    const spanWide = calculateDynamicViewSpan(largeRoom, 1.6);
    expect(spanWide).toBeGreaterThan(0);
  });

  it('calculateCameraDistance debe calcular una distancia proporcional que encuadre la habitación', () => {
    const room = createMockRoom({ dimensions: [5.0, 4.0, 2.7] });
    const distance = calculateCameraDistance(room);
    const expected = Math.max(5.0, 4.0, 2.7 * 1.3, 3.5) * 2.2;
    expect(distance).toBeCloseTo(expected);
  });

  it('calculateWallOcclusion debe determinar correctamente qué muros ocluyen según la posición de la cámara', () => {
    // Cámara situada al sur (+Z) y este (+X)
    const camSouthEast = new THREE.Vector3(5, 4, 6);
    const occSE = calculateWallOcclusion(camSouthEast);
    expect(occSE.isSouthOccluding).toBe(true);
    expect(occSE.isNorthOccluding).toBe(false);
    expect(occSE.isEastOccluding).toBe(true);
    expect(occSE.isWestOccluding).toBe(false);

    // Cámara situada al norte (-Z) y oeste (-X)
    const camNorthWest = new THREE.Vector3(-5, 4, -6);
    const occNW = calculateWallOcclusion(camNorthWest);
    expect(occNW.isSouthOccluding).toBe(false);
    expect(occNW.isNorthOccluding).toBe(true);
    expect(occNW.isEastOccluding).toBe(false);
    expect(occNW.isWestOccluding).toBe(true);

    // Origen centrado [0, 0, 0]
    const camCenter = new THREE.Vector3(0, 0, 0);
    const occCenter = calculateWallOcclusion(camCenter);
    expect(occCenter.isSouthOccluding).toBe(false);
    expect(occCenter.isNorthOccluding).toBe(false);
    expect(occCenter.isEastOccluding).toBe(false);
    expect(occCenter.isWestOccluding).toBe(false);
  });
});
