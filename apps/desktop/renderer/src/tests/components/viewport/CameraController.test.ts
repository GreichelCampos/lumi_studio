import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CameraController } from '../../../components/viewport/camera/CameraController';
import { FurnitureFactory } from '../../../components/viewport/factories/FurnitureFactory';
import { ThreeResourceDisposer } from '../../../components/viewport/resources/ThreeResourceDisposer';
import { createMockRoom, createMockSpatialObject } from '../../fixtures/testFixtures';
import type { PlacedSpatialObject } from '../../../types';

// Camera, matrices, furniture and OrbitControls are real. No WebGL context needed.
function expectVisible(controller: CameraController, item: PlacedSpatialObject) {
  const mesh = FurnitureFactory.createFurnitureMesh(item, false, false);
  const bounds = new THREE.Box3().setFromObject(mesh);
  const camera = controller.getCamera();
  camera.updateMatrixWorld();
  const center = bounds.getCenter(new THREE.Vector3()).project(camera);
  expect(Math.abs(center.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(center.y)).toBeLessThanOrEqual(1);
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const point = new THREE.Vector3(x, y, z).project(camera);
        expect(Math.abs(point.x)).toBeLessThanOrEqual(0.9);
        expect(Math.abs(point.y)).toBeLessThanOrEqual(0.9);
        expect(Math.abs(point.z)).toBeLessThan(1);
      }
    }
  }
  ThreeResourceDisposer.disposeHierarchy(mesh);
}

describe('real camera and OrbitControls focus regression', () => {
  it.each([0.1, 5, 100])('keeps consecutive, rotated objects fully visible in a %s m room', scale => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    Object.defineProperties(container, { clientWidth: { value: 800 }, clientHeight: { value: 600 } });
    Object.defineProperties(canvas, { clientWidth: { value: 800 }, clientHeight: { value: 600 } });
    const controller = new CameraController({ container, rendererDomElement: canvas });
    const first = createMockSpatialObject({ dimensions: [scale / 4, scale * 0.33, scale / 5] });
    const second = createMockSpatialObject({ id: 'rotated', position: [scale, scale / 8, -scale], dimensions: [scale / 3, scale / 2, scale / 4], rotation: [25, 65, -15] });
    // Exact reported regression starts at 0.1 m with one object at the origin.
    const room = createMockRoom({ dimensions: [scale, scale, scale], objects: [first], doors: [], windows: [] });
    const before = structuredClone(room);
    controller.adaptCameraToRoom(room);
    controller.focusObject(first.position, room, first.id);
    expectVisible(controller, first);
    const expanded = { ...room, objects: [first, second] };
    controller.updateRoom(expanded);
    for (const item of [second, first, second]) {
      // Real wheel input queues zoom in OrbitControls before explicit focus.
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, cancelable: true }));
      controller.focusObject(item.position, expanded, item.id);
      expectVisible(controller, item);
      for (let frame = 0; frame < 90; frame++) controller.update();
      expectVisible(controller, item);
      expect(controller.getControls().enableDamping).toBe(true);
      expect(controller.getControls().enablePan).toBe(true);
    }
    const camera = controller.getCamera();
    const direction = camera.position.clone().sub(controller.getControls().target).normalize();
    controller.zoomCamera(0.25);
    expect(camera.zoom).toBe(1.25);
    // Pan through the real control's target and camera, then retain that angle on focus.
    camera.position.add(new THREE.Vector3(scale, 0, scale));
    controller.getControls().target.add(new THREE.Vector3(scale, 0, scale));
    controller.update();
    controller.focusObject(first.position, expanded, first.id);
    expect(camera.position.clone().sub(controller.getControls().target).normalize().distanceTo(direction)).toBeLessThan(1e-10);
    expectVisible(controller, first);
    expect(room).toEqual(before);
    controller.dispose();
  });
});
