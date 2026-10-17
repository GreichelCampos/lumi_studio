import * as fs from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { LumiProject } from '../../renderer/src/types/domain/project';
import { WorkspaceMetadata, type WorkspaceRecord } from './workspaceMetadata';
import { MAX_SOURCE_BYTES, atomicWrite, inside, isMissing, readSources, safeName } from './safeFiles';
import { validateProject } from './projectValidation';

export interface WorkspaceDialogs {
  chooseFolder(): Promise<string | null>;
  chooseSavePath(root: string, name: string): Promise<string | null>;
  confirmDelete(name: string): Promise<boolean>;
  trash(path: string): Promise<void>;
}

export class WorkspaceService {
  private readonly metadata: WorkspaceMetadata;
  private readonly snapshots = new Map<string, LumiProject>();
  private readonly locations = new Set<string>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(directory: string, private readonly dialogs: WorkspaceDialogs, private readonly protectedPaths: string[] = [directory]) {
    this.metadata = new WorkspaceMetadata(directory);
  }

  private checkRoot(root: string): void {
    if (parse(root).root === root || this.protectedPaths.some(path => {
      const child = relative(root.toLowerCase(), resolve(path).toLowerCase());
      return !child || (!child.startsWith(`..${sep}`) && child !== '..' && !isAbsolute(child));
    })) throw new Error('No se puede usar una carpeta del sistema o de la aplicación como proyecto.');
  }

  serial<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async record(id: string): Promise<WorkspaceRecord> {
    await this.metadata.load();
    const record = this.metadata.state.projects.find(p => p.id === id);
    if (!record) throw new Error('Proyecto no autorizado. Abra su carpeta primero.');
    this.checkRoot(record.root);
    if (await fs.realpath(record.root) !== record.root) throw new Error('La carpeta del proyecto cambió.');
    return record;
  }

  private async read(record: WorkspaceRecord): Promise<LumiProject> {
    this.checkRoot(record.root);
    const sources = await readSources(record.root);
    const files = Object.entries(sources).map(([path, content]) => ({
      id: Object.hasOwn(record.fileIds, path) ? record.fileIds[path] : randomUUID(),
      path, name: basename(path), content, isEntry: path === record.entryPath,
    }));
    record.fileIds = Object.fromEntries(files.map(f => [f.path, f.id]));
    const byPath = (path?: string) => files.find(f => f.path === path)?.id;
    const tabs = record.tabPaths.map(path => byPath(path)).filter((id): id is string => !!id);
    const active = byPath(record.activePath) ?? tabs.at(-1) ?? '';
    if (active && !tabs.includes(active)) tabs.push(active);
    const project: LumiProject = {
      id: record.id, name: basename(record.root), location: record.root, description: record.description,
      files, entryFileId: byPath(record.entryPath), activeFileId: active, openTabIds: [...new Set(tabs)],
      createdAt: record.createdAt,
    };
    this.snapshots.set(record.id, structuredClone(project));
    return project;
  }

  async list(): Promise<LumiProject[]> {
    await this.metadata.load();
    const projects: LumiProject[] = [];
    for (const record of this.metadata.state.projects) {
      try { projects.push(await this.read(record)); }
      catch (error) { if (!isMissing(error)) throw error; }
    }
    await this.metadata.persist();
    return projects;
  }

  async chooseLocation(): Promise<string | null> {
    const chosen = await this.dialogs.chooseFolder();
    if (!chosen) return null;
    const path = await fs.realpath(chosen);
    this.locations.add(path);
    return path;
  }

  async open(): Promise<LumiProject | null> {
    const chosen = await this.dialogs.chooseFolder();
    if (!chosen) return null;
    await this.metadata.load();
    const root = await fs.realpath(chosen);
    this.checkRoot(root);
    let record = this.metadata.state.projects.find(p => p.root.toLowerCase() === root.toLowerCase());
    if (!record) {
      const firstPath = Object.keys(await readSources(root))[0];
      record = { id: randomUUID(), root, description: '', fileIds: {}, activePath: firstPath,
        tabPaths: firstPath ? [firstPath] : [], createdAt: new Date().toISOString() };
      this.metadata.state.projects.push(record);
    }
    const project = await this.read(record);
    await this.metadata.persist();
    return project;
  }

  async create(data: { name: string; location: string; description?: string }): Promise<LumiProject> {
    safeName(data.name);
    if (data.description && data.description.length > 4096) throw new Error('Descripción demasiado larga.');
    if (!this.locations.has(data.location)) throw new Error('Seleccione la ubicación mediante el diálogo de carpetas.');
    if (await fs.realpath(data.location) !== data.location) throw new Error('La ubicación elegida cambió. Selecciónela nuevamente.');
    await this.metadata.load();
    const root = join(data.location, data.name);
    await fs.mkdir(root);
    await fs.writeFile(join(root, 'principal.lumi'), 'principal {\n}\n', { flag: 'wx' });
    const record: WorkspaceRecord = {
      id: randomUUID(), root: await fs.realpath(root), description: data.description ?? '', fileIds: {},
      entryPath: 'principal.lumi', activePath: 'principal.lumi', tabPaths: ['principal.lumi'], createdAt: new Date().toISOString(),
    };
    this.metadata.state.projects.push(record);
    const project = await this.read(record);
    await this.metadata.persist();
    return project;
  }

  async importProject(raw: unknown, location: string): Promise<LumiProject> {
    const project = validateProject(raw);
    safeName(project.name);
    if (!this.locations.has(location)) throw new Error('Seleccione la ubicación mediante el diálogo de carpetas.');
    if (await fs.realpath(location) !== location) throw new Error('La ubicación elegida cambió. Selecciónela nuevamente.');
    await this.metadata.load();
    const root = join(location, project.name);
    await fs.mkdir(root);
    for (const file of project.files) {
      const path = join(root, file.path);
      await fs.mkdir(dirname(path), { recursive: true });
      await fs.writeFile(await inside(root, file.path, true), file.content, { flag: 'wx' });
    }
    const pathOf = (id?: string) => project.files.find(f => f.id === id)?.path;
    const record: WorkspaceRecord = {
      id: randomUUID(), root: await fs.realpath(root), description: project.description,
      fileIds: Object.fromEntries(project.files.map(file => [file.path, file.id])),
      entryPath: pathOf(project.entryFileId), activePath: pathOf(project.activeFileId),
      tabPaths: project.openTabIds!.map(id => pathOf(id)!), createdAt: new Date().toISOString(),
    };
    this.metadata.state.projects.push(record);
    const imported = await this.read(record);
    await this.metadata.persist();
    return imported;
  }

  async save(raw: unknown): Promise<void> {
    const project = validateProject(raw);
    const record = await this.record(project.id);
    const previous = this.snapshots.get(project.id);
    if (!previous) throw new Error('Debe abrir el proyecto antes de guardarlo.');
    const actions: Array<() => Promise<void>> = [];
    for (const old of previous.files) {
      const next = project.files.find(f => f.id === old.id);
      if (next && next.path === old.path && next.content === old.content) continue;
      const path = await inside(record.root, old.path);
      if (await fs.readFile(path, 'utf8') !== old.content) throw new Error(`El archivo ${old.path} cambió en disco. Reábralo antes de sobrescribirlo.`);
      if (!next) actions.push(() => this.dialogs.trash(path));
      else if (next.path !== old.path) {
        const target = await inside(record.root, next.path, true);
        try { await fs.lstat(target); throw new Error('El destino ya existe.'); } catch (error) { if (!isMissing(error)) throw error; }
        actions.push(async () => {
          await fs.link(path, target);
          await fs.unlink(path);
          if (next.content !== old.content) await atomicWrite(target, next.content);
        });
      } else actions.push(() => atomicWrite(path, next.content));
    }
    for (const file of project.files.filter(f => !previous.files.some(old => old.id === f.id))) {
      const path = await inside(record.root, file.path, true);
      try { await fs.lstat(path); throw new Error('El archivo ya existe.'); } catch (error) { if (!isMissing(error)) throw error; }
      actions.push(() => fs.writeFile(path, file.content, { flag: 'wx' }));
    }
    for (const action of actions) await action();
    const pathOf = (id?: string) => project.files.find(f => f.id === id)?.path;
    record.fileIds = Object.fromEntries(project.files.map(f => [f.path, f.id]));
    record.entryPath = pathOf(project.entryFileId);
    record.activePath = pathOf(project.activeFileId);
    record.tabPaths = (project.openTabIds ?? []).map(id => pathOf(id)!).filter(Boolean);
    record.description = project.description;
    this.snapshots.set(project.id, structuredClone(project));
    await this.metadata.persist();
  }

  async rename(id: string, name: string): Promise<LumiProject> {
    safeName(name);
    const record = await this.record(id);
    const target = join(dirname(record.root), name);
    if (target === record.root) return this.read(record);
    try { await fs.lstat(target); throw new Error('La carpeta de destino ya existe.'); } catch (error) { if (!isMissing(error)) throw error; }
    await fs.rename(record.root, target);
    record.root = await fs.realpath(target);
    const project = await this.read(record);
    await this.metadata.persist();
    return project;
  }

  async saveAs(id: string, fileId: string, content: string): Promise<LumiProject | null> {
    const record = await this.record(id);
    const original = this.snapshots.get(id);
    const file = original?.files.find(f => f.id === fileId);
    if (!original || !file || Buffer.byteLength(content) > MAX_SOURCE_BYTES) throw new Error('Archivo no válido.');
    const chosen = await this.dialogs.chooseSavePath(record.root, file.name);
    if (!chosen) return null;
    const path = relative(record.root, resolve(chosen)).split(sep).join('/');
    const target = await inside(record.root, path, true);
    if (original.files.some(f => f.path.toLowerCase() === path.toLowerCase())) throw new Error('Guardar como requiere un nombre nuevo dentro del proyecto.');
    await fs.writeFile(target, content, { flag: 'wx' });
    const newFile = { id: randomUUID(), path, name: basename(path), content, isEntry: false };
    record.fileIds[path] = newFile.id;
    record.activePath = path;
    record.tabPaths.push(path);
    const project = await this.read(record);
    await this.metadata.persist();
    return project;
  }

  async remove(id: string): Promise<boolean> {
    const record = await this.record(id);
    if (!await this.dialogs.confirmDelete(basename(record.root))) return false;
    await this.dialogs.trash(record.root);
    this.metadata.state.projects = this.metadata.state.projects.filter(p => p.id !== id);
    if (this.metadata.state.lastActive === id) this.metadata.state.lastActive = null;
    this.snapshots.delete(id);
    await this.metadata.persist();
    return true;
  }

  async lastActive(id?: string | null): Promise<string | null> {
    await this.metadata.load();
    if (id !== undefined) {
      if (id !== null) await this.record(id);
      this.metadata.state.lastActive = id;
      await this.metadata.persist();
    }
    return this.metadata.state.lastActive;
  }
}
