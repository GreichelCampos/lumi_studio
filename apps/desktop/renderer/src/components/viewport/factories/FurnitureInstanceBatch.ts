import * as THREE from 'three';
import type { LegacySpatialObject, SpatialObject } from '../../../types';
import { ThreeResourceDisposer } from '../resources/ThreeResourceDisposer';
import { FurnitureFactory } from './FurnitureFactory';

export class FurnitureInstanceBatch {
  public readonly group = new THREE.Group();
  private readonly parts: Array<{ mesh: THREE.InstancedMesh; localMatrix: THREE.Matrix4 }> = [];
  private readonly transforms: THREE.Matrix4[];
  private readonly highlighted = new Map<number, THREE.Group>();
  private readonly hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(private readonly items: readonly LegacySpatialObject[], private readonly wireframe: boolean) {
    this.transforms = items.map(item => {
      const [x, y, z] = item.rotation.map(THREE.MathUtils.degToRad);
      const orientation = new THREE.Euler(x, y, z);
      return new THREE.Matrix4().compose(
        new THREE.Vector3(...item.position),
        new THREE.Quaternion().setFromEuler(orientation),
        new THREE.Vector3(1, 1, 1),
      );
    });

    const template = FurnitureFactory.createFurnitureMesh({
      ...items[0], position: [0, 0, 0], rotation: [0, 0, 0],
      hasError: false, isOutOfBounds: false, hasWarning: false, hasCollision: false,
    }, false, wireframe);
    template.updateMatrixWorld(true);
    template.traverse(part => {
      if (!(part instanceof THREE.Mesh)) return;
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, items.length);
      mesh.castShadow = part.castShadow;
      mesh.receiveShadow = part.receiveShadow;
      this.parts.push({ mesh, localMatrix: part.matrixWorld.clone() });
      this.group.add(mesh);
    });
    for (let index = 0; index < items.length; index++) this.updateMatrices(index, false);
    for (const { mesh } of this.parts) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }

  private updateMatrices(index: number, hidden: boolean): void {
    const matrix = new THREE.Matrix4();
    for (const { mesh, localMatrix } of this.parts) {
      mesh.setMatrixAt(index, hidden ? this.hiddenMatrix : matrix.multiplyMatrices(this.transforms[index], localMatrix));
    }
  }

  public pick(hit: THREE.Intersection): string | null {
    if (hit.instanceId !== undefined) {
      return this.highlighted.has(hit.instanceId) ? null : this.items[hit.instanceId]?.id ?? null;
    }
    let object: THREE.Object3D | null = hit.object;
    while (object && object.parent !== this.group) object = object.parent;
    return object?.userData.furnitureId ?? null;
  }

  public update(index: number, item: SpatialObject, selected: boolean, debug: boolean): void {
    const previous = this.highlighted.get(index);
    if (previous) {
      this.group.remove(previous);
      ThreeResourceDisposer.disposeHierarchy(previous);
      this.highlighted.delete(index);
    }
    const highlighted = Boolean(selected || debug || item.hasError || item.isOutOfBounds || item.hasWarning || item.hasCollision);
    if (highlighted) {
      const overlay = FurnitureFactory.createFurnitureMesh(item, selected, this.wireframe, debug);
      overlay.userData.furnitureId = item.id;
      this.highlighted.set(index, overlay);
      this.group.add(overlay);
    }
    if (Boolean(previous) !== highlighted) {
      this.updateMatrices(index, highlighted);
      for (const { mesh } of this.parts) mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
