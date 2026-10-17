import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { RoomFactory } from '../../../../components/viewport/factories/RoomFactory';
import { FurnitureFactory } from '../../../../components/viewport/factories/FurnitureFactory';
import { OpeningFactory } from '../../../../components/viewport/factories/OpeningFactory';
import { wallSegments, openingPlacement, WINDOW_CENTER_HEIGHT } from '../../../../components/viewport/helpers/openingLayout';
import { surfaceColor, surfaceMaterial } from '../../../../components/viewport/helpers/surfaceMaterial';
import { validateViewportScene } from '../../../../components/viewport/helpers/validateViewportScene';
import { ThreeResourceDisposer } from '../../../../components/viewport/resources/ThreeResourceDisposer';
import { createMockRoom, createMockDoor, createMockWindow, createMockSpatialObject, createMockScenePlan } from '../../../fixtures/testFixtures';

beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
afterEach(() => vi.restoreAllMocks());
const options = { isWireframe: false, showDimensions: false, showReferenceAxes: false };

describe('rectangular rooms and openings', () => {
  it('creates a floor with its upper face at zero and four correctly sized walls', () => {
    const room = createMockRoom({ dimensions: [6, 4, 3], doors: [], windows: [], floor: { color: '#ff0000', material: 'metal' } });
    const { group, wallRecords } = RoomFactory.createRoomStructure(room, options);
    const floor = group.getObjectByName('floor') as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
    expect(floor.geometry.parameters).toMatchObject({ width: 6, height: 0.08, depth: 4 });
    expect(floor.position.y + 0.04).toBe(0);
    expect(floor.material.color.getHexString()).toBe('ff0000');
    expect(floor.material.metalness).toBe(0.8);
    expect(wallRecords.map(record => record.wall).sort()).toEqual(['este', 'norte', 'oeste', 'sur']);
    expect(group.getObjectByName('wall-norte')!.position.z).toBeCloseTo(-2.08);
    expect(group.getObjectByName('wall-sur')!.position.z).toBeCloseTo(2.08);
    expect(group.getObjectByName('wall-este')!.position.x).toBeCloseTo(3.08);
    expect(group.getObjectByName('wall-oeste')!.position.x).toBeCloseTo(-3.08);
    ThreeResourceDisposer.disposeHierarchy(group);
  });
  it.each(['norte', 'sur', 'este', 'oeste'] as const)('cuts every door and window on wall %s', wall => {
    const room = createMockRoom({ dimensions: [6, 6, 3],
      doors: [createMockDoor({ wall, position: -1.5, width: 0.8, height: 2 })],
      windows: [createMockWindow({ wall, position: 1.5, width: 1, height: 1 })],
    });
    const segments = wallSegments(room, wall);
    const area = segments.reduce((sum, part) => sum + (part.right - part.left) * (part.top - part.bottom), 0);
    expect(area).toBeCloseTo(18 - 1.6 - 1);
    for (const segment of segments) {
      expect(segment.right).toBeGreaterThan(segment.left);
      expect(segment.top).toBeGreaterThan(segment.bottom);
      expect(segment.bottom).toBeGreaterThanOrEqual(0);
      expect(segment.top).toBeLessThanOrEqual(3);
    }
    const { group } = RoomFactory.createRoomStructure(room, options);
    const ray = new THREE.Raycaster();
    for (const opening of [...room.doors, ...room.windows]) {
      const center = openingPlacement(opening, room, opening === room.doors[0] ? opening.height / 2 : WINDOW_CENTER_HEIGHT);
      const position = new THREE.Vector3(...center.position);
      const direction = wall === 'norte' || wall === 'sur' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
      ray.set(position.clone().addScaledVector(direction, -0.5), direction);
      ray.far = 1;
      group.updateMatrixWorld(true);
      expect(ray.intersectObjects(group.children.filter(child => child.name === `wall-${wall}`))).toHaveLength(0);
    }
    ThreeResourceDisposer.disposeHierarchy(group);
  });
  it('cuts overlapping openings once and clips wall cuts without changing source data', () => {
    const room = createMockRoom({ dimensions: [6, 6, 3], doors: [createMockDoor({ position: 0, width: 2, height: 2, wall: 'norte' })],
      windows: [createMockWindow({ position: 0, width: 2, height: 1, wall: 'norte' })] });
    expect(wallSegments(room, 'norte').reduce((sum, p) => sum + (p.right - p.left) * (p.top - p.bottom), 0)).toBeCloseTo(13.8);
    room.windows[0].position = 100;
    const original = structuredClone(room);
    const parts = wallSegments(room, 'norte');
    expect(parts.every(p => p.left >= -3 && p.right <= 3)).toBe(true);
    expect(room).toEqual(original);
  });
  it.each(['norte', 'sur', 'este', 'oeste'] as const)('positions transparent windows and door leaves on %s', wall => {
    const room = createMockRoom({ dimensions: [6, 4, 3] });
    const door = createMockDoor({ wall, position: -0.6, width: 0.01, height: 0.01 });
    const win = createMockWindow({ wall, position: 0.4, width: 0.01, height: 0.01 });
    const groups = [OpeningFactory.createDoorMesh(door, room, false, true), OpeningFactory.createWindowMesh(win, room, false, true)];
    expect(groups[0].position.toArray()).toEqual(openingPlacement(door, room, 0.005).position);
    expect(groups[1].position.toArray()).toEqual(openingPlacement(win, room, 1.6).position);
    expect(groups[1].rotation.y).toBe(wall === 'este' || wall === 'oeste' ? Math.PI / 2 : 0);
    let glass = 0;
    for (const group of groups) {
      group.traverse(child => {
        if (child instanceof THREE.Mesh && child.geometry instanceof THREE.BoxGeometry) {
          expect(child.material.wireframe).toBe(true);
          const parameters = child.geometry.parameters;
          expect(Math.min(parameters.width, parameters.height, parameters.depth)).toBeGreaterThan(0);
          if (child.material instanceof THREE.MeshPhysicalMaterial) {
            glass++; expect(child.material.transmission).toBeGreaterThan(0); expect(child.material.transparent).toBe(true);
          }
        }
      });
      ThreeResourceDisposer.disposeHierarchy(group);
    }
    expect(glass).toBe(1);
  });
});

describe('furniture and visual material profiles', () => {
  it.each(['cubo', 'mesa', 'silla', 'cama', 'sofa', 'armario', 'escritorio', 'estante', 'lampara', 'televisor', 'planta'])('preserves exact local dimensions and primary material for %s', type => {
    for (const dimensions of [[1.3, 0.8, 0.6], [0.01, 0.02, 0.01]] as [number, number, number][]) {
      const object = createMockSpatialObject({ type, position: [0, 0, 0], rotation: [0, 0, 0], dimensions, color: '#123456', material: 'acero' });
      const group = FurnitureFactory.createFurnitureMesh(object, false, true);
      const bounds = new THREE.Box3().setFromObject(group);
      const size = bounds.getSize(new THREE.Vector3());
      size.toArray().forEach((value, index) => expect(value).toBeCloseTo(dimensions[index], 5));
      expect(bounds.min.y).toBeCloseTo(0);
      let primary = 0;
      group.traverse(child => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          expect(child.material.wireframe).toBe(true);
          if (child.material.color.getHexString() === '123456') { primary++; expect(child.material.metalness).toBe(0.8); }
        }
      });
      expect(primary).toBeGreaterThan(0);
      ThreeResourceDisposer.disposeHierarchy(group);
    }
  });
  it('applies all three degree rotations and the floor-centered position without mutating the scene', () => {
    const object = createMockSpatialObject({ rotation: [30, 90, -45], position: [-2, 1, 3] });
    const original = structuredClone(object);
    const group = FurnitureFactory.createFurnitureMesh(object, false, false);
    expect(group.position.toArray()).toEqual([-2, 1, 3]);
    expect(group.rotation.x).toBeCloseTo(Math.PI / 6);
    expect(group.rotation.y).toBeCloseTo(Math.PI / 2);
    expect(group.rotation.z).toBeCloseTo(-Math.PI / 4);
    expect(object).toEqual(original);
    ThreeResourceDisposer.disposeHierarchy(group);
  });
  it('resolves known colors and uses deterministic defaults for unknown materials and colors', () => {
    expect(surfaceColor(' rojo ', '#ffffff')).toBe('#991b1b');
    expect(surfaceColor(' #00FF00 ', '#ffffff')).toBe('#00ff00');
    expect(surfaceColor('blue', '#ffffff')).toBe('blue');
    expect(surfaceColor('unknown', '#ffffff')).toBe('#ffffff');
    expect(surfaceMaterial('roble').roughness).toBeGreaterThan(surfaceMaterial('acero').roughness);
    expect(surfaceMaterial('unknown')).toEqual(surfaceMaterial());
  });
  it.each([null, {}, { version: '1.0.0', rooms: [null] },
    createMockScenePlan({ rooms: [createMockRoom({ dimensions: [0, 4, 3] })] }),
    createMockScenePlan({ rooms: [createMockRoom({ objects: [createMockSpatialObject({ position: [NaN, 0, 0] })] })] }),
  ])('reports malformed scene data before constructing geometry', value => {
    expect(validateViewportScene(value)).not.toBeNull();
  });
  it('accepts structurally valid empty scenes and does not add ID rules to the candidate contract', () => {
    expect(validateViewportScene({ version: '1.0.0', rooms: [] })).toBeNull();
    const room = createMockRoom(); room.objects.push({ ...room.objects[0] });
    expect(validateViewportScene(createMockScenePlan({ rooms: [room] }))).toBeNull();
  });
});
