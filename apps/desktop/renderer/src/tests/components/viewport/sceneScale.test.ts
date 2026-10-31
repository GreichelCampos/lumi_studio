import { it, expect } from 'vitest';
import * as THREE from 'three';
import { calculateSceneBounds, calculateVisualScale, calculateProjectedSpan } from '../../../components/viewport/helpers/sceneScale';
import { createMockRoom, createMockSpatialObject } from '../../fixtures/testFixtures';
it('includes rotated placed objects, excludes unplaced objects and preserves input', () => {
 const { position: _position, ...unplaced } = createMockSpatialObject({ dimensions: [1e6, 1e6, 1e6] });
 const room = createMockRoom({ objects: [createMockSpatialObject({ position: [10, 0, 0], dimensions: [2, 3, 4], rotation: [0, 90, 0] }), { ...unplaced, placed: false }] });
 const before = structuredClone(room);
 expect(calculateSceneBounds(room).max.x).toBeCloseTo(12);
 expect(calculateSceneBounds(room).max.y).toBe(3);
 expect(room).toEqual(before);
});
it.each([0.001, 1, 1000, 1e6])('fits all corners at scale %s', scale => {
 const bounds = calculateSceneBounds(createMockRoom({ dimensions: [scale, scale * 2, scale * 3], objects: [] }));
 const visual = calculateVisualScale(bounds);
 expect(visual.divisions).toBeLessThan(40);
 expect(visual.near).toBeGreaterThan(0);
 expect(visual.far).toBeGreaterThan(visual.distance + visual.radius);
 const camera = new THREE.OrthographicCamera();
 const center = bounds.getCenter(new THREE.Vector3());
 camera.position.copy(center).add(new THREE.Vector3(1, 1.05, 1).normalize().multiplyScalar(visual.distance));
 camera.lookAt(center); camera.updateMatrixWorld();
 for (const aspect of [0.2, 1, 3]) {
 const span = calculateProjectedSpan(bounds, camera.matrixWorldInverse, aspect);
 for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
 const point = new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse);
 expect(Math.abs(point.x)).toBeLessThan(span * aspect);
 expect(Math.abs(point.y)).toBeLessThan(span);
 }
 }
});
