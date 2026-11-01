import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { openingVerticalBounds, wallSegments } from '../../../components/viewport/helpers/openingLayout';
import { RoomFactory } from '../../../components/viewport/factories/RoomFactory';
import { OpeningFactory } from '../../../components/viewport/factories/OpeningFactory';
import { ThreeResourceDisposer } from '../../../components/viewport/resources/ThreeResourceDisposer';
import { LumicFileService } from '../../../services/storage/LumicFileService';
import { FIXTURE_LUMIC_ARTIFACT } from '../../../data/contracts';
import { createMockDoor, createMockRoom, createMockWindow } from '../../fixtures/testFixtures';
import type { DoorModel } from '../../../types';

beforeEach(() => vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null));
afterEach(() => vi.restoreAllMocks());

const walls = ['norte', 'sur', 'este', 'oeste'] as const;
const options = { isWireframe: false, showDimensions: false, showReferenceAxes: false };

function wallHit(group: THREE.Group, wall: DoorModel['wall'], center: THREE.Vector3, y: number): boolean {
  const direction = wall === 'norte' || wall === 'sur'
    ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  const ray = new THREE.Raycaster(center.clone().setY(y).addScaledVector(direction, -0.5), direction, 0, 1);
  group.updateMatrixWorld(true);
  return ray.intersectObjects(group.children.filter(child => child.name === `wall-${wall}`)).length > 0;
}

describe('shared legacy opening vertical layout', () => {
  it.each([0.01, 2.1, 6])('keeps door bounds grounded without clipping height %s', height => {
    expect(openingVerticalBounds({ height }, 'door')).toEqual({ centerY: height / 2, bottom: 0, top: height });
  });

  it.each(walls.flatMap(wall => [0.4, 1.4, 2.4].map(height => ({ wall, height }))))(
    'matches the window geometry and actual wall cut on $wall with height $height', ({ wall, height }) => {
      const win = createMockWindow({ wall, height, width: 1.2, position: -0.6 });
      const room = createMockRoom({ dimensions: [8, 6, 4], doors: [], windows: [win] });
      const before = structuredClone(room);
      const expectedBottom = 1.6 - height / 2;
      const expectedTop = 1.6 + height / 2;
      const windowMesh = OpeningFactory.createWindowMesh(win, room, false);
      const { group } = RoomFactory.createRoomStructure(room, options);
      try {
        expect(openingVerticalBounds(win, 'window')).toEqual({ centerY: 1.6, bottom: expectedBottom, top: expectedTop });
        expect(windowMesh.position.y).toBe(1.6);
        const bounds = new THREE.Box3().setFromObject(windowMesh);
        expect(bounds.min.y).toBeCloseTo(expectedBottom, 6);
        expect(bounds.max.y).toBeCloseTo(expectedTop, 6);
        const size = bounds.getSize(new THREE.Vector3());
        expect(size.y).toBeCloseTo(height, 6);
        expect(wall === 'norte' || wall === 'sur' ? size.x : size.z).toBeCloseTo(win.width, 6);
        const center = windowMesh.position.clone();
        // Independent rays on both sides of each edge detect drift between mesh and hole.
        expect(wallHit(group, wall, center, expectedBottom + 0.001)).toBe(false);
        expect(wallHit(group, wall, center, expectedTop - 0.001)).toBe(false);
        expect(wallHit(group, wall, center, expectedBottom - 0.001)).toBe(true);
        expect(wallHit(group, wall, center, expectedTop + 0.001)).toBe(true);
        expect(wall === 'norte' || wall === 'sur' ? center.x : center.z).toBe(win.position);
        expect(room).toEqual(before);
      } finally {
        ThreeResourceDisposer.disposeHierarchy(windowMesh);
        ThreeResourceDisposer.disposeHierarchy(group);
      }
    },
  );

  it.each(walls)('preserves door placement and its wall cut on %s', wall => {
    const door = createMockDoor({ wall, height: 2.1, position: 0.6 });
    const room = createMockRoom({ dimensions: [8, 6, 4], doors: [door], windows: [] });
    const before = structuredClone(room);
    const doorMesh = OpeningFactory.createDoorMesh(door, room, false);
    const { group } = RoomFactory.createRoomStructure(room, options);
    try {
      expect(doorMesh.position.y).toBe(1.05);
      expect(wall === 'norte' || wall === 'sur' ? doorMesh.position.x : doorMesh.position.z).toBe(0.6);
      expect(wallHit(group, wall, doorMesh.position, 0.001)).toBe(false);
      expect(wallHit(group, wall, doorMesh.position, 2.099)).toBe(false);
      expect(wallHit(group, wall, doorMesh.position, 2.101)).toBe(true);
      expect(room).toEqual(before);
    } finally {
      ThreeResourceDisposer.disposeHierarchy(doorMesh);
      ThreeResourceDisposer.disposeHierarchy(group);
    }
  });

  it('clips wall cuts while leaving a tall legacy window and its source data unchanged', () => {
    const win = createMockWindow({ wall: 'norte', height: 4, width: 1, position: 0 });
    const room = createMockRoom({ dimensions: [8, 6, 2], windows: [win], doors: [] });
    const before = structuredClone(room);
    expect(openingVerticalBounds(win, 'window')).toEqual({ centerY: 1.6, bottom: -0.3999999999999999, top: 3.6 });
    const segments = wallSegments(room, 'norte');
    expect(segments.reduce((sum, part) => sum + (part.right - part.left) * (part.top - part.bottom), 0)).toBe(14);
    expect(segments.every(part => part.bottom >= 0 && part.top <= 2)).toBe(true);
    const mesh = OpeningFactory.createWindowMesh(win, room, false);
    try {
      const bounds = new THREE.Box3().setFromObject(mesh);
      expect(bounds.min.y).toBeCloseTo(-0.4);
      expect(bounds.max.y).toBeCloseTo(3.6);
      expect(room).toEqual(before);
    } finally {
      ThreeResourceDisposer.disposeHierarchy(mesh);
    }
  });

  it.each(['1.0.0', '1.1.0'])('imports historic lumic %s without migrating openings', schemaVersion => {
    const artifact = structuredClone(FIXTURE_LUMIC_ARTIFACT);
    artifact.schemaVersion = schemaVersion;
    artifact.scenePlan.rooms[0].windows = [{ id: 'legacy-window', wall: 'oeste', position: -0.5, width: 1, height: 0.6 }];
    artifact.scenePlan.rooms[0].doors = [{ id: 'legacy-door', wall: 'sur', position: 0.5, width: 0.9, height: 2.1 }];
    const imported = LumicFileService.parseAndValidateContent(JSON.stringify(artifact));
    expect(imported.success).toBe(true);
    expect(imported.artifact).toEqual(artifact);
    const room = imported.artifact!.scenePlan.rooms[0];
    const windowMesh = OpeningFactory.createWindowMesh(room.windows[0], room, false);
    const doorMesh = OpeningFactory.createDoorMesh(room.doors[0], room, false);
    try {
      expect(windowMesh.position.y).toBe(1.6);
      expect(doorMesh.position.y).toBe(1.05);
      expect(new THREE.Box3().setFromObject(windowMesh).min.y).toBeCloseTo(1.3);
      expect(imported.artifact).toEqual(artifact);
      expect(imported.artifact!.schemaVersion).toBe(schemaVersion);
    } finally {
      ThreeResourceDisposer.disposeHierarchy(windowMesh);
      ThreeResourceDisposer.disposeHierarchy(doorMesh);
    }
  });
});

describe('explicit elevation, independent of historical window layout', () => {
  it.each(walls.flatMap(wall => [0, 0.75, 2].map(elevation => ({ wall, elevation }))))
    ('aligns mesh and wall cut on $wall at elevation $elevation', ({ wall, elevation }) => {
      const win = createMockWindow({ wall, elevation, height: 1, width: 1.2, position: -0.6 });
      const room = createMockRoom({ dimensions: [8, 6, 3], doors: [], windows: [win] });
      const before = structuredClone(room);
      const mesh = OpeningFactory.createWindowMesh(win, room, false);
      const { group } = RoomFactory.createRoomStructure(room, options);
      try {
        expect(mesh.position.y).toBe(elevation + 0.5);
        const bounds = new THREE.Box3().setFromObject(mesh);
        expect(bounds.min.y).toBeCloseTo(elevation, 6);
        expect(bounds.max.y).toBeCloseTo(elevation + 1, 6);
        expect(wallHit(group, wall, mesh.position, elevation + 0.001)).toBe(false);
        expect(wallHit(group, wall, mesh.position, elevation + 0.999)).toBe(false);
        if (elevation > 0) expect(wallHit(group, wall, mesh.position, elevation - 0.001)).toBe(true);
        if (elevation + 1 < 3) expect(wallHit(group, wall, mesh.position, elevation + 1.001)).toBe(true);
        expect(room).toEqual(before);
      } finally { ThreeResourceDisposer.disposeHierarchy(mesh); ThreeResourceDisposer.disposeHierarchy(group); }
    });

  it('clips only the wall cut when an explicitly elevated window exceeds room height', () => {
    const win = createMockWindow({ elevation: 2.5, height: 1, width: 1, wall: 'norte', position: 0 });
    const room = createMockRoom({ dimensions: [8, 6, 3], doors: [], windows: [win] });
    const before = structuredClone(room);
    const mesh = OpeningFactory.createWindowMesh(win, room, false);
    try {
      expect(new THREE.Box3().setFromObject(mesh).max.y).toBeCloseTo(3.5);
      expect(wallSegments(room, 'norte').reduce((sum, part) => sum + (part.right - part.left) * (part.top - part.bottom), 0)).toBeCloseTo(24 - 0.5);
      expect(room).toEqual(before);
    } finally { ThreeResourceDisposer.disposeHierarchy(mesh); }
  });

  it('applies appearance only to opaque components and preserves dimensions and glass optics', () => {
    const room = createMockRoom();
    const door = createMockDoor(); const win = createMockWindow({ elevation: 0.7 });
    const groups = [OpeningFactory.createDoorMesh(door, room, false), OpeningFactory.createWindowMesh(win, room, false),
      OpeningFactory.createDoorMesh({ ...door, color: '#123456', material: 'acero' }, room, false),
      OpeningFactory.createWindowMesh({ ...win, color: '#123456', material: 'acero' }, room, false)];
    try {
      const firstMaterial = (group: THREE.Group) => (group.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>).material;
      expect(firstMaterial(groups[0]).roughness).toBe(0.5);
      expect(firstMaterial(groups[1]).roughness).toBe(0.3);
      for (const group of groups.slice(2)) {
        expect(firstMaterial(group).color.getHexString()).toBe('123456');
        expect(firstMaterial(group).metalness).toBe(0.8);
      }
      for (let index = 0; index < 2; index++) {
        const base = new THREE.Box3().setFromObject(groups[index]);
        const styled = new THREE.Box3().setFromObject(groups[index + 2]);
        expect(base.equals(styled)).toBe(true);
      }
      const glass = groups.filter((_, index) => index % 2 === 1).map(group =>
        (group.children.find(child => child instanceof THREE.Mesh && child.material instanceof THREE.MeshPhysicalMaterial) as THREE.Mesh<THREE.BoxGeometry, THREE.MeshPhysicalMaterial>).material);
      expect(glass[0].color.equals(glass[1].color)).toBe(true);
      for (const material of glass) {
        expect(material.transmission).toBe(0.85); expect(material.opacity).toBe(0.55);
        expect(material.ior).toBe(1.5); expect(material.roughness).toBe(0.1);
      }
    } finally { groups.forEach(group => ThreeResourceDisposer.disposeHierarchy(group)); }
  });
});
