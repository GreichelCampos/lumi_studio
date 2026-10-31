/** Bundle with existing esbuild and run in a browser; no test mocks. */
import * as THREE from 'three';
import { calculateObjectBounds } from '../src/components/viewport/helpers/sceneScale';
import { ThreeSceneManager } from '../src/components/viewport/ThreeSceneManager';
import { createMockRoom, createMockSpatialObject } from '../src/tests/fixtures/testFixtures';
const output = document.createElement('pre'); document.body.append(output);
const container = document.createElement('div');
Object.assign(container.style, { width: '800px', height: '600px', position: 'relative' }); document.body.append(container);
const results: unknown[] = [];
let manager: ThreeSceneManager | undefined;
try {
 manager = new ThreeSceneManager({ container, onSelectEntity: () => {} });
 // Inspect internal renderer only in this diagnostic harness.
 const internal = manager as unknown as { renderer: import('three').WebGLRenderer; scene: import('three').Scene; cameraController: { getCamera(): import('three').Camera } };
 const gl = internal.renderer.getContext();
 for (const scale of [0.1, 5, 100]) {
  const room = createMockRoom({ dimensions: [scale, scale, scale], doors: [], windows: [], objects: [createMockSpatialObject({ dimensions: [scale / 4, scale / 3, scale / 5], position: [scale, 0, 0] })] });
  manager.renderRoom(room, null);
  const start = performance.now();
  internal.renderer.render(internal.scene, internal.cameraController.getCamera()); gl.finish();
  results.push({ scale, firstRenderAndFinishMs: performance.now() - start, glError: gl.getError(), geometries: internal.renderer.info.memory.geometries, calls: internal.renderer.info.render.calls });
  const rotated = createMockSpatialObject({ id: 'rotated', position: [-scale, scale / 8, scale], dimensions: [scale / 3, scale / 2, scale / 4], rotation: [25, 65, -15] });
  const expanded = { ...room, objects: [...room.objects, rotated] };
  for (const item of [room.objects[0], rotated, room.objects[0]]) {
   manager.renderRoom(expanded, item.id);
   manager.focusObject(item.position);
   internal.renderer.render(internal.scene, internal.cameraController.getCamera()); gl.finish();
   const bounds = calculateObjectBounds(item);
   const camera = internal.cameraController.getCamera(); camera.updateMatrixWorld();
   let maxXY = 0; let maxZ = 0;
   for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const point = new THREE.Vector3(x, y, z).project(camera);
    maxXY = Math.max(maxXY, Math.abs(point.x), Math.abs(point.y));
    maxZ = Math.max(maxZ, Math.abs(point.z));
   }
   const glError = gl.getError();
   results.push({ scale, focused: item.id, maxXY, maxZ, glError });
   if (maxXY > 0.9 || maxZ >= 1 || glError !== 0) throw new Error('Focus or WebGL regression');
  }
 }
 results.push({ renderer: gl.getParameter(gl.RENDERER), version: gl.getParameter(gl.VERSION) });
} catch (error) { results.push({ error: String(error) }); }
finally { manager?.dispose(); }
output.textContent = JSON.stringify(results);
document.title = 'probe-complete';
