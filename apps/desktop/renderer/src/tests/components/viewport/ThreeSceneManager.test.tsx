import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createMockRoom, createMockScenePlan } from '../../fixtures/testFixtures';

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
