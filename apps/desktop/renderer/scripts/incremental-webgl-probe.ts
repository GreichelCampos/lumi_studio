/** Real framebuffer comparison of incremental selection against a rebuilt scene. */
import * as THREE from 'three';
import { ThreeSceneManager } from '../src/components/viewport/ThreeSceneManager';
import { createMockRoom, createMockSpatialObject, createMockDoor, createMockWindow } from '../src/tests/fixtures/testFixtures';

const output = document.createElement('pre'); document.body.append(output);
const container = document.createElement('div');
Object.assign(container.style, { width: '800px', height: '600px', position: 'relative' }); document.body.append(container);
const results: unknown[] = [];
let manager: ThreeSceneManager | undefined;
try {
  manager = new ThreeSceneManager({ container, onSelectEntity: () => {} });
  const internal = manager as unknown as {
    contentKey: string | null; roomGroup: THREE.Group; renderer: THREE.WebGLRenderer; scene: THREE.Scene;
    cameraController: { getCamera(): THREE.Camera }; updateDynamicWallOcclusion(): void;
  };
  const gl = internal.renderer.getContext();
  const pixels = () => {
    internal.updateDynamicWallOcclusion();
    internal.renderer.render(internal.scene, internal.cameraController.getCamera()); gl.finish();
    const data = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, data);
    if (gl.getError() !== gl.NO_ERROR) throw new Error('WebGL error');
    return data;
  };
  for (const scale of [0.1, 5, 100]) {
    const item = createMockSpatialObject({ dimensions: [scale / 5, scale / 4, scale / 6], rotation: [15, 35, -10] });
    const room = createMockRoom({ dimensions: [scale, scale, scale], objects: [item],
      doors: [createMockDoor({ width: scale / 5, height: scale / 2, position: 0 })],
      windows: [createMockWindow({ width: scale / 5, height: scale / 4, elevation: scale / 3, position: 0 })] });
    room.walls.north.id = 'declared-wall';
    const before = JSON.stringify(room);
    manager.renderRoom(room, null); pixels();
    for (const [selected, debug] of [[item.id, null], [room.doors[0].id, null], [room.windows[0].id, null],
      ['declared-wall', null], [null, item.id], [null, null], [item.id, null]] as const) {
      const root = internal.roomGroup.children[0];
      const camera = internal.cameraController.getCamera();
      const position = camera.position.clone();
      manager.renderRoom(room, selected, debug);
      if (root !== internal.roomGroup.children[0] || !position.equals(camera.position)) throw new Error('Selection rebuilt scene or moved camera');
      const incremental = pixels();
      internal.contentKey = null; manager.renderRoom(room, selected, debug);
      const rebuilt = pixels();
      let differentBytes = 0;
      for (let i = 0; i < incremental.length; i++) if (incremental[i] !== rebuilt[i]) differentBytes++;
      results.push({ scale, selected, debug, differentBytes });
      if (differentBytes) throw new Error('Incremental visual mismatch');
    }
    if (JSON.stringify(room) !== before) throw new Error('ScenePlan mutated');
  }
  results.push({ renderer: gl.getParameter(gl.RENDERER), version: gl.getParameter(gl.VERSION) });
} catch (error) { results.push({ error: String(error) }); }
finally { manager?.dispose(); }
output.textContent = JSON.stringify(results);
document.title = 'incremental-probe-complete';
