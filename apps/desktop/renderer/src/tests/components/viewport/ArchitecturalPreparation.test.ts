import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { openingPlacement, wallSegments, WALL_THICKNESS, WINDOW_CENTER_HEIGHT } from '../../../components/viewport/helpers/openingLayout';
import { RoomFactory } from '../../../components/viewport/factories/RoomFactory';
import { OpeningFactory } from '../../../components/viewport/factories/OpeningFactory';
import { ThreeResourceDisposer } from '../../../components/viewport/resources/ThreeResourceDisposer';
import { validateViewportScene } from '../../../components/viewport/helpers/validateViewportScene';
import { parseAndValidateLumicArtifact, serializeLumicArtifact } from '../../../services/compiler/contracts/contractValidator';
import { FIXTURE_LUMIC_ARTIFACT } from '../../../data/contracts';
import { createMockDoor, createMockWindow, createMockRoom } from '../../fixtures/testFixtures';

// Characterization of the CURRENT DTO. No candidate elevation/identity fields are consumed.
beforeEach(() => vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null));
afterEach(() => vi.restoreAllMocks());
const area = (room: ReturnType<typeof createMockRoom>, wall: 'norte' | 'sur' | 'este' | 'oeste') =>
  wallSegments(room, wall).reduce((sum, segment) => sum + (segment.right - segment.left) * (segment.top - segment.bottom), 0);

describe('architectural integration preparation: supported behavior only', () => {
  it.each([
    { wall: 'norte' as const, expected: [-0.75, 1, -2 - WALL_THICKNESS / 2], rotation: 0 },
    { wall: 'sur' as const, expected: [-0.75, 1, 2 + WALL_THICKNESS / 2], rotation: 0 },
    { wall: 'este' as const, expected: [4 + WALL_THICKNESS / 2, 1, -0.75], rotation: Math.PI / 2 },
    { wall: 'oeste' as const, expected: [-4 - WALL_THICKNESS / 2, 1, -0.75], rotation: Math.PI / 2 },
  ])('uses centered signed global-axis offsets on a non-square room: $wall', ({ wall, expected, rotation }) => {
    const room = createMockRoom({ dimensions: [8, 4, 3], doors: [], windows: [] });
    const door = createMockDoor({ wall, position: -0.75, height: 2 });
    const before = structuredClone({ room, door });
    const mesh = OpeningFactory.createDoorMesh(door, room, false);
    expect(openingPlacement(door, room, 1)).toEqual({ position: expected, rotationY: rotation });
    expect(mesh.position.toArray()).toEqual(expected);
    expect(mesh.rotation.y).toBe(rotation);
    expect({ room, door }).toEqual(before);
    ThreeResourceDisposer.disposeHierarchy(mesh);
  });

  it.each([0.6, 1.4])('preserves legacy window center; inferred bottom changes with height %s', height => {
    const room = createMockRoom({ doors: [], windows: [] });
    const win = createMockWindow({ height });
    const mesh = OpeningFactory.createWindowMesh(win, room, false);
    expect(mesh.position.y).toBe(WINDOW_CENTER_HEIGHT);
    const bounds = new THREE.Box3().setFromObject(mesh);
    expect(bounds.min.y).toBeCloseTo(1.6 - height / 2);
    expect(bounds.max.y).toBeCloseTo(1.6 + height / 2);
    ThreeResourceDisposer.disposeHierarchy(mesh);
  });

  it('clips only the wall cut of an out-of-bounds opening, not its DTO or mesh', () => {
    const room = createMockRoom({ dimensions: [8, 4, 3], windows: [],
      doors: [createMockDoor({ wall: 'norte', position: 3.75, width: 1, height: 2 })] });
    const before = structuredClone(room);
    // Horizontal cut intersects [-4,4] in [3.25,4]: 0.75 x 2.
    expect(area(room, 'norte')).toBeCloseTo(24 - 1.5);
    expect(validateViewportScene({ version: '1.0.0', rooms: [room] })).toBeNull();
    const mesh = OpeningFactory.createDoorMesh(room.doors[0], room, false);
    expect(mesh.position.x).toBe(3.75);
    expect(new THREE.Box3().setFromObject(mesh).max.x).toBeGreaterThan(4);
    expect(room).toEqual(before);
    ThreeResourceDisposer.disposeHierarchy(mesh);
  });

  it('subtracts overlapping door cuts as a union without claiming semantic validation', () => {
    const room = createMockRoom({ dimensions: [8, 4, 3], windows: [], doors: [
      createMockDoor({ id: 'left', wall: 'norte', position: -0.5, width: 2, height: 2 }),
      createMockDoor({ id: 'right', wall: 'norte', position: 0.5, width: 2, height: 2 }),
    ] });
    const before = structuredClone(room);
    expect(area(room, 'norte')).toBeCloseTo(24 - 6);
    expect(validateViewportScene({ version: '1.0.0', rooms: [room] })).toBeNull();
    expect(room).toEqual(before);
  });

  it('keeps four automatic wall faces and applies per-face styles without changing dimensions', () => {
    const room = createMockRoom({ dimensions: [8, 4, 3], doors: [], windows: [],
      walls: { north: { color: '#112233', material: 'acero' }, south: { color: '#223344' }, east: { color: '#334455' }, west: { color: '#445566' } } });
    const before = structuredClone(room);
    const { group, wallRecords } = RoomFactory.createRoomStructure(room, { isWireframe: false, showDimensions: false, showReferenceAxes: false });
    expect(wallRecords.map(record => record.wall).sort()).toEqual(['este', 'norte', 'oeste', 'sur']);
    const north = group.getObjectByName('wall-norte') as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
    expect(north.geometry.parameters).toMatchObject({ width: 8, height: 3, depth: WALL_THICKNESS });
    expect(north.material.color.getHexString()).toBe('112233');
    expect(north.material.metalness).toBe(0.8);
    expect(room).toEqual(before);
    ThreeResourceDisposer.disposeHierarchy(group);
  });

  it.each(['1.0.0', '1.1.0'])('roundtrips existing doors, windows and wall styles in lumic %s', schemaVersion => {
    const artifact = structuredClone(FIXTURE_LUMIC_ARTIFACT);
    artifact.schemaVersion = schemaVersion;
    const room = artifact.scenePlan.rooms[0];
    room.doors = [{ id: 'door-preparation', wall: 'oeste', position: -0.5, width: 0.9, height: 2 }];
    room.windows = [{ id: 'window-preparation', wall: 'este', position: 0.5, width: 1, height: 0.8 }];
    room.walls.north = { color: '#112233', material: 'acero' };
    const result = parseAndValidateLumicArtifact(serializeLumicArtifact(artifact));
    expect(result.errors).toEqual([]);
    expect(result.data).toEqual(artifact);
    expect(artifact.schemaVersion).toBe(schemaVersion);
  });
});
