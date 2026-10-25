import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createMockRoom, createMockScenePlan, createMockSpatialObject } from '../../fixtures/testFixtures';
import { FurnitureFactory } from '../../../components/viewport/factories/FurnitureFactory';
import type { UnplacedSpatialObject } from '../../../types';

const renderers = vi.hoisted(() => [] as Array<{ domElement: HTMLCanvasElement; dispose: ReturnType<typeof vi.fn>; render: ReturnType<typeof vi.fn>; setSize: ReturnType<typeof vi.fn> }>);
vi.mock('three', async importOriginal => {
  const actual = await importOriginal<typeof import('three')>();
  return { ...actual, WebGLRenderer: class {
    domElement = document.createElement('canvas'); shadowMap = {};
    dispose = vi.fn(); render = vi.fn(); setSize = vi.fn(); setPixelRatio = vi.fn(); setClearColor = vi.fn();
    constructor() { renderers.push(this); }
  } };
});
import { ThreeSceneManager } from '../../../components/viewport/ThreeSceneManager';
import { Viewport3D } from '../../../components/Viewport3D';
import { render, screen, waitFor } from '@testing-library/react';

beforeEach(() => {
  renderers.length = 0;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); disconnect = vi.fn(); });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('ThreeSceneManager lifecycle', () => {
  it.each([false, null, 'legacy metadata'])('keeps positioned historical objects visible when placed=%s', marker => {
    const object = { ...createMockSpatialObject(), placed: marker };
    const room = createMockRoom({ objects: [object] });
    const plan = createMockScenePlan({ rooms: [room] });
    const before = structuredClone(plan);
    const focus = vi.spyOn(ThreeSceneManager.prototype, 'focusObject');
    const view = render(<Viewport3D scenePlan={plan} legacyPlacement activeObjectId={object.id} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin colocar')).not.toBeInTheDocument();
    expect(document.querySelector('#btn-focus-object')).not.toBeDisabled();
    expect(focus).toHaveBeenCalledWith(object.position);
    const manager = new ThreeSceneManager({ container: document.createElement('div'), onSelectEntity: vi.fn() });
    manager.setLegacyPlacement(true);
    manager.renderRoom(room, object.id);
    expect(manager['scene'].getObjectByName(object.id)).toBeDefined();
    expect(plan).toEqual(before);
    manager.dispose();
    view.unmount();
  });
  it.each([false, true])('keeps the room visible without drawing unplaced furniture (mixed=%s)', mixed => {
    const placed = createMockSpatialObject();
    const { position, ...properties } = placed;
    const unplaced: UnplacedSpatialObject = { ...properties, id: 'unplaced', placed: false };
    const room = createMockRoom({ objects: mixed ? [placed, unplaced] : [unplaced] });
    const before = structuredClone(room);
    const manager = new ThreeSceneManager({ container: document.createElement('div'), onSelectEntity: vi.fn() });
    manager.renderRoom(room, unplaced.id, unplaced.id);
    expect(manager['scene'].getObjectByName(`room-${room.id}`)).toBeDefined();
    expect(manager['scene'].getObjectByName('floor')).toBeDefined();
    expect(manager['scene'].getObjectByName(unplaced.id)).toBeUndefined();
    expect(Boolean(manager['scene'].getObjectByName(placed.id))).toBe(mixed);
    expect(FurnitureFactory.createFurnitureMesh(unplaced, true, false).children).toHaveLength(0);
    expect(room).toEqual(before);
    manager.dispose();
  });

  it('shows unplaced properties without focusing the camera, including after placement changes', () => {
    const placed = createMockSpatialObject();
    const { position, ...properties } = placed;
    const unplaced: UnplacedSpatialObject = { ...properties, placed: false };
    const room = createMockRoom({ objects: [unplaced] });
    const plan = createMockScenePlan({ rooms: [room] });
    const focus = vi.spyOn(ThreeSceneManager.prototype, 'focusObject');
    const view = render(<Viewport3D scenePlan={plan} activeObjectId={unplaced.id} />);
    expect(screen.getByText('Sin colocar')).toBeInTheDocument();
    expect(document.querySelector('#btn-focus-object')).toBeDisabled();
    expect(focus).not.toHaveBeenCalled();
    view.rerender(<Viewport3D scenePlan={createMockScenePlan({ rooms: [{ ...room, objects: [placed] }] })} activeObjectId={placed.id} />);
    expect(document.querySelector('#btn-focus-object')).not.toBeDisabled();
    view.unmount();
  });
  it('switches to the debug room even when a step has no active spatial entity', () => {
    const rooms = [createMockRoom({ id: 'first' }), createMockRoom({ id: 'second', objects: [] })];
    const plan = createMockScenePlan({ rooms });
    const draw = vi.spyOn(ThreeSceneManager.prototype, 'renderRoom');
    const view = render(<Viewport3D scenePlan={plan} sceneSource="artifact" debugRoomId="second" />);
    expect(draw).toHaveBeenLastCalledWith(rooms[1], null, null);
    view.rerender(<Viewport3D scenePlan={plan} sceneSource="artifact" debugRoomId="first" />);
    view.rerender(<Viewport3D scenePlan={plan} sceneSource="artifact" debugRoomId="second" />);
    expect(draw).toHaveBeenLastCalledWith(rooms[1], null, null);
    view.rerender(<Viewport3D scenePlan={null} sceneSource="artifact" debugRoomId={null} />);
    expect(screen.queryByText(/Objeto seleccionado/)).not.toBeInTheDocument();
  });
  it('releases partially initialized resources when observing the canvas fails', () => {
    vi.stubGlobal('ResizeObserver', class { observe() { throw new Error('Resize observer unavailable'); } disconnect = vi.fn(); });
    const container = document.createElement('div');
    expect(() => new ThreeSceneManager({ container, onSelectEntity: vi.fn() })).toThrow('Resize observer unavailable');
    expect(renderers[0].dispose).toHaveBeenCalledOnce();
    expect(container.querySelector('canvas')).toBeNull();
  });
  it('replaces room resources, clears empty scenes and disposes the manager once', () => {
    const container = document.createElement('div'); document.body.appendChild(container);
    Object.defineProperties(container, { clientWidth: { value: 800 }, clientHeight: { value: 600 } });
    const manager = new ThreeSceneManager({ container, onSelectEntity: vi.fn() });
    const room = createMockRoom(); manager.renderRoom(room, null);
    const scene = manager['scene'];
    const geometrySpies: Array<ReturnType<typeof vi.spyOn>> = [];
    scene.traverse(child => { if (child instanceof THREE.Mesh || child instanceof THREE.Line) geometrySpies.push(vi.spyOn(child.geometry, 'dispose')); });
    manager.renderRoom(room, room.objects[0].id);
    expect(geometrySpies.some(spy => spy.mock.calls.length > 0)).toBe(true);
    const before = scene.getObjectByName(`room-${room.id}`);
    expect(() => manager.renderRoom({ ...room, dimensions: [NaN, 2, 3] }, null)).toThrow('Escena no válida');
    expect(scene.getObjectByName(`room-${room.id}`)).toBe(before);
    manager.clearRoom(); expect(scene.getObjectByName(`room-${room.id}`)).toBeUndefined();
    manager.renderRoom(room, null);
    manager.dispose(); manager.dispose();
    expect(renderers[0].dispose).toHaveBeenCalledOnce();
    expect(container.querySelector('canvas')).toBeNull();
    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(scene.children).toHaveLength(0);
    manager.handleResize();
    container.remove();
  });
  it('clears the previous room when the viewport receives an empty or invalid scene', async () => {
    const plan = createMockScenePlan();
    const view = render(<Viewport3D scenePlan={plan} />);
    expect(screen.getByText(/ScenePlan simulado/)).toBeInTheDocument();
    await waitFor(() => expect(renderers).toHaveLength(1));
    const clear = vi.spyOn(ThreeSceneManager.prototype, 'clearRoom');
    view.rerender(<Viewport3D scenePlan={{ version: '1.0.0', rooms: [] }} />);
    await waitFor(() => expect(clear).toHaveBeenCalled());
    view.rerender(<Viewport3D scenePlan={{ ...plan, rooms: [null] } as unknown as typeof plan} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Escena no válida');
    view.unmount(); expect(renderers[0].dispose).toHaveBeenCalledOnce();
  });
  it('does not recreate the renderer when selection callbacks change and identifies imported artifacts', () => {
    const plan = createMockScenePlan();
    const view = render(<Viewport3D scenePlan={plan} sceneSource="artifact" onSelectObject={vi.fn()} />);
    expect(screen.getByText(/Archivo .lumic importado/)).toBeInTheDocument();
    view.rerender(<Viewport3D scenePlan={plan} sceneSource="artifact" onSelectObject={vi.fn()} />);
    expect(renderers).toHaveLength(1);
    view.unmount();
  });
});
