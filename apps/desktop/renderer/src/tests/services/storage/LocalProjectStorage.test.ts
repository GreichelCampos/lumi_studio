import { describe, it, expect, beforeEach } from 'vitest';
import { LocalProjectStorage } from '../../../services/storage/LocalProjectStorage';
import { createMockProject } from '../../fixtures/testFixtures';
import { INITIAL_PROJECTS } from '../../../data/fixtures';

describe('LocalProjectStorage', () => {
  let storage: LocalProjectStorage;

  beforeEach(() => {
    localStorage.clear();
    storage = new LocalProjectStorage();
  });

  it('debe inicializar con proyectos predeterminados si localStorage está vacío', async () => {
    const projects = await storage.getProjects();
    expect(projects).toBeDefined();
    expect(Array.isArray(projects)).toBe(true);
    expect(projects.length).toBe(INITIAL_PROJECTS.length);
    expect(projects[0].name).toBe(INITIAL_PROJECTS[0].name);
  });

  it('debe guardar y recuperar un nuevo proyecto correctamente', async () => {
    const customProj = createMockProject({ id: 'proj-unique-1', name: 'Apartamento Minimalista' });
    await storage.saveProject(customProj);

    const retrieved = await storage.getProject('proj-unique-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('proj-unique-1');
    expect(retrieved?.name).toBe('Apartamento Minimalista');
    expect(retrieved?.updatedAt).toBeDefined();
  });

  it('debe actualizar un proyecto existente sin duplicarlo en la lista', async () => {
    const initial = createMockProject({ id: 'proj-update-1', name: 'Nombre Inicial' });
    await storage.saveProject(initial);

    const updated = { ...initial, name: 'Nombre Modificado' };
    await storage.saveProject(updated);

    const projects = await storage.getProjects();
    const matches = projects.filter((p) => p.id === 'proj-update-1');
    expect(matches.length).toBe(1);
    expect(matches[0].name).toBe('Nombre Modificado');
  });

  it('debe manejar múltiples proyectos independientes', async () => {
    const p1 = createMockProject({ id: 'proj-multi-1', name: 'Proyecto 1' });
    const p2 = createMockProject({ id: 'proj-multi-2', name: 'Proyecto 2' });
    const p3 = createMockProject({ id: 'proj-multi-3', name: 'Proyecto 3' });

    await storage.saveProject(p1);
    await storage.saveProject(p2);
    await storage.saveProject(p3);

    const all = await storage.getProjects();
    expect(all.some((p) => p.id === 'proj-multi-1')).toBe(true);
    expect(all.some((p) => p.id === 'proj-multi-2')).toBe(true);
    expect(all.some((p) => p.id === 'proj-multi-3')).toBe(true);
  });

  it('debe eliminar un proyecto existente y actualizar el último proyecto activo', async () => {
    const p1 = createMockProject({ id: 'proj-del-1', name: 'Proyecto a eliminar' });
    const p2 = createMockProject({ id: 'proj-del-2', name: 'Proyecto secundario' });
    await storage.saveProject(p1);
    await storage.saveProject(p2);
    await storage.setLastActiveProjectId('proj-del-1');

    await storage.deleteProject('proj-del-1');

    const retrieved = await storage.getProject('proj-del-1');
    expect(retrieved).toBeNull();

    const lastActive = await storage.getLastActiveProjectId();
    expect(lastActive).not.toBe('proj-del-1');
  });

  it('debe devolver null al buscar un id inexistente', async () => {
    const nonExistent = await storage.getProject('id-que-no-existe-nunca');
    expect(nonExistent).toBeNull();
  });

  it('debe recuperarse de datos corruptos o inválidos en localStorage sin lanzar excepciones', async () => {
    localStorage.setItem('lumi_ide_projects_v1', '{ "corruptedJson: true ');

    const projects = await storage.getProjects();
    expect(projects).toBeDefined();
    expect(Array.isArray(projects)).toBe(true);
    expect(projects.length).toBe(INITIAL_PROJECTS.length);
  });

  it('debe persistir y recuperar el id del último proyecto activo', async () => {
    await storage.setLastActiveProjectId('proj-active-99');
    const activeId = await storage.getLastActiveProjectId();
    expect(activeId).toBe('proj-active-99');

    await storage.setLastActiveProjectId(null);
    const clearedId = await storage.getLastActiveProjectId();
    expect(clearedId).toBeNull();
  });
});
