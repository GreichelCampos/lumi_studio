/** Real Python capture replayed through production DTO validation and WebGL rendering. */
import * as THREE from 'three';
import casa from '../src/tests/fixtures/python/casaEjemplo.real.json';
import { validateProtocolResponse } from '../src/services/integration/protocol/responseValidator';
import { ThreeSceneManager } from '../src/components/viewport/ThreeSceneManager';

const output = document.createElement('pre'); document.body.append(output);
const container = document.createElement('div');
Object.assign(container.style, { width: '800px', height: '600px', position: 'relative' }); document.body.append(container);
const results: unknown[] = [];
let manager: ThreeSceneManager | undefined;
try {
  const validation = validateProtocolResponse(casa.responses[1]);
  if (validation.valid === false) throw new Error(validation.errors.join(' '));
  if (validation.value.status !== 'completed' || !validation.value.result.scenePlan) throw new Error('Missing successful Python scene');
  const scene = validation.value.result.scenePlan; const before = JSON.stringify(scene);
  manager = new ThreeSceneManager({ container, onSelectEntity: () => {} });
  const internal = manager as unknown as {
    renderer: THREE.WebGLRenderer; scene: THREE.Scene; roomGroup: THREE.Group;
    cameraController: { getCamera(): THREE.Camera }; updateDynamicWallOcclusion(): void;
  };
  for (const room of scene.rooms) {
    manager.renderRoom(room, null); const root = internal.roomGroup.children[0];
    for (const selected of [...room.objects.map(item => item.id), null]) {
      manager.renderRoom(room, selected);
      if (internal.roomGroup.children[0] !== root) throw new Error('Selection rebuilt room');
      internal.updateDynamicWallOcclusion();
      internal.renderer.render(internal.scene, internal.cameraController.getCamera());
      const gl = internal.renderer.getContext(); gl.finish();
      const error = gl.getError(); if (error) throw new Error(`WebGL error ${error}`);
      results.push({ room: room.name, selected, objects: room.objects.length, calls: internal.renderer.info.render.calls, glError: error });
    }
  }
  if (JSON.stringify(scene) !== before) throw new Error('Python DTO mutated');
} catch (error) { results.push({ error: String(error) }); }
finally { manager?.dispose(); }
output.textContent = JSON.stringify(results);
document.title = 'casa-ejemplo-probe-complete';
