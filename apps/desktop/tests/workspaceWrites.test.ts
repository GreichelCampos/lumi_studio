import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WorkspaceService } from '../electron/workspaces/WorkspaceService';
import { WorkspaceMetadata } from '../electron/workspaces/workspaceMetadata';

vi.mock('node:fs/promises', async original => ({ ...await original<typeof import('node:fs/promises')>() }));

let root: string;
let service: WorkspaceService;
beforeEach(async () => {
  root = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'lumi-write-service-')));
  service = new WorkspaceService(join(root, 'profile'), {
    chooseFolder: async () => root, chooseSavePath: async () => null,
    confirmDelete: async () => false, trash: async () => undefined,
  });
  await service.chooseLocation();
});
afterEach(async () => { vi.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true }); });

describe('workspace write recovery', () => {
  it('retains a newly created source when a later creation fails', async () => {
    const project = await service.create({ name: 'Project', location: root });
    const updated = { ...project, files: [...project.files, ...['second', 'third'].map(id => ({
      id, name: `${id}.lumi`, path: `${id}.lumi`, content: id, isEntry: false,
    }))] };
    const writeFile = fs.writeFile;
    const failing = vi.spyOn(fs, 'writeFile').mockImplementation(async (...args) => {
      if (String(args[0]).endsWith('third.lumi')) throw Object.assign(new Error('Disk failure'), { code: 'EIO' });
      return writeFile(...args);
    });
    await expect(service.save(updated)).rejects.toMatchObject({ code: 'EIO' });
    expect(await fs.readFile(join(root, 'Project/second.lumi'), 'utf8')).toBe('second');
    failing.mockRestore();
    await service.save(updated);
    expect(await fs.readFile(join(root, 'Project/third.lumi'), 'utf8')).toBe('third');
  });
  it('retries a partially completed multi-file save without treating its own write as external', async () => {
    const initial = await service.create({ name: 'Project', location: root });
    const project = { ...initial, files: [...initial.files, {
      id: 'second', name: 'second.lumi', path: 'second.lumi', content: 'old second', isEntry: false,
    }] };
    await service.save(project);
    const updated = { ...project, files: project.files.map(file => ({ ...file, content: `new ${file.id}` })) };
    const originalRename = fs.rename;
    const rename = vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
      if (String(to).endsWith('second.lumi')) throw Object.assign(new Error('Disk failure'), { code: 'EIO' });
      await originalRename(from, to);
    });
    await expect(service.save(updated)).rejects.toMatchObject({ code: 'EIO' });
    expect(await fs.readFile(join(root, 'Project/principal.lumi'), 'utf8')).toBe(updated.files[0].content);
    expect(await fs.readFile(join(root, 'Project/second.lumi'), 'utf8')).toBe('old second');
    rename.mockRestore();
    await service.save(updated);
    expect(await fs.readFile(join(root, 'Project/second.lumi'), 'utf8')).toBe(updated.files[1].content);
    expect((await fs.readdir(join(root, 'Project'))).filter(name => name.endsWith('.tmp'))).toEqual([]);
  });
  it('retains source progress when metadata persistence fails and permits a later retry', async () => {
    const project = await service.create({ name: 'Project', location: root });
    const metadataPath = join(root, 'profile/workspaces.json');
    const previous = await fs.readFile(metadataPath, 'utf8');
    const originalRename = fs.rename;
    const rename = vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
      if (String(to).endsWith('workspaces.json')) throw Object.assign(new Error('Disk failure'), { code: 'EIO' });
      await originalRename(from, to);
    });
    const updated = { ...project, description: 'changed', files: project.files.map(file => ({ ...file, content: 'new source' })) };
    await expect(service.save(updated)).rejects.toMatchObject({ code: 'EIO' });
    expect(await fs.readFile(metadataPath, 'utf8')).toBe(previous);
    expect(await fs.readFile(join(root, 'Project/principal.lumi'), 'utf8')).toBe('new source');
    rename.mockRestore();
    await service.save(updated);
    expect(JSON.parse(await fs.readFile(metadataPath, 'utf8')).projects[0].description).toBe('changed');
  });
  it('serializes two saves and persists the last completed snapshot', async () => {
    const project = await service.create({ name: 'Project', location: root });
    const update = (content: string) => ({ ...project, files: project.files.map(file => ({ ...file, content })) });
    await Promise.all([
      service.serial(() => service.save(update('first'))),
      service.serial(() => service.save(update('second'))),
    ]);
    expect(await fs.readFile(join(root, 'Project/principal.lumi'), 'utf8')).toBe('second');
  });
  it('refuses to replace metadata edited by another process after load', async () => {
    const metadata = new WorkspaceMetadata(join(root, 'profile'));
    await metadata.load();
    await metadata.persist();
    const path = join(root, 'profile/workspaces.json');
    const external = JSON.stringify({ version: 1, projects: [], lastActive: 'external' });
    await fs.writeFile(path, external);
    await expect(metadata.persist()).rejects.toThrow('metadatos cambiaron');
    expect(await fs.readFile(path, 'utf8')).toBe(external);
  });
});
