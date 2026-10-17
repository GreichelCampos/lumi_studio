import { describe, it, expect } from 'vitest';
import {
  createInitialProject,
  createLumiFile,
  renameLumiFile,
  deleteLumiFile,
  setProjectEntryFile,
  saveFileContentInProject,
  saveAllDirtyFilesInProject,
  resolveInitialProjectSelection,
} from '../../../services/project/projectOperations';
import { createMockProject, createMockFile } from '../../fixtures/testFixtures';

describe('projectOperations', () => {
  it('createInitialProject debe inicializar un proyecto con archivo principal.lumi como punto de entrada', () => {
    const { project, principalFile } = createInitialProject({
      name: 'Casa Moderna',
      location: 'local/espacios',
      description: 'Diseño de casa moderna',
    });

    expect(project.name).toBe('Casa Moderna');
    expect(project.location).toBe('local/espacios');
    expect(project.files.length).toBe(1);
    expect(project.files[0].name).toBe('principal.lumi');
    expect(project.files[0].isEntry).toBe(true);
    expect(project.entryFileId).toBe(principalFile.id);
    expect(project.activeFileId).toBe(principalFile.id);
    expect(project.openTabIds).toContain(principalFile.id);
    expect(principalFile.content).toContain('principal {');
    expect(principalFile.content).toContain('visualizar3D');
  });

  it('createLumiFile debe generar un archivo con id único y plantilla de función válida', () => {
    const file = createLumiFile('MiProyecto', 'cocina.lumi');

    expect(file.id).toMatch(/^file-/);
    expect(file.name).toBe('cocina.lumi');
    expect(file.path).toBe('MiProyecto/cocina.lumi');
    expect(file.isEntry).toBe(false);
    expect(file.content).toContain('funcion vacio espacio_cocina()');
  });

  it('renameLumiFile debe actualizar el nombre y la ruta sin modificar otros archivos', () => {
    const file1 = createMockFile({ id: 'f-1', name: 'modulo1.lumi', path: 'P/modulo1.lumi' });
    const file2 = createMockFile({ id: 'f-2', name: 'modulo2.lumi', path: 'P/modulo2.lumi' });
    const project = createMockProject({ files: [file1, file2] });

    const updated = renameLumiFile(project, 'f-1', 'modulo_renombrado.lumi');

    expect(updated.files.find((f) => f.id === 'f-1')?.name).toBe('modulo_renombrado.lumi');
    expect(updated.files.find((f) => f.id === 'f-1')?.path).toBe('ProyectoTest/modulo_renombrado.lumi');
    expect(updated.files.find((f) => f.id === 'f-2')?.name).toBe('modulo2.lumi');
  });

  it('deleteLumiFile debe eliminar el archivo y transferir el entryPoint si se borra el archivo principal', () => {
    const fEntry = createMockFile({ id: 'f-entry', name: 'principal.lumi', isEntry: true });
    const fSecondary = createMockFile({ id: 'f-sec', name: 'secundario.lumi', isEntry: false });
    const project = createMockProject({
      files: [fEntry, fSecondary],
      entryFileId: 'f-entry',
      activeFileId: 'f-entry',
      openTabIds: ['f-entry', 'f-sec'],
    });

    const { updatedProject, remainingTabs, newActiveId } = deleteLumiFile(
      project,
      'f-entry',
      project.openTabIds,
      project.activeFileId
    );

    expect(updatedProject.files.length).toBe(1);
    expect(updatedProject.files[0].id).toBe('f-sec');
    expect(updatedProject.files[0].isEntry).toBe(true);
    expect(updatedProject.entryFileId).toBe('f-sec');
    expect(remainingTabs).toEqual(['f-sec']);
    expect(newActiveId).toBe('f-sec');
  });

  it('setProjectEntryFile debe actualizar la bandera isEntry en todos los archivos', () => {
    const f1 = createMockFile({ id: 'f-1', isEntry: true });
    const f2 = createMockFile({ id: 'f-2', isEntry: false });
    const project = createMockProject({ files: [f1, f2], entryFileId: 'f-1' });

    const updated = setProjectEntryFile(project, 'f-2');

    expect(updated.entryFileId).toBe('f-2');
    expect(updated.files.find((f) => f.id === 'f-2')?.isEntry).toBe(true);
    expect(updated.files.find((f) => f.id === 'f-1')?.isEntry).toBe(false);
  });

  it('saveFileContentInProject y saveAllDirtyFilesInProject deben actualizar contenidos adecuadamente', () => {
    const f1 = createMockFile({ id: 'f-1', content: 'v1' });
    const f2 = createMockFile({ id: 'f-2', content: 'v1' });
    const project = createMockProject({ files: [f1, f2] });

    const singleUpdate = saveFileContentInProject(project, 'f-1', 'v2-single');
    expect(singleUpdate.files.find((f) => f.id === 'f-1')?.content).toBe('v2-single');

    const multiUpdate = saveAllDirtyFilesInProject(project, {
      'f-1': 'nuevo-1',
      'f-2': 'nuevo-2',
    });
    expect(multiUpdate.files.find((f) => f.id === 'f-1')?.content).toBe('nuevo-1');
    expect(multiUpdate.files.find((f) => f.id === 'f-2')?.content).toBe('nuevo-2');
  });

  it('resolveInitialProjectSelection debe resolver correctamente proyecto y pestañas con fallbacks seguros', () => {
    const p1 = createMockProject({ id: 'p-1', entryFileId: 'f-1' });
    const p2 = createMockProject({ id: 'p-2', entryFileId: 'f-2' });

    const res1 = resolveInitialProjectSelection([p1, p2], 'p-2');
    expect(res1.selectedProject?.id).toBe('p-2');

    const res2 = resolveInitialProjectSelection([p1, p2], null);
    expect(res2.selectedProject?.id).toBe('p-1');

    const resEmpty = resolveInitialProjectSelection([], null);
    expect(resEmpty.selectedProject).toBeNull();
    expect(resEmpty.initialTabs).toEqual([]);
  });
});
