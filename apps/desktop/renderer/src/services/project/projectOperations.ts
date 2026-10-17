import { LumiProject, LumiFile } from '../../types';
import { generateUniqueId } from '../../utils/validation';

/**
 * Pure functions for project and file data transformations.
 */
export function createInitialProject(data: { name: string; location: string; description?: string }): {
  project: LumiProject;
  principalFile: LumiFile;
} {
  const newProjectId = generateUniqueId('proj');
  const principalFileId = generateUniqueId('file-principal');

  const principalFile: LumiFile = {
    id: principalFileId,
    name: 'principal.lumi',
    path: `${data.name}/principal.lumi`,
    isEntry: true,
    content: `-- Proyecto Lumi: ${data.name}
-- Descripción: ${data.description || 'Espacio 3D diseñado con Lumi'}

principal {
  decimal ancho = 5.0>>
  decimal largo = 4.0>>
  decimal alto = 2.7>>
  texto material_piso = "madera">>

  -- Origen [0.0, 0.0, 0.0] centrado en el piso
  habitacion sala_principal(ancho, largo, alto) {
    piso material material_piso>>
    pared norte color "blanco">>
    pared sur color "gris">>
    
    puerta en norte {
      ancho = 0.90>>
      alto = 2.10>>
      posicion = 1.0>>
    }

    ventana en sur {
      ancho = 1.60>>
      alto = 1.30>>
      posicion = -0.5>>
    }

    colocar sofa en [0.0, 0.0, -0.8]>>
    colocar mesa en [0.0, 0.0, 0.6]>>
    colocar planta en [1.7, 0.0, 1.2]>>
  }

  visualizar3D(sala_principal)>>
}
`,
  };

  const project: LumiProject = {
    id: newProjectId,
    name: data.name,
    description: data.description || 'Proyecto de modelado espacial Lumi',
    location: data.location,
    files: [principalFile],
    activeFileId: principalFileId,
    entryFileId: principalFileId,
    openTabIds: [principalFileId],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return { project, principalFile };
}

export function createLumiFile(projectName: string, cleanFileName: string): LumiFile {
  const newFileId = generateUniqueId('file');
  return {
    id: newFileId,
    name: cleanFileName,
    path: `${projectName}/${cleanFileName}`,
    isEntry: false,
    content: `-- Módulo: ${cleanFileName}
funcion vacio espacio_${cleanFileName.replace(/\.lumi$/i, '').replace(/[^a-zA-Z0-9_]/g, '_')}() {
  colocar mesa en [0.0, 0.0, 0.0]>>
  colocar silla en [0.0, 0.0, -0.6]>>
}
`,
  };
}

export function renameLumiFile(project: LumiProject, fileId: string, newCleanName: string): LumiProject {
  const updatedFiles = project.files.map((f) => {
    if (f.id !== fileId) return f;
    return {
      ...f,
      name: newCleanName,
      path: `${project.name}/${newCleanName}`,
    };
  });

  return {
    ...project,
    files: updatedFiles,
  };
}

export function deleteLumiFile(
  project: LumiProject,
  fileId: string,
  openTabIds: string[],
  activeFileId: string | null
): { updatedProject: LumiProject; remainingTabs: string[]; newActiveId: string | null } {
  const remainingFiles = project.files.filter((f) => f.id !== fileId);
  const remainingTabs = openTabIds.filter((id) => id !== fileId);

  let newEntryId = project.entryFileId;
  if (newEntryId === fileId || !remainingFiles.some((f) => f.id === newEntryId)) {
    newEntryId = remainingFiles[0]?.id;
  }

  const adjustedFiles = remainingFiles.map((f) => ({
    ...f,
    isEntry: f.id === newEntryId,
  }));

  let newActiveId = activeFileId;
  if (activeFileId === fileId) {
    newActiveId = remainingTabs[0] || remainingFiles[0]?.id || null;
  }

  const updatedProject: LumiProject = {
    ...project,
    files: adjustedFiles,
    entryFileId: newEntryId,
    activeFileId: newActiveId || '',
    openTabIds: remainingTabs,
  };

  return { updatedProject, remainingTabs, newActiveId };
}

export function setProjectEntryFile(project: LumiProject, fileId: string): LumiProject {
  const updatedFiles = project.files.map((f) => ({
    ...f,
    isEntry: f.id === fileId,
  }));

  return {
    ...project,
    files: updatedFiles,
    entryFileId: fileId,
  };
}

export function saveFileContentInProject(project: LumiProject, fileId: string, newContent: string): LumiProject {
  const updatedFiles = project.files.map((f) => {
    if (f.id !== fileId) return f;
    return {
      ...f,
      content: newContent,
    };
  });

  return {
    ...project,
    files: updatedFiles,
  };
}

export function saveAllDirtyFilesInProject(
  project: LumiProject,
  dirtyFiles: Record<string, string>
): LumiProject {
  const updatedFiles = project.files.map((f) => {
    if (f.id in dirtyFiles) {
      return {
        ...f,
        content: dirtyFiles[f.id],
      };
    }
    return f;
  });

  return {
    ...project,
    files: updatedFiles,
  };
}

export function resolveInitialProjectSelection(
  loadedProjects: LumiProject[],
  lastActiveId: string | null
): {
  selectedProject: LumiProject | null;
  initialEntryId: string | null;
  initialTabs: string[];
  initialActiveId: string | null;
} {
  const selected =
    (lastActiveId && loadedProjects.find((p) => p.id === lastActiveId)) ||
    loadedProjects[0] ||
    null;

  if (!selected) {
    return {
      selectedProject: null,
      initialEntryId: null,
      initialTabs: [],
      initialActiveId: null,
    };
  }

  const initialEntryId =
    selected.entryFileId ||
    selected.files.find((f) => f.isEntry)?.id ||
    selected.files[0]?.id ||
    null;

  const initialTabs =
    selected.openTabIds && selected.openTabIds.length > 0
      ? selected.openTabIds.filter((id) => selected.files.some((f) => f.id === id))
      : initialEntryId
      ? [initialEntryId]
      : [];

  const initialActiveId =
    selected.activeFileId && selected.files.some((f) => f.id === selected.activeFileId)
      ? selected.activeFileId
      : initialEntryId;

  return {
    selectedProject: selected,
    initialEntryId,
    initialTabs,
    initialActiveId,
  };
}
