import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WorkspaceService, type WorkspaceDialogs } from '../electron/workspaces/WorkspaceService';
import { sourcePath } from '../electron/workspaces/safeFiles';
import type { LumiProject } from '../renderer/src/types/domain/project';

describe('real workspace persistence', () => {
  it('refuses project storage inside the installation tree before writing sources', async () => {
    const installation = join(root, 'installed');
    const nested = join(installation, 'nested');
    await fs.mkdir(nested, { recursive: true });
    const guarded = new WorkspaceService(join(root, 'metadata'), dialogs, [], [installation]);
    chosen = nested;
    await expect(guarded.chooseLocation()).rejects.toThrow('fuera de la carpeta de instalación');
    await expect(guarded.open()).rejects.toThrow('fuera de la carpeta de instalación');
    expect(await fs.readdir(nested)).toEqual([]);
    chosen = root;
    await guarded.chooseLocation();
    await expect(guarded.create({ name: 'External', location: root })).resolves.toHaveProperty('name', 'External');
  });
  let root: string;
  let chosen: string | null;
  let savePath: string | null;
  let confirmed: boolean;
  let service: WorkspaceService;
  let dialogs: WorkspaceDialogs;
  beforeEach(async () => {
    root = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'lumi-workspace-')));
    chosen = root; savePath = null; confirmed = true;
    dialogs = {
      chooseFolder: async () => chosen, chooseSavePath: async () => savePath,
      confirmDelete: async () => confirmed,
      trash: async path => { await fs.rename(path, join(root, `trash-${Date.now()}-${Math.random()}`)); },
    };
    service = new WorkspaceService(join(root, 'metadata'), dialogs);
  });
  afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });
  const create = async () => {
    await service.chooseLocation();
    return service.create({ name: 'Casa', location: root });
  };
  const add = (project: LumiProject) => ({ ...project, files: [...project.files, {
    id: 'secondary', name: 'modulo.lumi', path: 'modulo.lumi', content: 'mostrar("módulo")>>', isEntry: false,
  }], activeFileId: 'secondary', openTabIds: [...project.openTabIds!, 'secondary'] });

  it('creates physical sources, saves metadata separately and restores IDs, entry and tabs', async () => {
    const initial = await create();
    let project = add(initial);
    await service.save(project);
    project = { ...project, entryFileId: 'secondary', activeFileId: initial.activeFileId };
    await service.save(project);
    await service.lastActive(project.id);
    const reopened = new WorkspaceService(join(root, 'metadata'), dialogs);
    expect(await reopened.list()).toEqual([expect.objectContaining({
      id: project.id, entryFileId: 'secondary', activeFileId: initial.activeFileId, openTabIds: project.openTabIds,
    })]);
    expect(await reopened.lastActive()).toBe(project.id);
    expect(await fs.readFile(join(root, 'Casa/modulo.lumi'), 'utf8')).toBe('mostrar("módulo")>>');
    expect((await fs.readdir(join(root, 'Casa'))).sort()).toEqual(['modulo.lumi', 'principal.lumi']);
    const metadata = JSON.parse(await fs.readFile(join(root, 'metadata/workspaces.json'), 'utf8'));
    expect(metadata.projects[0].entryPath).toBe('modulo.lumi');
    expect(metadata.projects[0].tabPaths).toEqual(['principal.lumi', 'modulo.lumi']);
  });
  it('opens existing nested files without guessing a main file and preserves source text', async () => {
    await fs.mkdir(join(root, 'Existing/nested'), { recursive: true });
    await fs.writeFile(join(root, 'Existing/nested/a.lumi'), '-- original\r\nmostrar(1)>>');
    chosen = join(root, 'Existing');
    const project = (await service.open())!;
    expect(project.entryFileId).toBeUndefined();
    expect(project.files[0].path).toBe('nested/a.lumi');
    await service.save(project);
    expect(await fs.readFile(join(chosen, 'nested/a.lumi'), 'utf8')).toBe('-- original\r\nmostrar(1)>>');
    const elsewhere = new WorkspaceService(join(root, 'other-metadata'), dialogs);
    expect((await elsewhere.open())!.entryFileId).toBeUndefined();
  });
  it('restores an explicitly empty tab set without opening an unwanted file', async () => {
    const project = await create();
    await service.save({ ...project, activeFileId: '', openTabIds: [] });
    const reopened = new WorkspaceService(join(root, 'metadata'), dialogs);
    expect((await reopened.list())[0]).toMatchObject({ activeFileId: '', openTabIds: [], entryFileId: project.entryFileId });
  });
  it('renames file and project without changing IDs, entry, tabs or other sources', async () => {
    let project = add(await create()); await service.save(project);
    project = { ...project, files: project.files.map(f => f.id === 'secondary' ? { ...f, name: 'nuevo.lumi', path: 'nuevo.lumi' } : f) };
    await service.save(project);
    const renamed = await service.rename(project.id, 'CasaNueva');
    expect(renamed.id).toBe(project.id);
    expect(renamed.openTabIds).toEqual(project.openTabIds);
    expect(renamed.entryFileId).toBe(project.entryFileId);
    expect(await fs.readFile(join(root, 'CasaNueva/nuevo.lumi'), 'utf8')).toBe(project.files[1].content);
    await expect(fs.stat(join(root, 'Casa'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('saves a new copy in the project without overwriting the original', async () => {
    const project = await create();
    savePath = join(root, 'Casa/copia.lumi');
    const copy = (await service.saveAs(project.id, project.activeFileId, 'mostrar(42)>>'))!;
    expect(copy.files).toHaveLength(2);
    expect(copy.entryFileId).toBe(project.entryFileId);
    expect(copy.activeFileId).not.toBe(project.activeFileId);
    expect(await fs.readFile(join(root, 'Casa/copia.lumi'), 'utf8')).toBe('mostrar(42)>>');
    expect(await fs.readFile(join(root, 'Casa/principal.lumi'), 'utf8')).toBe(project.files[0].content);
    await expect(service.saveAs(project.id, project.activeFileId, 'different')).rejects.toThrow('nombre nuevo');
  });
  it('moves deleted files and confirmed projects to trash, supports cancellation', async () => {
    let project = add(await create()); await service.save(project);
    project = { ...project, files: project.files.slice(0, 1), activeFileId: project.entryFileId!, openTabIds: [project.entryFileId!] };
    await service.save(project);
    await expect(fs.stat(join(root, 'Casa/modulo.lumi'))).rejects.toMatchObject({ code: 'ENOENT' });
    confirmed = false; expect(await service.remove(project.id)).toBe(false);
    expect(await fs.stat(join(root, 'Casa'))).toBeDefined();
    confirmed = true; expect(await service.remove(project.id)).toBe(true);
    expect(await service.list()).toEqual([]);
    expect((await fs.readdir(root)).some(name => name.startsWith('trash-'))).toBe(true);
  });
  it.each(['../outside.lumi', '/outside.lumi', 'C:/outside.lumi', 'a/../b.lumi', 'a\\b.lumi', 'a//b.lumi', 'a.txt', 'CON.lumi', 'a:stream.lumi'])('rejects unsafe path %s', path => {
    expect(() => sourcePath(path)).toThrow();
  });
  it('rejects unknown project IDs, ungranted locations, duplicate IDs and invalid references', async () => {
    await expect(service.create({ name: 'Casa', location: root })).rejects.toThrow('diálogo');
    const project = await create();
    await expect(service.save({ ...project, id: 'unknown' })).rejects.toThrow('autorizado');
    await expect(service.save({ ...project, activeFileId: 'missing' })).rejects.toThrow('Referencia');
    await expect(service.save({ ...project, files: [...project.files, project.files[0]] })).rejects.toThrow('duplicados');
  });
  it('rejects save-as outside the selected project without creating an external file', async () => {
    const project = await create(); savePath = join(root, 'outside.lumi');
    await expect(service.saveAs(project.id, project.activeFileId, 'outside')).rejects.toThrow();
    await expect(fs.stat(savePath)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('rejects symlink directory escapes', async () => {
    const project = await create();
    await fs.mkdir(join(root, 'outside'));
    await fs.symlink(join(root, 'outside'), join(root, 'Casa/link'), process.platform === 'win32' ? 'junction' : 'dir');
    savePath = join(root, 'Casa/link/escape.lumi');
    await expect(service.saveAs(project.id, project.activeFileId, 'outside')).rejects.toThrow('enlaces');
    expect(await fs.readdir(join(root, 'outside'))).toEqual([]);
  });
  it('detects external edits instead of overwriting them', async () => {
    const project = await create();
    await fs.writeFile(join(root, 'Casa/principal.lumi'), 'external');
    const changed = { ...project, files: project.files.map(f => ({ ...f, content: 'local' })) };
    await expect(service.save(changed)).rejects.toThrow('cambió en disco');
    expect(await fs.readFile(join(root, 'Casa/principal.lumi'), 'utf8')).toBe('external');
  });
  it('propagates filesystem denial and preserves original source', async () => {
    const project = await create();
    const denied = new WorkspaceService(join(root, 'denied-metadata'), {
      ...dialogs, trash: async () => { throw Object.assign(new Error('Permission denied'), { code: 'EACCES' }); },
    });
    chosen = join(root, 'Casa'); const opened = (await denied.open())!;
    await expect(denied.save({ ...opened, files: [], openTabIds: [], activeFileId: '', entryFileId: undefined })).rejects.toMatchObject({ code: 'EACCES' });
    expect(await fs.readFile(join(root, 'Casa/principal.lumi'), 'utf8')).toBe(project.files[0].content);
  });
  it('does not replace corrupted metadata with demonstration projects', async () => {
    await fs.mkdir(join(root, 'metadata'));
    await fs.writeFile(join(root, 'metadata/workspaces.json'), '{broken');
    await expect(service.list()).rejects.toThrow();
    expect(await fs.readFile(join(root, 'metadata/workspaces.json'), 'utf8')).toBe('{broken');
  });
  it.runIf(process.platform === 'win32')('reports an actual Windows read-only write failure without changing the source', async () => {
    const project = await create();
    const path = join(root, 'Casa/principal.lumi');
    await fs.chmod(path, 0o444);
    try {
      await expect(service.save({ ...project, files: project.files.map(file => ({ ...file, content: 'new' })) })).rejects.toMatchObject({
        code: expect.stringMatching(/EPERM|EACCES/),
      });
      expect(await fs.readFile(path, 'utf8')).toBe(project.files[0].content);
    } finally { await fs.chmod(path, 0o666); }
  });
  it('imports a legacy snapshot as real files with IDs and main references preserved', async () => {
    const original = add(await create());
    original.name = 'Legacy';
    const imported = await service.importProject(original, root);
    expect(imported.id).not.toBe(original.id);
    expect(imported.files.map(file => file.id).sort()).toEqual(original.files.map(file => file.id).sort());
    expect(imported.entryFileId).toBe(original.entryFileId);
    expect(imported.openTabIds).toEqual(original.openTabIds);
    expect(await fs.readFile(join(root, 'Legacy/modulo.lumi'), 'utf8')).toBe(original.files[1].content);
    expect(await fs.stat(join(root, 'Casa'))).toBeDefined();
  });
  it('rejects application ancestors and drive roots as projects', async () => {
    chosen = root;
    await expect(service.open()).rejects.toThrow('aplicación');
  });
});
