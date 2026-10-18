import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CameraController } from '../../../components/viewport/camera/CameraController';
import { ObjectSelectionController } from '../../../components/viewport/interaction/ObjectSelectionController';
import { ThreeResourceDisposer } from '../../../components/viewport/resources/ThreeResourceDisposer';
import { createMockRoom } from '../../fixtures/testFixtures';

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
function surface() {
  const container = document.createElement('div');
  Object.defineProperties(container, { clientWidth: { value: 800, configurable: true }, clientHeight: { value: 600, configurable: true } });
  const canvas = document.createElement('canvas');
  container.appendChild(canvas); document.body.appendChild(container);
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ x: 100, y: 200, left: 100, top: 200, right: 500, bottom: 500, width: 400, height: 300, toJSON: () => ({}) });
  return { container, canvas };
}
function pointer(canvas: HTMLCanvasElement, type: string, x = 300, y = 350, button = 0) {
  const event = new MouseEvent(type, { clientX: x, clientY: y, button });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  canvas.dispatchEvent(event);
}

describe('orthographic camera', () => {
  it.each(([[6, 4, 3], [1000, 20, 100], [0.1, 0.1, 0.1]] as [number, number, number][]).map(dimensions => ({ dimensions })))('fits the complete room at landscape and portrait aspect ratios: $dimensions', ({ dimensions }) => {
    const { container, canvas } = surface();
    const controller = new CameraController({ container, rendererDomElement: canvas });
    const room = createMockRoom({ dimensions }); controller.adaptCameraToRoom(room);
    for (const [width, height] of [[800, 600], [250, 1000]]) {
      Object.defineProperties(container, { clientWidth: { value: width, configurable: true }, clientHeight: { value: height, configurable: true } });
      controller.handleResize(room);
      const camera = controller.getCamera(); camera.updateMatrixWorld();
      for (const x of [-dimensions[0] / 2, dimensions[0] / 2]) for (const y of [0, dimensions[2]]) for (const z of [-dimensions[1] / 2, dimensions[1] / 2]) {
        const point = new THREE.Vector3(x, y, z).project(camera);
        expect(Math.abs(point.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(point.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(point.z)).toBeLessThanOrEqual(1);
      }
    }
    controller.dispose();
  });
  it('uses equal wheel/button zoom limits, preserves zoom on resize and restores room framing', () => {
    const { container, canvas } = surface();
    const controller = new CameraController({ container, rendererDomElement: canvas });
    const room = createMockRoom(); controller.adaptCameraToRoom(room);
    controller.zoomCamera(100); expect(controller.getCamera().zoom).toBe(3.5);
    expect(controller.getControls().maxZoom).toBe(3.5);
    controller.handleResize(); expect(controller.getCamera().zoom).toBe(3.5);
    controller.zoomCamera(-100); expect(controller.getCamera().zoom).toBe(0.4);
    expect(controller.getControls().minZoom).toBe(0.4);
    controller.zoomCamera(NaN); expect(controller.getCamera().zoom).toBe(0.4);
    controller.focusObject([2, 1, -1], room);
    expect(controller.getControls().target.toArray()).toEqual([2, 1.4, -1]);
    controller.resetCamera(room); expect(controller.getCamera().zoom).toBe(1);
    expect(controller.getControls().target.x).toBe(0);
    Object.defineProperty(container, 'clientHeight', { value: 0 });
    expect(() => controller.handleResize()).not.toThrow();
    const dispose = vi.spyOn(controller.getControls(), 'dispose'); controller.dispose(); expect(dispose).toHaveBeenCalledOnce();
  });
});

describe('raycast selection', () => {
  it('selects nested meshes by entity ID and clears selection on empty space', () => {
    const { canvas } = surface();
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-2, 2, 1.5, -1.5, 0.1, 100);
    camera.position.set(0, 0, 5); camera.lookAt(0, 0, 0);
    const group = new THREE.Group(); group.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())); scene.add(group);
    const select = vi.fn();
    const controller = new ObjectSelectionController({ domElement: canvas, scene, getCamera: () => camera, onSelectEntity: select });
    controller.registerPickable(group, 'cube');
    pointer(canvas, 'pointerdown'); pointer(canvas, 'pointerup'); expect(select).toHaveBeenLastCalledWith('cube');
    pointer(canvas, 'pointerdown', 490, 210); pointer(canvas, 'pointerup', 490, 210); expect(select).toHaveBeenLastCalledWith(null);
    controller.clearPickables(); pointer(canvas, 'pointerdown'); pointer(canvas, 'pointerup'); expect(select).toHaveBeenLastCalledWith(null);
    controller.dispose(); ThreeResourceDisposer.disposeHierarchy(scene);
  });
  it('ignores orbit drags, right-button pan, canceled pointers and events after disposal', () => {
    const { canvas } = surface(); const select = vi.fn();
    const controller = new ObjectSelectionController({ domElement: canvas, scene: new THREE.Scene(), getCamera: () => new THREE.OrthographicCamera(), onSelectEntity: select });
    pointer(canvas, 'pointerdown'); pointer(canvas, 'pointerup', 350, 360);
    pointer(canvas, 'pointerdown', 300, 350, 2); pointer(canvas, 'pointerup', 300, 350, 2);
    pointer(canvas, 'pointerdown'); canvas.dispatchEvent(new Event('pointercancel')); pointer(canvas, 'pointerup');
    controller.dispose(); pointer(canvas, 'pointerdown'); pointer(canvas, 'pointerup');
    expect(select).not.toHaveBeenCalled();
  });
});

describe('graphics resource disposal', () => {
  it('disposes meshes, lines, points, sprites, shared resources and shadow maps', () => {
    const scene = new THREE.Scene(); const geometry = new THREE.BoxGeometry();
    const texture = new THREE.Texture(); const material = new THREE.MeshBasicMaterial({ map: texture });
    scene.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material), new THREE.LineSegments(geometry, material), new THREE.Points(geometry, material));
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture }); scene.add(new THREE.Sprite(spriteMaterial));
    const light = new THREE.DirectionalLight(); scene.add(light);
    const spies = [vi.spyOn(geometry, 'dispose'), vi.spyOn(material, 'dispose'), vi.spyOn(texture, 'dispose'), vi.spyOn(spriteMaterial, 'dispose'), vi.spyOn(light.shadow, 'dispose')];
    ThreeResourceDisposer.disposeHierarchy(scene);
    spies.forEach(spy => expect(spy).toHaveBeenCalledOnce());
  });
});
