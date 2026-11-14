import type { LumiProject } from '../../types';
import type { BackendInput } from './desktopBridge';

export function relativePath(path: string, projectName: string): string {
  const normalized = path.replaceAll('\\', '/');
  const relative = normalized.startsWith(`${projectName}/`) ? normalized.slice(projectName.length + 1) : normalized;
  if (!relative || relative.startsWith('/') || /^[A-Za-z]:/.test(relative)
    || relative.includes('\0') || relative.split('/').some((part) => part === '..' || part === '.' || part === '')) {
    throw new Error('Los archivos deben tener rutas relativas de proyecto válidas.');
  }
  return relative;
}

/** Resolve a valid preferred compile entry, falling back to the explicit project entry. */
export function projectEntry(project: LumiProject, preferredFileId?: string): LumiProject['files'][number] {
  const marked = project.files.filter((file) => file.isEntry);
  const mainEntry = project.entryFileId
    ? project.files.find((file) => file.id === project.entryFileId)
    : marked.length === 1 ? marked[0] : undefined;
  if (!mainEntry) throw new Error('Seleccione un archivo principal explícito para el proyecto.');
  return project.files.find((file) => file.id === preferredFileId) ?? mainEntry;
}

/** Uses supplied contents, including drafts, and an optional compile entry override. */
export function projectInput(project: LumiProject, preferredFileId?: string): BackendInput {
  const entry = projectEntry(project, preferredFileId);
  const files: Record<string, string> = Object.create(null);
  const fileIds = new Set<string>();
  let entryFile = '';
  for (const file of project.files) {
    if (fileIds.has(file.id)) throw new Error('Hay identificadores de archivo duplicados.');
    fileIds.add(file.id);
    const path = relativePath(file.path, project.name);
    if (Object.hasOwn(files, path)) throw new Error('Hay rutas de archivo duplicadas en el proyecto.');
    files[path] = file.content;
    if (file.id === entry.id) entryFile = path;
  }
  return { entryFile, files };
}
