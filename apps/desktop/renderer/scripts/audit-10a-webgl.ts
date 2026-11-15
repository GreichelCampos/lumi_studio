import * as THREE from 'three';
import results from '../../../../docs/audits/phase10a/python-results.json';
import cases from '../../../../docs/audits/phase10a/cases.json';
import { validateProtocolResponse } from '../src/services/integration/protocol/responseValidator';
import { ThreeSceneManager } from '../src/components/viewport/ThreeSceneManager';
import { calculateSceneBounds, calculateObjectBounds } from '../src/components/viewport/helpers/sceneScale';

const container = document.createElement('div');
container.style.cssText = 'width:900px;height:650px;position:relative'; document.body.append(container);
const output = document.createElement('pre'); document.body.append(output);
const records: unknown[] = []; const images: Record<string, string> = {};
const manager = new ThreeSceneManager({ container, onSelectEntity: () => {} });
const internal = manager as unknown as {
  scene: THREE.Scene; roomGroup: THREE.Group; renderer: THREE.WebGLRenderer;
  cameraController: { getCamera(): THREE.OrthographicCamera; getControls(): { target: THREE.Vector3; update(): void } };
  updateDynamicWallOcclusion(): void;
};
function projected(bounds: THREE.Box3, camera: THREE.Camera) {
  let maxXY = 0, maxZ = 0;
  for (const x of [bounds.min.x,bounds.max.x]) for (const y of [bounds.min.y,bounds.max.y]) for (const z of [bounds.min.z,bounds.max.z]) {
    const p = new THREE.Vector3(x,y,z).project(camera);
    maxXY = Math.max(maxXY,Math.abs(p.x),Math.abs(p.y)); maxZ = Math.max(maxZ,Math.abs(p.z));
  }
  return { maxXY, maxZ };
}
try {
  const gl = internal.renderer.getContext();
  records.push({ environment: { userAgent: navigator.userAgent, width: 900, height: 650,
    version: gl.getParameter(gl.VERSION), renderer: gl.getParameter(gl.RENDERER) } });
  for (const row of results) {
    const validations = row.responses.map(raw => validateProtocolResponse(raw));
    const invalid = validations.flatMap(value => value.valid === false ? value.errors : []);
    const wire = validations[1];
    if (invalid.length || wire.valid === false) { records.push({ id: row.id, validationErrors: invalid }); continue; }
    const response = wire.value;
    const expected = cases.find(item => item.id === row.id)?.expected;
    const outputMatches = expected && 'output' in expected && response.status !== 'error'
      ? JSON.stringify(response.result.output) === JSON.stringify(expected.output) : null;
    if (response.status !== 'completed' || !response.result.scenePlan) {
      records.push({ id: row.id, protocolValid: true, status: response.status, rendered: false, outputMatches }); continue;
    }
    const scene = response.result.scenePlan; const before = JSON.stringify(scene);
    for (const room of scene.rooms) {
      const repeat = /size-(0\.000000001|0\.000001|0\.01|0\.1|1)-empty|disproportion-tall/.test(row.id) ? 3 : 1;
      for (let iteration = 0; iteration < repeat; iteration++) {
        manager.clearRoom(); manager.renderRoom(room, null); internal.updateDynamicWallOcclusion();
        const camera = internal.cameraController.getCamera();
        internal.renderer.render(internal.scene,camera); gl.finish();
        internal.scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
        const physical = new THREE.Box3();
        const physicalVertices={maxXY:0,maxZ:0,outside:0,total:0};
        internal.roomGroup.traverse(child => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            physical.union(new THREE.Box3().setFromObject(child));
            const positions=child.geometry.getAttribute('position');
            for(let index=0;index<positions.count;index++) {
              const point=new THREE.Vector3().fromBufferAttribute(positions,index).applyMatrix4(child.matrixWorld).project(camera);
              const xy=Math.max(Math.abs(point.x),Math.abs(point.y)); const z=Math.abs(point.z);
              physicalVertices.maxXY=Math.max(physicalVertices.maxXY,xy);physicalVertices.maxZ=Math.max(physicalVertices.maxZ,z);
              physicalVertices.total++;if(xy>1||z>1)physicalVertices.outside++;
            }
          }
        });
        const grid = internal.scene.getObjectByName('gridHelper') as THREE.GridHelper;
        const gridBox = new THREE.Box3().setFromObject(grid);
        const floor=internal.scene.getObjectByName('floor') as THREE.Mesh;
        const floorSize=new THREE.Box3().setFromBufferAttribute(floor.geometry.getAttribute('position') as THREE.BufferAttribute).getSize(new THREE.Vector3());
        const precision={floorWidth:floorSize.x,floorLength:floorSize.z,maxRelativeError:Math.max(
          Math.abs(floorSize.x-room.dimensions[0])/room.dimensions[0],Math.abs(floorSize.z-room.dimensions[1])/room.dimensions[1])};
        const gridProjection=new THREE.Box3();
        for(const x of [gridBox.min.x,gridBox.max.x]) for(const y of [gridBox.min.y,gridBox.max.y]) for(const z of [gridBox.min.z,gridBox.max.z]) gridProjection.expandByPoint(new THREE.Vector3(x,y,z).project(camera));
        const gridSpan=gridProjection.getSize(new THREE.Vector3());
        const root = internal.roomGroup.children[0];
        const objects = room.objects.filter(object => object.position !== undefined).map(object => {
          const group = internal.scene.getObjectByName(object.id);
          const materials: unknown[] = [];
          group?.traverse(child => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) materials.push({
              color: child.material.color.getHexString(),roughness:child.material.roughness,metalness:child.material.metalness,
            });
          });
          return { id:object.id,name:object.name,geometryPresent:Boolean(group),position:group?.position.toArray(),
            rotationDegrees:group ? [group.rotation.x,group.rotation.y,group.rotation.z].map(THREE.MathUtils.radToDeg) : null,
            materials,projected:projected(calculateObjectBounds(object),camera) };
        });
        for (const object of room.objects.filter(object => object.position !== undefined)) manager.renderRoom(room,object.id);
        const record = { id: row.id, room: room.name, iteration, protocolValid: true, rendered: true,
          dimensions: room.dimensions, logical: projected(calculateSceneBounds(room),camera), physical: projected(physical,camera),physicalVertices,precision,
          camera: { position: camera.position.toArray(), near: camera.near, far: camera.far, zoom: camera.zoom },
          grid: { position: grid.position.toArray(), size: gridBox.getSize(new THREE.Vector3()).toArray(), vertices: grid.geometry.getAttribute('position').count,
            projectedWidthPixels:gridSpan.x*900/2,projectedHeightPixels:gridSpan.y*650/2 },
          objects, unplacedGeometry: room.objects.filter(object => object.position === undefined).map(object => Boolean(internal.scene.getObjectByName(object.id))),
          selectionReusedRoot: root === internal.roomGroup.children[0], calls: internal.renderer.info.render.calls, glError: gl.getError() };
        records.push(record);
        if ((iteration === 0 && ['size-0.01-empty','size-0.1-empty','size-5-object','size-10000-empty','furniture-material-rotation'].includes(row.id)) || row.id === 'disproportion-tall') {
          manager.renderRoom(room,null); internal.renderer.render(internal.scene,camera); gl.finish();
          if (iteration === 0) images[row.id] = manager.captureSnapshot();
          const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
          gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
          let nonBackgroundPixels = 0;
          for (let offset = 0; offset < pixels.length; offset += 4) {
            if (pixels[offset] !== pixels[0] || pixels[offset+1] !== pixels[1] || pixels[offset+2] !== pixels[2]) nonBackgroundPixels++;
          }
          records.push({ id: row.id, iteration, rasterCheck: true, nonBackgroundPixels, totalPixels: pixels.length / 4 });
        }
        if (room.objects.some(object => object.position !== undefined)) {
          const object=room.objects.find(object=>object.position!==undefined)!;
          manager.renderRoom(room,object.id);manager.focusObject(object.position);
          internal.renderer.render(internal.scene,camera);gl.finish();camera.updateMatrixWorld(true);
          records.push({id:row.id,focusObject:object.id,projected:projected(calculateObjectBounds(object),camera),glError:gl.getError()});
        }
        if (row.id === 'size-5-empty') {
          const original = grid.position.clone(); const controls = internal.cameraController.getControls();
          const distance = gridBox.getSize(new THREE.Vector3()).x * 10;
          camera.position.x += distance; controls.target.x += distance; controls.update(); camera.updateMatrixWorld(true);
          const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
          records.push({ id: 'grid-pan', gridMoved: !grid.position.equals(original), distance, gridIntersectsFrustum: frustum.intersectsObject(grid) });
          manager.focusRoom();
        }
      }
    }
    if (JSON.stringify(scene) !== before) throw new Error(`Producer DTO mutated: ${row.id}`);
  }
} catch (error) { records.push({ fatal: String(error) }); }
finally { manager.dispose(); }
output.textContent = JSON.stringify({ records, images }); document.title = 'audit-10a-complete';
