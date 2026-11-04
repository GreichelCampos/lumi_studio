/** Consumes live worker responses supplied by architectural-python-e2e.mjs. */
import * as THREE from 'three';
import capture from '../src/tests/fixtures/python/grei296fd57.real.json';
import { validateProtocolResponse } from '../src/services/integration/protocol/responseValidator';
import { ThreeSceneManager } from '../src/components/viewport/ThreeSceneManager';

const output = document.createElement('pre'); document.body.append(output);
const container = document.createElement('div');
Object.assign(container.style, { width: '800px', height: '600px', position: 'relative' }); document.body.append(container);
const results: unknown[] = [];
let manager: ThreeSceneManager | undefined;
try {
  const cases = (globalThis as typeof globalThis & { lumiPythonCases?: typeof capture.cases }).lumiPythonCases;
  if (!cases) throw new Error('Live Python responses required; run architectural-python-e2e.mjs');
  let picked: string | null = null;
  manager = new ThreeSceneManager({ container, onSelectEntity: id => { picked = id; } });
  const internal = manager as unknown as {
    renderer: THREE.WebGLRenderer; scene: THREE.Scene; roomGroup: THREE.Group;
    cameraController: { getCamera(): THREE.Camera };
    wallRecords: { wall: string; meshes: THREE.Mesh[] }[];
    updateDynamicWallOcclusion(): void;
  };
  for (const item of cases) {
    for (const raw of item.responses) {
      const validated = validateProtocolResponse(raw);
      if (validated.valid === false) throw new Error(`${item.name}: ${validated.errors.join(' ')}`);
    }
    const validated = validateProtocolResponse(item.responses[1]);
    if (validated.valid === false) throw new Error('Invalid response');
    const response = validated.value;
    if (response.status !== 'completed' || !response.result.scenePlan) {
      results.push({ name: item.name, status: response.status, rendered: false }); continue;
    }
    const scene = response.result.scenePlan; const before = JSON.stringify(scene);
    const room = scene.rooms[0]; manager.renderRoom(room, null);
    const root = internal.roomGroup.children[0];
    let selections = 0;
    for (const selected of [...room.doors.map(door => door.id), ...room.objects.map(object => object.id), null]) {
      manager.renderRoom(room, selected);
      if (root !== internal.roomGroup.children[0]) throw new Error('Selection rebuilt geometry');
      internal.updateDynamicWallOcclusion();
      internal.renderer.render(internal.scene, internal.cameraController.getCamera());
      const gl = internal.renderer.getContext(); gl.finish();
      if (gl.getError()) throw new Error('WebGL error');
      selections++;
    }
    for (const door of room.doors) {
      const group = internal.scene.getObjectByName(door.id)!;
      if (!group) throw new Error('Missing producer door ID');
      const axis = door.wall === 'norte' || door.wall === 'sur' ? 0 : 2;
      if (group.position.getComponent(axis) !== door.position || group.position.y !== door.height / 2) throw new Error('Door placement changed');
      const normal = axis === 0 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
      internal.scene.updateMatrixWorld(true);
      const record = internal.wallRecords.find(record => record.wall === door.wall)!;
      const ray = new THREE.Raycaster(group.position.clone().addScaledVector(normal, -10), normal, 0, 20);
      if (ray.intersectObjects(record.meshes).length) throw new Error('Wall cut does not match published door');
      const camera = internal.cameraController.getCamera(); camera.updateMatrixWorld(true);
      const point = group.position.clone().project(camera);
      const canvas = internal.renderer.domElement; const rect = canvas.getBoundingClientRect();
      picked = null;
      for (const type of ['pointerdown', 'pointerup']) canvas.dispatchEvent(new PointerEvent(type, {
        pointerId: 1, button: 0, clientX: rect.left + (point.x + 1) * rect.width / 2,
        clientY: rect.top + (1 - point.y) * rect.height / 2,
      }));
      if (picked !== door.id) throw new Error('Picking lost producer door identity');
    }
    if (JSON.stringify(scene) !== before) throw new Error('Producer DTO mutated');
    results.push({ name: item.name, status: response.status, rendered: true, selections, doors: room.doors.length,
      declaredWallIds: Object.values(room.walls).filter(wall => wall.id).length, glError: 0 });
  }
} catch (error) { results.push({ error: String(error) }); }
finally { manager?.dispose(); }
output.textContent = JSON.stringify(results);
document.title = 'architectural-python-probe-complete';
