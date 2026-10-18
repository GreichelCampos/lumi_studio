import { describe, expect, it, vi } from 'vitest';
import { DesktopProjectStorage } from '../../../services/storage/DesktopProjectStorage';
import type { WorkspaceBridge, WorkspaceReply } from '../../../services/storage/workspaceBridge';
import { createMockProject } from '../../fixtures/testFixtures';

function setup() {
  const success = <T,>(value: T): WorkspaceReply<T> => ({ ok: true, value });
  const project = createMockProject();
  const disk = { ...project, files: project.files.map(file => ({ ...file, path: 'nested/principal.lumi' })) };
  const bridge: WorkspaceBridge = {
    list: vi.fn(async () => success([disk])),
    open: vi.fn(async () => success(disk)),
    chooseLocation: vi.fn(async () => success('location')),
    create: vi.fn(async () => success(disk)),
    save: vi.fn(async () => success(undefined)),
    rename: vi.fn(async () => success({ ...disk, name: 'Renamed' })),
    saveAs: vi.fn(async () => success(disk)),
    remove: vi.fn(async () => success(true)),
    lastActive: vi.fn(async () => success(project.id)),
    importProject: vi.fn(async () => success(disk)),
  };
  return { bridge, storage: new DesktopProjectStorage(bridge), project };
}

describe('DesktopProjectStorage adapter', () => {
  it('keeps IDE project paths compatible while sending exact relative paths to disk', async () => {
    const { storage, bridge, project } = setup();
    const loaded = (await storage.getProjects())[0];
    expect(loaded.files[0].path).toBe(`${project.name}/nested/principal.lumi`);
    await storage.saveProject(loaded);
    expect(bridge.save).toHaveBeenCalledWith(expect.objectContaining({ files: [expect.objectContaining({ path: 'nested/principal.lumi' })] }));
    const renamed = await storage.renameProject(project.id, 'Renamed');
    expect(renamed.files[0].path).toBe('Renamed/nested/principal.lumi');
  });
  it('reports storage errors and cancellation without falling back to localStorage', async () => {
    const { storage, bridge, project } = setup();
    vi.mocked(bridge.save).mockResolvedValue({ ok: false, message: 'Permission denied' });
    await expect(storage.saveProject(project)).rejects.toThrow('Permission denied');
    vi.mocked(bridge.remove).mockResolvedValue({ ok: true, value: false });
    await expect(storage.deleteProject(project.id)).rejects.toThrow('cancelada');
    vi.mocked(bridge.open).mockResolvedValue({ ok: true, value: null });
    expect(await storage.openProject()).toBeNull();
  });
  it('rejects unsafe project paths before invoking IPC', () => {
    const { storage, bridge, project } = setup();
    project.files[0].path = '../escape.lumi';
    expect(() => storage.saveProject(project)).toThrow();
    expect(bridge.save).not.toHaveBeenCalled();
  });
  it('does not use browser persistence when the Electron workspace bridge is missing', async () => {
    const storage = new DesktopProjectStorage();
    await expect(storage.getProjects()).rejects.toThrow('Electron');
  });
});
