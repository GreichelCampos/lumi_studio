import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createMockRoom, createMockSpatialObject } from '../../fixtures/testFixtures';

vi.mock('three', async importOriginal => {
  const actual = await importOriginal<typeof import('three')>();
  return { ...actual, WebGLRenderer: class {
    domElement = document.createElement('canvas'); shadowMap = {};
    dispose = vi.fn(); render = vi.fn(); setSize = vi.fn(); setPixelRatio = vi.fn(); setClearColor = vi.fn();
  } };
});
import { ThreeSceneManager } from '../../../components/viewport/ThreeSceneManager';
import { FurnitureFactory } from '../../../components/viewport/factories/FurnitureFactory';
import { RoomFactory } from '../../../components/viewport/factories/RoomFactory';

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); disconnect = vi.fn(); });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('progressive CPU construction/selection and room-owned resources (mock WebGL)', () => {
  it.each([10, 100, 1000])('measures %i objects independently', count => {
    const manager = new ThreeSceneManager({ container: document.createElement('div'), onSelectEntity: vi.fn() });
    const room = createMockRoom({ doors: [], windows: [], objects: Array.from({ length: count }, (_, i) =>
      createMockSpatialObject({ id: `bench-${i}`, position: [(i % 32) * 2, 0, Math.floor(i / 32) * 2] })) });
    const observed = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
    const created = { geometries: 0, materials: 0, textures: 0 };
    const freed = { geometries: 0, materials: 0, textures: 0 };
    const observe = () => {
      const track = (resource: THREE.BufferGeometry | THREE.Material | THREE.Texture, kind: keyof typeof created) => {
        if (observed.has(resource)) return;
        observed.add(resource); created[kind]++;
        resource.addEventListener('dispose', () => { freed[kind]++; });
      };
      manager['roomGroup'].traverse(child => {
        if (!(child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Sprite)) return;
        if ('geometry' in child) track(child.geometry, 'geometries');
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
          track(material, 'materials');
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) track(value, 'textures');
        }
      });
    };
    const start = performance.now(); manager.renderRoom(room, null);
    const constructionMs = performance.now() - start;
    observe(); const initialResources = { ...created };
    let root = manager['roomGroup'].children[0]; let rebuilds = 1;
    const selectionTimes: number[] = [];
    for (const selected of [room.objects[0].id, room.objects[1].id, null]) {
      const tick = performance.now(); manager.renderRoom(room, selected); selectionTimes.push(performance.now() - tick);
      if (root !== manager['roomGroup'].children[0]) rebuilds++;
      root = manager['roomGroup'].children[0]; observe();
    }
    expect(manager['scene'].getObjectByName(`bench-${count - 1}`)).toBeDefined();
    const selectionCreated = Object.fromEntries(Object.keys(created).map(key => [key, created[key as keyof typeof created] - initialResources[key as keyof typeof created]]));
    const selectionFreed = { ...freed };
    expect(rebuilds).toBe(1);
    expect(selectionCreated).toEqual({ geometries: 0, materials: 0, textures: 0 });
    expect(selectionFreed).toEqual({ geometries: 0, materials: 0, textures: 0 });
    manager.clearRoom(); manager.dispose();
    expect(freed).toEqual(created);
    console.log(JSON.stringify({ count, constructionMs, selectionTimes, rebuilds, initialResources, selectionCreated, selectionFreed, finalFreed: freed }));
  }, 30000);
});

describe('incremental ownership and invalidation', () => {
  it('updates in-place error/warning/debug state with identical geometry and picking', () => {
    const manager = new ThreeSceneManager({ container: document.createElement('div'), onSelectEntity: vi.fn() });
    const room = createMockRoom(); manager.renderRoom(room, null);
    const root = manager['roomGroup'].children[0];
    const objects = [...manager['selectionController']['pickableMeshes'].keys()];
    for (const flags of [{ hasError: true, hasWarning: false }, { hasError: false, hasWarning: true }, { hasError: false, hasWarning: false }]) {
      Object.assign(room.objects[0], flags);
      manager.renderRoom(room, room.objects[0].id, room.objects[0].id);
      expect(manager['roomGroup'].children[0]).toBe(root);
      expect([...manager['selectionController']['pickableMeshes'].keys()]).toEqual(objects);
    }
    manager.renderRoom(room, null, null);
    expect(manager['roomGroup'].children[0]).toBe(root); manager.dispose();
  });
  it('reuses cloned render-equivalent plans and metadata, detects in-place geometry/appearance changes', () => {
    const manager = new ThreeSceneManager({ container: document.createElement('div'), onSelectEntity: vi.fn() });
    const room = createMockRoom(); manager.renderRoom(room, null);
    const original = manager['roomGroup'].children[0];
    const geometry = (original.getObjectByName('floor') as THREE.Mesh).geometry;
    const dispose = vi.spyOn(geometry, 'dispose');
    const clone = structuredClone(room); clone.name = 'Metadata only'; clone.objects[0].sourceRef = { file: 'other.lumi', line: 50 };
    manager.renderRoom(clone, clone.objects[0].id, clone.objects[0].id);
    expect(manager['roomGroup'].children[0]).toBe(original); expect(dispose).not.toHaveBeenCalled();
    const camera = manager['cameraController'].getCamera();
    const previousPosition = camera.position.clone();
    clone.objects[0].position![0] = 100;
    manager.renderRoom(clone, null);
    expect(manager['roomGroup'].children[0]).not.toBe(original); expect(dispose).toHaveBeenCalledOnce();
    expect(camera.position.distanceTo(previousPosition)).toBeGreaterThan(1);
    const moved = manager['roomGroup'].children[0]; clone.objects[0].color = '#123456';
    manager.renderRoom(clone, null); expect(manager['roomGroup'].children[0]).not.toBe(moved);
    manager.dispose();
  });

  it('rebuilds for a room change and render controls, releases every owned resource exactly once', () => {
    const manager = new ThreeSceneManager({ container: document.createElement('div'), onSelectEntity: vi.fn() });
    const room = createMockRoom(); manager.renderRoom(room, null);
    const root = manager['roomGroup'].children[0];
    const geometries = new Set<THREE.BufferGeometry>();
    root.traverse(child => { if (child instanceof THREE.Mesh || child instanceof THREE.Line) geometries.add(child.geometry); });
    const spies = [...geometries].map(geometry => vi.spyOn(geometry, 'dispose'));
    const next = { ...room, id: 'another-room' }; manager.renderRoom(next, null);
    spies.forEach(spy => expect(spy).toHaveBeenCalledOnce());
    const nextRoot = manager['roomGroup'].children[0]; manager.toggleWireframe(true); manager.renderRoom(next, null);
    expect(manager['roomGroup'].children[0]).not.toBe(nextRoot);
    const wireRoot = manager['roomGroup'].children[0]; manager.toggleDimensions(false); manager.renderRoom(next, null);
    expect(manager['roomGroup'].children[0]).not.toBe(wireRoot);
    manager.clearRoom(); expect(manager['visualUpdates'].size).toBe(0); expect(manager['contentKey']).toBeNull();
    manager.renderRoom(room, null); manager.dispose(); manager.dispose();
    expect(manager['visualUpdates'].size).toBe(0);
    spies.forEach(spy => expect(spy).toHaveBeenCalledOnce());
  });

  it('keeps the last valid scene on validation/build failure and can recover', () => {
    const manager = new ThreeSceneManager({ container: document.createElement('div'), onSelectEntity: vi.fn() });
    const room = createMockRoom(); manager.renderRoom(room, null);
    const root = manager['roomGroup'].children[0];
    const currentPickables = [...manager['selectionController']['pickableMeshes'].keys()];
    expect(() => manager.renderRoom({ ...room, dimensions: [NaN, 4, 3] }, null)).toThrow();
    expect(manager['roomGroup'].children[0]).toBe(root);
    const failure = vi.spyOn(FurnitureFactory, 'createFurnitureMesh').mockImplementationOnce(() => { throw new Error('Construction failure'); });
    const createRoom = RoomFactory.createRoomStructure;
    const partialResources: Array<ReturnType<typeof vi.spyOn>> = [];
    const construction = vi.spyOn(RoomFactory, 'createRoomStructure').mockImplementation((...args) => {
      const result = createRoom(...args);
      const resources = new Set<THREE.BufferGeometry | THREE.Material>();
      result.group.traverse(child => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          resources.add(child.geometry);
          for (const mat of Array.isArray(child.material) ? child.material : [child.material]) resources.add(mat);
        }
      });
      partialResources.push(...[...resources].map(resource => vi.spyOn(resource, 'dispose')));
      return result;
    });
    const changed = { ...room, dimensions: [6, 4, 3] as [number, number, number] };
    expect(() => manager.renderRoom(changed, null)).toThrow('Construction failure'); failure.mockRestore();
    construction.mockRestore();
    partialResources.forEach(spy => expect(spy).toHaveBeenCalledOnce());
    expect(manager['roomGroup'].children[0]).toBe(root);
    expect([...manager['selectionController']['pickableMeshes'].keys()]).toEqual(currentPickables);
    manager.renderRoom(room, room.objects[0].id); expect(manager['roomGroup'].children[0]).toBe(root);
    manager.renderRoom(changed, null); expect(manager['roomGroup'].children[0]).not.toBe(root);
    manager.dispose();
  });
});
