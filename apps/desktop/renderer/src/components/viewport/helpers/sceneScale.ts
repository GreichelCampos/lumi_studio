import * as THREE from 'three';
import { RoomModel, PlacedSpatialObject, isPlacedSpatialObject } from '../../../types';

/** Renderer bounds: room is width/length/height; furniture is width/height/depth. */
export function calculateSceneBounds(room: RoomModel): THREE.Box3 {
  const [w, l, h] = room.dimensions;
  const bounds = new THREE.Box3(new THREE.Vector3(-w / 2, 0, -l / 2), new THREE.Vector3(w / 2, h, l / 2));
  for (const item of room.objects.filter(isPlacedSpatialObject)) {
    bounds.union(calculateObjectBounds(item));
  }
  return bounds;
}

/** Matches FurnitureFactory's bottom-centered origin and XYZ Euler rotations. */
export function calculateObjectBounds(item: Pick<PlacedSpatialObject, 'dimensions' | 'rotation' | 'position'>): THREE.Box3 {
  const [width, height, depth] = item.dimensions;
  const [rx, ry, rz] = item.rotation.map(THREE.MathUtils.degToRad);
  const matrix = new THREE.Matrix4()
    .makeRotationFromEuler(new THREE.Euler(rx, ry, rz))
    .setPosition(...item.position);
  return new THREE.Box3(
    new THREE.Vector3(-width / 2, 0, -depth / 2),
    new THREE.Vector3(width / 2, height, depth / 2)
  ).applyMatrix4(matrix);
}

export function calculateVisualScale(bounds: THREE.Box3) {
  const size = bounds.getSize(new THREE.Vector3());
  const radius = Math.max(size.length() / 2, 0.01);
  const extent = Math.max(size.x, size.z, 0.01);
  const rawStep = extent / 20;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = Math.ceil(rawStep / magnitude) * magnitude;
  const divisions = Math.ceil(extent * 1.4 / step / 2) * 2;
  return { radius, step, divisions, gridSize: divisions * step, distance: radius * 3, near: radius * 0.001, far: radius * 10 };
}

export function calculateProjectedSpan(bounds: THREE.Box3, inverse: THREE.Matrix4, aspect: number): number {
  let span = 0;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const point = new THREE.Vector3(x, y, z).applyMatrix4(inverse);
    span = Math.max(span, Math.abs(point.x) / Math.max(aspect, 0.001), Math.abs(point.y));
  }
  return Math.max(span * 1.12, 0.01);
}
