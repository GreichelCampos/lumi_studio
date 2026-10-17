import { describe, expect, it } from 'vitest';
import { findSourceFile, sourceSelection } from '../../../services/editor/sourceNavigation';
import { createMockFile, createMockProject } from '../../fixtures/testFixtures';

describe('source navigation', () => {
  it('selects exact relative files including nested files, without a basename fallback in Python mode', () => {
    const project = createMockProject({ files: [
      createMockFile({ id: 'one', path: 'ProyectoTest/a/mod.lumi', name: 'mod.lumi' }),
      createMockFile({ id: 'two', path: 'ProyectoTest/b/mod.lumi', name: 'mod.lumi' }),
    ] });
    expect(findSourceFile(project, 'b/mod.lumi', true)?.id).toBe('two');
    expect(findSourceFile(project, 'mod.lumi', true)).toBeUndefined();
    expect(findSourceFile(project, 'mod.lumi', false)).toBeUndefined();
    expect(findSourceFile(project, 'missing.lumi', true)).toBeUndefined();
  });
  it('retains unambiguous legacy file IDs in demonstration mode', () => {
    const project = createMockProject();
    expect(findSourceFile(project, project.activeFileId, false)?.id).toBe(project.activeFileId);
    expect(findSourceFile(project, project.activeFileId, true)).toBeUndefined();
  });
  it('maps one-based Python code-point columns to UTF-16 selections', () => {
    const result = sourceSelection('first\n😀áx', 2, 3);
    expect(result).toEqual({ line: 2, column: 3, start: 9, end: 9 });
  });
  it('clamps positions, handles CRLF and preserves line selection without a column', () => {
    expect(sourceSelection('a\r\nbc', 2)).toMatchObject({ line: 2, start: 3, end: 5 });
    expect(sourceSelection('a\nbc', 99, 99)).toMatchObject({ line: 2, column: 3, start: 4, end: 4 });
    expect(sourceSelection('', -1, -1)).toEqual({ line: 1, column: 1, start: 0, end: 0 });
  });
});
