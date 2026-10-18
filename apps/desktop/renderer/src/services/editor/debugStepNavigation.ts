import type { ContractValidationError, DebugStep, LumiProject, ScenePlan, SourceReference } from '../../types';
import type { SourceNavigation } from './sourceNavigation';
import { findSourceFile } from './sourceNavigation';
import { relativePath } from '../integration/projectInput';
import { sceneStructure } from '../compiler/contracts/sceneStructure';

export function validDebugSource(source: SourceReference | undefined): source is SourceReference {
  if (!source || typeof source.file !== 'string' || !source.file
    || /[:\\\u0000-\u001f]/.test(source.file) || source.file.startsWith('/')) return false;
  return !source.file.split('/').some(part => !part || part === '.' || part === '..')
    && Number.isInteger(source.line) && source.line >= 1
    && (source.column === undefined || (Number.isInteger(source.column) && source.column >= 1));
}

export function resolveDebugStep(project: LumiProject | null, step: DebugStep | null): {
  navigation: SourceNavigation | null; scenePlan: ScenePlan | null; activeObjectId: string | null;
} {
  const snapshot = step?.sceneSnapshot;
  const errors: ContractValidationError[] = [];
  if (snapshot) sceneStructure(snapshot, 'sceneSnapshot', errors);
  const scenePlan = snapshot && errors.length === 0 ? snapshot : null;
  const objectId = step?.activeObjectId;
  const matches = scenePlan?.rooms.filter(room => !step?.roomId || room.id === step.roomId)
    .flatMap(room => [...room.objects, ...room.doors, ...room.windows].filter(entity => entity.id === objectId));
  const activeObjectId = objectId && matches?.length === 1 ? objectId : null;
  const source = step?.sourceRef;
  let navigation: SourceNavigation | null = null;
  if (project && validDebugSource(source)) {
    const file = findSourceFile(project, source.file, false);
    if (file) {
      try {
        relativePath(file.path, project.name);
        navigation = { fileId: file.id, line: source.line, column: source.column };
      } catch { /* A legacy identity must never authorize an external project path. */ }
    }
  }
  return { navigation, scenePlan, activeObjectId };
}
