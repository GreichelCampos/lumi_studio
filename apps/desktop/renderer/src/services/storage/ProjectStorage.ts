import { LumiProject } from '../../types';

export interface ProjectStorage {
  /**
   * Obtiene la lista completa de proyectos disponibles.
   */
  getProjects(): Promise<LumiProject[]>;

  /**
   * Obtiene un proyecto por su ID único.
   */
  getProject(id: string): Promise<LumiProject | null>;

  /**
   * Guarda o actualiza un proyecto en el almacenamiento.
   */
  saveProject(project: LumiProject): Promise<void>;

  /**
   * Guarda múltiples proyectos a la vez.
   */
  saveAllProjects(projects: LumiProject[]): Promise<void>;

  /**
   * Elimina un proyecto del almacenamiento.
   */
  deleteProject(id: string): Promise<void>;

  /**
   * Obtiene el ID del último proyecto activo.
   */
  getLastActiveProjectId(): Promise<string | null>;

  /**
   * Establece el ID del último proyecto activo.
   */
  setLastActiveProjectId(id: string | null): Promise<void>;
}
