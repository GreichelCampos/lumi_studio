import type { LumiProject } from '../../types';

export interface CompilePreconditionFailure {
  kind: 'empty-project' | 'missing-entry' | 'invalid-entry';
  title: string;
  description: string;
  notification: string;
}

const EMPTY_PROJECT: CompilePreconditionFailure = {
  kind: 'empty-project',
  title: 'No hay archivos para compilar',
  description: 'Primero crea un archivo .lumi en tu proyecto para comenzar.',
  notification: 'No hay archivos para compilar. Primero crea un archivo .lumi en tu proyecto para comenzar.',
};

const MISSING_ENTRY: CompilePreconditionFailure = {
  kind: 'missing-entry',
  title: 'Selecciona un archivo principal',
  description: 'Abre el menú de opciones del archivo .lumi en el explorador y elige "Establecer como principal".',
  notification: 'Selecciona un archivo principal desde el explorador: abre las opciones del archivo .lumi y elige "Establecer como principal".',
};

const INVALID_ENTRY: CompilePreconditionFailure = {
  kind: 'invalid-entry',
  title: 'Selecciona otro archivo principal',
  description: 'El archivo principal seleccionado ya no existe o no pertenece al proyecto.',
  notification: 'Selecciona otro archivo principal. El archivo seleccionado ya no existe o no pertenece al proyecto.',
};

const isLumiFile = (file: LumiProject['files'][number]) =>
  file.name.toLocaleLowerCase().endsWith('.lumi') || file.path.toLocaleLowerCase().endsWith('.lumi');

/** Validations owned by the IDE. They must run before starting the compiler backend. */
export function validateCompilePreconditions(project: LumiProject): CompilePreconditionFailure | null {
  const lumiFiles = project.files.filter(isLumiFile);
  if (lumiFiles.length === 0) return EMPTY_PROJECT;

  if (project.entryFileId) {
    const entry = project.files.find((file) => file.id === project.entryFileId);
    if (!entry || !isLumiFile(entry)) return INVALID_ENTRY;
    return null;
  }

  const markedEntries = lumiFiles.filter((file) => file.isEntry);
  if (markedEntries.length === 0) return MISSING_ENTRY;
  if (markedEntries.length !== 1) return INVALID_ENTRY;
  return null;
}
