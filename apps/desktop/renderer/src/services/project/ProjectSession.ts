import type { LumiProject } from '../../types';
import type { ProjectStorage } from '../storage/ProjectStorage';
import { ideLogger } from '../logger/IdeLogService';
import { createInitialProject, createLumiFile, deleteLumiFile, renameLumiFile, resolveInitialProjectSelection, setProjectEntryFile } from './projectOperations';

export interface SessionState {
  projects: LumiProject[];
  currentProjectId: string | null;
  drafts: Record<string, Record<string, string>>;
  revision: number;
  loaded: boolean;
  error: string | null;
}

export class ProjectSession {
  state: SessionState = { projects: [], currentProjectId: null, drafts: {}, revision: 1, loaded: false, error: null };
  private listeners = new Set<() => void>();
  private pending: Promise<unknown> = Promise.resolve();
  private initialization?: Promise<void>;
  constructor(readonly storage: ProjectStorage) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  private update(patch: Partial<SessionState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener());
  }
  report = (error: unknown) => this.update({ error: error instanceof Error ? error.message : 'No se pudo guardar el proyecto.' });
  clearError = () => this.update({ error: null });
  async run(operation: () => Promise<void>): Promise<boolean> {
    const next = this.pending.then(operation);
    this.pending = next.catch(() => undefined);
    try { await next; return true; } catch (error) { this.report(error); return false; }
  }
  initialize(): Promise<void> {
    return this.initialization ??= this.load();
  }
  private async load(): Promise<void> {
    await this.run(async () => {
      const projects = (await this.storage.getProjects()).map(project => {
        const ids = new Set(project.files.map(file => file.id));
        const tabs = [...new Set((project.openTabIds ?? [project.activeFileId]).filter(id => ids.has(id)))];
        const active = ids.has(project.activeFileId) ? project.activeFileId : tabs.at(-1) ?? '';
        if (active && !tabs.includes(active)) tabs.push(active);
        return { ...project, activeFileId: active, openTabIds: tabs };
      });
      const last = await this.storage.getLastActiveProjectId();
      const selected = resolveInitialProjectSelection(projects, last).selectedProject;
      this.update({ projects, currentProjectId: selected?.id ?? null });
      if (selected) ideLogger.logProjectOpened(selected.name, selected.files.length);
    });
    this.update({ loaded: true });
  }
  get current(): LumiProject | undefined { return this.state.projects.find(p => p.id === this.state.currentProjectId); }
  private project(id: string): LumiProject {
    const project = this.state.projects.find(p => p.id === id);
    if (!project) throw new Error('El proyecto ya no está abierto.');
    return project;
  }
  private replace(project: LumiProject) {
    const exists = this.state.projects.some(p => p.id === project.id);
    const previous = this.state.projects.find(p => p.id === project.id);
    const signature = (p: LumiProject) => JSON.stringify({ entry: p.entryFileId, files: p.files.map(file => ({
      id: file.id, path: file.path, content: this.state.drafts[p.id]?.[file.id] ?? file.content,
    })) });
    const changed = !previous || signature(previous) !== signature(project);
    this.update({ projects: exists ? this.state.projects.map(p => p.id === project.id ? project : p) : [...this.state.projects, project], revision: this.state.revision + Number(changed) });
  }
  async adopt(project: LumiProject): Promise<void> {
    await this.storage.setLastActiveProjectId(project.id);
    this.replace(project);
    this.update({ currentProjectId: project.id });
    ideLogger.logProjectOpened(project.name, project.files.length);
  }
  selectProject = (id: string) => this.run(async () => {
    const project = this.project(id);
    await this.storage.setLastActiveProjectId(id);
    this.update({ currentProjectId: id, revision: this.state.revision + 1 });
    ideLogger.logProjectOpened(project.name, project.files.length);
  });
  createProject = (data: { name: string; location: string; description?: string }) => this.run(async () => {
    const project = createInitialProject(data).project;
    await this.storage.saveProject(project);
    await this.storage.setLastActiveProjectId(project.id);
    this.replace(project);
    this.update({ currentProjectId: project.id });
  });
  deleteProject = (id: string) => this.run(async () => {
    await this.storage.deleteProject(id);
    const projects = this.state.projects.filter(p => p.id !== id);
    const drafts = { ...this.state.drafts }; delete drafts[id];
    const currentProjectId = this.state.currentProjectId === id ? projects[0]?.id ?? null : this.state.currentProjectId;
    this.update({ projects, drafts, currentProjectId, revision: this.state.revision + 1 });
    await this.storage.setLastActiveProjectId(currentProjectId);
  });
  private change(id: string, transform: (project: LumiProject) => LumiProject): Promise<boolean> {
    return this.run(async () => {
      const project = transform(this.project(id));
      await this.storage.saveProject(project);
      this.replace(project);
    });
  }
  selectFile = (fileId: string): Promise<boolean> => {
    const id = this.state.currentProjectId;
    if (!id) return Promise.resolve(false);
    return this.change(id, project => {
      if (!project.files.some(f => f.id === fileId)) throw new Error('Archivo no encontrado.');
      return { ...project, activeFileId: fileId, openTabIds: [...new Set([...(project.openTabIds ?? []), fileId])] };
    });
  };
  createFile = (name: string): Promise<boolean> => {
    const id = this.state.currentProjectId;
    if (!id) return Promise.resolve(false);
    return this.change(id, project => {
      const file = createLumiFile(project.name, name);
      if (this.storage.kind === 'desktop') file.content = '';
      return { ...project, files: [...project.files, file], activeFileId: file.id, openTabIds: [...(project.openTabIds ?? []), file.id] };
    });
  };
  renameFile = (fileId: string, name: string): Promise<boolean> => {
    const id = this.state.currentProjectId;
    return id ? this.change(id, p => renameLumiFile(p, fileId, name)) : Promise.resolve(false);
  };
  setEntry = (fileId: string): Promise<boolean> => {
    const id = this.state.currentProjectId;
    return id ? this.change(id, p => {
      if (!p.files.some(f => f.id === fileId)) throw new Error('Archivo no encontrado.');
      return setProjectEntryFile(p, fileId);
    }) : Promise.resolve(false);
  };
  deleteFile = (fileId: string): Promise<boolean> => {
    const id = this.state.currentProjectId;
    if (!id) return Promise.resolve(false);
    return this.run(async () => {
      const project = this.project(id);
      const updated = deleteLumiFile(project, fileId, project.openTabIds ?? [], project.activeFileId).updatedProject;
      await this.storage.saveProject(updated);
      this.discard(id, fileId);
      this.replace(updated);
    });
  };
  edit = (fileId: string, content: string): void => {
    const project = this.current;
    const file = project?.files.find(f => f.id === fileId);
    if (!project || !file) return;
    const drafts = { ...this.state.drafts[project.id] };
    if (file.content === content) delete drafts[fileId]; else drafts[fileId] = content;
    this.update({ drafts: { ...this.state.drafts, [project.id]: drafts }, revision: this.state.revision + 1 });
  };
  discard(projectId: string, fileId: string): void {
    const drafts = { ...this.state.drafts[projectId] }; delete drafts[fileId];
    this.update({ drafts: { ...this.state.drafts, [projectId]: drafts }, revision: this.state.revision + 1 });
  }
  save = (fileId?: string): Promise<boolean> => {
    const id = this.state.currentProjectId;
    const target = fileId ?? this.current?.activeFileId;
    if (!id) return Promise.resolve(false);
    const captured = { ...this.state.drafts[id] };
    if (fileId !== '*') Object.keys(captured).forEach(key => { if (key !== target) delete captured[key]; });
    return this.run(async () => {
      const project = this.project(id);
      if (!Object.keys(captured).length) return;
      const updated = { ...project, files: project.files.map(f => ({ ...f, content: captured[f.id] ?? f.content })) };
      await this.storage.saveProject(updated);
      this.replace(updated);
      const drafts = { ...this.state.drafts[id] };
      Object.entries(captured).forEach(([key, value]) => { if (drafts[key] === value) delete drafts[key]; });
      this.update({ drafts: { ...this.state.drafts, [id]: drafts } });
      if (fileId === '*') ideLogger.logAllFilesSaved(Object.keys(captured).length);
      else {
        const file = updated.files.find(f => f.id === target);
        if (file) ideLogger.logFileSaved(file.name);
      }
    });
  };
  closeTab = (fileId: string, discard = false): Promise<boolean> => {
    const id = this.state.currentProjectId;
    if (!id) return Promise.resolve(false);
    return this.run(async () => {
      const project = this.project(id);
      if (!discard && Object.hasOwn(this.state.drafts[id] ?? {}, fileId)) throw new Error('El archivo tiene cambios nuevos sin guardar.');
      const tabs = (project.openTabIds ?? []).filter(tab => tab !== fileId);
      const updated = { ...project, openTabIds: tabs, activeFileId: project.activeFileId === fileId ? tabs.at(-1) ?? '' : project.activeFileId };
      await this.storage.saveProject(updated);
      this.discard(id, fileId);
      this.replace(updated);
    });
  };
}
