import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FurnitureFactory } from '../../../components/viewport/factories/FurnitureFactory';
import { OpeningFactory } from '../../../components/viewport/factories/OpeningFactory';
import { ThreeResourceDisposer } from '../../../components/viewport/resources/ThreeResourceDisposer';
import type { VisualStateUpdate } from '../../../components/viewport/interaction/VisualState';
import { createMockRoom, createMockDoor, createMockWindow, createMockSpatialObject } from '../../fixtures/testFixtures';

/** Compare visible geometry/materials with the unchanged one-shot factory path, not IDs or allocations. */
function visibleSnapshot(group: THREE.Group) {
  group.updateMatrixWorld(true);
  const meshes: unknown[] = [];
  group.traverseVisible(child => {
    if (!(child instanceof THREE.Mesh)) return;
    const material = child.material as THREE.MeshStandardMaterial;
    meshes.push({
      position: Array.from(child.geometry.getAttribute('position').array),
      index: child.geometry.index ? Array.from(child.geometry.index.array) : null,
      matrix: child.matrixWorld.toArray(), castShadow: child.castShadow, receiveShadow: child.receiveShadow,
      color: material.color?.getHexString(), emissive: material.emissive?.getHexString(), intensity: material.emissiveIntensity,
      wireframe: material.wireframe, side: material.side, transparent: material.transparent, opacity: material.opacity,
      metalness: material.metalness, roughness: material.roughness,
    });
  });
  return meshes;
}

describe('incremental visual parity with one-shot factory rendering', () => {
  it('updates diagnostic highlighting without allocating a new object or changing visual priority', () => {
    const item = createMockSpatialObject(); let update!: VisualStateUpdate;
    const prepared = FurnitureFactory.createFurnitureMesh(item, false, false, false, binding => { update = binding; });
    try {
      for (const flags of [{ hasWarning: true }, { hasError: true }, { hasCollision: true }, {}]) {
        const state = { ...item, ...flags };
        for (const [selected, debug] of [[false, false], [true, false], [true, true], [false, true]]) {
          update(selected, debug, state);
          const expected = FurnitureFactory.createFurnitureMesh(state, selected, false, debug);
          try { expect(visibleSnapshot(prepared)).toEqual(visibleSnapshot(expected)); }
          finally { ThreeResourceDisposer.disposeHierarchy(expected); }
        }
      }
    } finally { ThreeResourceDisposer.disposeHierarchy(prepared); }
  });
  it.each(['cubo', 'mesa', 'silla', 'cama', 'sofa', 'armario', 'escritorio', 'estante', 'lampara', 'televisor', 'planta'])(
    'preserves selection/debug/error/warning priority for %s', type => {
      for (const flags of [{}, { hasError: true }, { hasWarning: true }, { hasError: true, hasWarning: true }]) {
        const item = createMockSpatialObject({ type, rotation: [15, 35, -20], ...flags });
        let update!: VisualStateUpdate;
        const prepared = FurnitureFactory.createFurnitureMesh(item, false, false, false, binding => { update = binding; });
        try {
          for (const [selected, debug] of [[true, false], [false, true], [true, true], [false, false]]) {
            update(selected, debug);
            const expected = FurnitureFactory.createFurnitureMesh(item, selected, false, debug);
            try { expect(visibleSnapshot(prepared)).toEqual(visibleSnapshot(expected)); }
            finally { ThreeResourceDisposer.disposeHierarchy(expected); }
          }
        } finally { ThreeResourceDisposer.disposeHierarchy(prepared); }
      }
    },
  );

  it.each(['door', 'window'] as const)('preserves %s appearance and highlight on repeated selection', kind => {
    const room = createMockRoom();
    const item = kind === 'door' ? createMockDoor() : createMockWindow({ elevation: 0 });
    Object.assign(item, { color: '#123456', material: 'acero' });
    const create = kind === 'door' ? OpeningFactory.createDoorMesh : OpeningFactory.createWindowMesh;
    let update!: VisualStateUpdate;
    const prepared = create(item, room, false, false, binding => { update = binding; });
    try {
      for (const selected of [true, false, true, false]) {
        update(selected, false);
        const expected = create(item, room, selected);
        try { expect(visibleSnapshot(prepared)).toEqual(visibleSnapshot(expected)); }
        finally { ThreeResourceDisposer.disposeHierarchy(expected); }
      }
    } finally { ThreeResourceDisposer.disposeHierarchy(prepared); }
  });
});
