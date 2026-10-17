import type { LumiProject } from '../../types';
import type { ProjectStorage } from './ProjectStorage';
import type { WorkspaceBridge, WorkspaceReply } from './workspaceBridge';
import { relativePath } from '../integration/projectInput';

async function unwrap<T>(request: Promise<WorkspaceReply<T>>): Promise<T> {
  const reply = await request;
  if (reply.ok === false) throw new Error(reply.message);
  return reply.value;
}

export class DesktopProjectStorage implements ProjectStorage {
  readonly kind = 'desktop' as const;
  constructor(private readonly api?: WorkspaceBridge) {}
  private get bridge(): WorkspaceBridge {
    if (!this.api) throw new Error('El acceso a archivos de Electron no está disponible. Reinicia la aplicación.');
    return this.api;
  }
  private fromDisk(project: LumiProject): LumiProject {
    return { ...project, files: project.files.map(file => ({ ...file, path: `${project.name}/${file.path}` })) };
  }
  getProjects = async () => (await unwrap(this.bridge.list())).map(project => this.fromDisk(project));
  getProject = async (id: string) => (await this.getProjects()).find(p => p.id === id) ?? null;
  saveProject = (project: LumiProject) => unwrap(this.bridge.save({
    ...project, files: project.files.map(file => ({ ...file, path: relativePath(file.path, project.name) })),
  }));
  saveAllProjects = async (projects: LumiProject[]) => { for (const p of projects) await this.saveProject(p); };
  deleteProject = async (id: string) => {
    if (!await unwrap(this.bridge.remove(id))) throw new Error('Eliminación cancelada.');
  };
  getLastActiveProjectId = () => unwrap(this.bridge.lastActive());
  setLastActiveProjectId = async (id: string | null) => { await unwrap(this.bridge.lastActive(id)); };
  chooseLocation = () => unwrap(this.bridge.chooseLocation());
  createProject = async (data: { name: string; location: string; description?: string }) => this.fromDisk(await unwrap(this.bridge.create(data)));
  openProject = async () => { const p = await unwrap(this.bridge.open()); return p ? this.fromDisk(p) : null; };
  renameProject = async (id: string, name: string) => this.fromDisk(await unwrap(this.bridge.rename(id, name)));
  saveAs = async (id: string, fileId: string, content: string) => {
    const p = await unwrap(this.bridge.saveAs(id, fileId, content)); return p ? this.fromDisk(p) : null;
  };
  importProject = async (project: LumiProject, location: string) => this.fromDisk(await unwrap(this.bridge.importProject({
    ...project, files: project.files.map(file => ({ ...file, path: relativePath(file.path, project.name) })),
    openTabIds: [...new Set([...(project.openTabIds ?? []), ...(project.activeFileId ? [project.activeFileId] : [])])],
  }, location)));
}

export const desktopProjectStorage = typeof window !== 'undefined'
  && (window.lumiWorkspace || window.lumiDesktop || /Electron/i.test(navigator.userAgent))
  ? new DesktopProjectStorage(window.lumiWorkspace) : null;
