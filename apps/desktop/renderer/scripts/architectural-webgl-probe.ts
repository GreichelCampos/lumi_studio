/** Real WebGL smoke test; input DTOs are fixtures, not output from the Python producer. */
import * as THREE from 'three';
import { ThreeSceneManager } from '../src/components/viewport/ThreeSceneManager';
import { wallFaces } from '../src/components/viewport/helpers/architecturalSelection';
import { createMockRoom, createMockDoor, createMockWindow } from '../src/tests/fixtures/testFixtures';

const output = document.createElement('pre'); document.body.append(output);
const container = document.createElement('div');
Object.assign(container.style, { width: '800px', height: '600px', position: 'relative' }); document.body.append(container);
const results: unknown[] = [];
let manager: ThreeSceneManager | undefined;
try {
  manager = new ThreeSceneManager({ container, onSelectEntity: () => {} });
  const internal = manager as unknown as {
    renderer: THREE.WebGLRenderer; scene: THREE.Scene;
    cameraController: { getCamera(): THREE.Camera };
    wallRecords: { entityId?: string; meshes: THREE.Mesh[]; materials: THREE.MeshStandardMaterial[] }[];
  };
  const gl = internal.renderer.getContext();
  for (const scale of [0.1, 5, 100]) for (const [key, wall] of wallFaces) {
    const win = createMockWindow({ wall, width: scale * 0.2, height: scale * 0.3, position: scale * 0.25,
      elevation: scale * 0.2, name: 'lateral', color: '#123456', material: 'acero' });
    const door = createMockDoor({ wall, width: scale * 0.2, height: scale * 0.6, position: -scale * 0.25 });
    const room = createMockRoom({ dimensions: [scale, scale, scale], objects: [], doors: [door], windows: [win] });
    room.walls[key] = { ...room.walls[key], id: 'fixture-declared-wall', name: 'principal', sourceRef: { file: 'principal.lumi', line: 3, column: 5 } };
    const before = JSON.stringify(room);
    manager.renderRoom(room, 'fixture-declared-wall');
    internal.renderer.render(internal.scene, internal.cameraController.getCamera()); gl.finish();
    const windowGroup = internal.scene.getObjectByName(win.id)!;
    if (Math.abs(windowGroup.position.y - scale * 0.35) > scale * 1e-8) throw new Error('Window center mismatch');
    const face = internal.wallRecords.find(record => record.entityId === 'fixture-declared-wall')!;
    if (face.meshes.length < 2 || face.materials.some(material => material.emissiveIntensity <= 0)) throw new Error('Missing wall selection/highlight');
    const direction = key === 'north' || key === 'south' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const ray = new THREE.Raycaster(windowGroup.position.clone().addScaledVector(direction, -scale - 1), direction, 0, scale * 2 + 2);
    internal.scene.updateMatrixWorld(true);
    if (ray.intersectObjects(face.meshes).length) throw new Error('Window cut mismatch');
    if (JSON.stringify(room) !== before) throw new Error('ScenePlan mutated');
    const glError = gl.getError();
    if (glError !== 0) throw new Error(`WebGL error ${glError}`);
    results.push({ scale, wall, segments: face.meshes.length, windowCenter: windowGroup.position.y, glError,
      calls: internal.renderer.info.render.calls, geometries: internal.renderer.info.memory.geometries });
  }
  results.push({ version: gl.getParameter(gl.VERSION), renderer: gl.getParameter(gl.RENDERER) });
} catch (error) { results.push({ error: String(error) }); }
finally { manager?.dispose(); }
output.textContent = JSON.stringify(results);
document.title = 'architectural-probe-complete';
