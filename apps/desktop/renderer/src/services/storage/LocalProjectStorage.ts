import { ProjectStorage } from './ProjectStorage';
import { LumiProject } from '../../types';
import { INITIAL_PROJECTS } from '../../data/fixtures';

const STORAGE_KEY_PROJECTS = 'lumi_ide_projects_v1';
const STORAGE_KEY_LAST_PROJECT = 'lumi_ide_last_active_project_id_v1';

export class LocalProjectStorage implements ProjectStorage {
  public async getProjects(): Promise<LumiProject[]> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PROJECTS);
      if (!raw) {
        // Inicializar con fixtures si no hay proyectos guardados
        await this.saveAllProjects(INITIAL_PROJECTS);
        return INITIAL_PROJECTS;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        await this.saveAllProjects(INITIAL_PROJECTS);
        return INITIAL_PROJECTS;
      }
      return parsed as LumiProject[];
    } catch {
      return INITIAL_PROJECTS;
    }
  }

  public async getProject(id: string): Promise<LumiProject | null> {
    const projects = await this.getProjects();
    return projects.find((p) => p.id === id) || null;
  }

  public async saveProject(project: LumiProject): Promise<void> {
    const projects = await this.getProjects();
    const index = projects.findIndex((p) => p.id === project.id);
    let updatedProjects: LumiProject[];

    if (index >= 0) {
      updatedProjects = [
        ...projects.slice(0, index),
        { ...project, updatedAt: new Date().toISOString() },
        ...projects.slice(index + 1),
      ];
    } else {
      updatedProjects = [
        ...projects,
        {
          ...project,
          createdAt: project.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
    }

    await this.saveAllProjects(updatedProjects);
  }

  public async saveAllProjects(projects: LumiProject[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
    } catch (err) {
      console.error('Error guardando proyectos en LocalProjectStorage:', err);
    }
  }

  public async deleteProject(id: string): Promise<void> {
    const projects = await this.getProjects();
    const filtered = projects.filter((p) => p.id !== id);
    await this.saveAllProjects(filtered);

    const lastActive = await this.getLastActiveProjectId();
    if (lastActive === id) {
      await this.setLastActiveProjectId(filtered[0]?.id || null);
    }
  }

  public async getLastActiveProjectId(): Promise<string | null> {
    try {
      return localStorage.getItem(STORAGE_KEY_LAST_PROJECT);
    } catch {
      return null;
    }
  }

  public async setLastActiveProjectId(id: string | null): Promise<void> {
    try {
      if (id) {
        localStorage.setItem(STORAGE_KEY_LAST_PROJECT, id);
      } else {
        localStorage.removeItem(STORAGE_KEY_LAST_PROJECT);
      }
    } catch (err) {
      console.error('Error guardando último proyecto activo:', err);
    }
  }
}

export const defaultProjectStorage: ProjectStorage = new LocalProjectStorage();
