import type { LumiProject } from '../../renderer/src/types/domain/project';
import { MAX_PROJECT_FILES, MAX_SOURCE_BYTES, sourcePath } from './safeFiles';

export function validateProject(raw: unknown): LumiProject {
  if (!raw || typeof raw !== 'object') throw new Error('Proyecto no válido.');
  const p = raw as Partial<LumiProject>;
  if (typeof p.id !== 'string' || !p.id || p.id.length > 128 || typeof p.name !== 'string' || p.name.length > 180
    || typeof p.description !== 'string' || p.description.length > 4096
    || !Array.isArray(p.files) || p.files.length > MAX_PROJECT_FILES || typeof p.activeFileId !== 'string'
    || (p.entryFileId !== undefined && typeof p.entryFileId !== 'string')
    || !Array.isArray(p.openTabIds) || p.openTabIds.some(id => typeof id !== 'string')) throw new Error('Proyecto no válido.');
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const file of p.files) {
    if (!file || typeof file.id !== 'string' || !file.id || file.id.length > 128 || typeof file.name !== 'string' || typeof file.path !== 'string'
      || typeof file.content !== 'string' || Buffer.byteLength(file.content) > MAX_SOURCE_BYTES) throw new Error('Archivo no válido.');
    sourcePath(file.path);
    if (file.name !== file.path.split('/').at(-1) || ids.has(file.id) || paths.has(file.path.toLowerCase())) {
      throw new Error('Nombres o identificadores de archivos duplicados.');
    }
    ids.add(file.id); paths.add(file.path.toLowerCase());
  }
  if ((p.entryFileId && !ids.has(p.entryFileId)) || (p.activeFileId && !ids.has(p.activeFileId))
    || p.openTabIds.some(id => !ids.has(id)) || new Set(p.openTabIds).size !== p.openTabIds.length
    || (p.activeFileId && !p.openTabIds.includes(p.activeFileId))) throw new Error('Referencia de archivo no válida.');
  return p as LumiProject;
}
