import type { LumiFile, LumiProject } from '../../types';
import { relativePath } from '../integration/projectInput';

export interface SourceNavigation {
  fileId: string;
  line: number;
  column?: number;
}

export function findSourceFile(project: LumiProject, identity: string, realBackend: boolean): LumiFile | undefined {
  const exact = project.files.filter(file => {
    try { return relativePath(file.path, project.name) === identity; }
    catch { return false; }
  });
  if (exact.length === 1) return exact[0];
  if (realBackend || exact.length > 1) return undefined;
  const legacy = project.files.filter(file => file.id === identity || file.path === identity
    || file.name === identity || file.path.endsWith(`/${identity}`));
  return legacy.length === 1 ? legacy[0] : undefined;
}

export function sourceSelection(content: string, requestedLine: number, requestedColumn?: number): {
  start: number; end: number; line: number; column: number;
} {
  const lines = content.split('\n');
  const line = Math.min(lines.length, Math.max(1, Number.isFinite(requestedLine) ? Math.trunc(requestedLine) : 1));
  const text = lines[line - 1].replace(/\r$/, '');
  const offset = lines.slice(0, line - 1).reduce((total, value) => total + value.length + 1, 0);
  if (requestedColumn === undefined) return { start: offset, end: offset + text.length, line, column: 1 };
  const characters = Array.from(text);
  const column = Math.min(characters.length + 1,
    Math.max(1, Number.isFinite(requestedColumn) ? Math.trunc(requestedColumn) : 1));
  const start = offset + characters.slice(0, column - 1).join('').length;
  return { start, end: start, line, column };
}
