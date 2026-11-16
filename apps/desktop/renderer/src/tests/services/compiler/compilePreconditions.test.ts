import { describe, expect, it } from 'vitest';
import { validateCompilePreconditions } from '../../../services/compiler/compilePreconditions';
import type { LumiProject } from '../../../types';

const project = (overrides: Partial<LumiProject> = {}): LumiProject => ({
  id: 'project', name: 'cuarto', description: '', activeFileId: '', files: [], ...overrides,
});

describe('compile preconditions', () => {
  it('stops an empty project with an informative message', () => {
    expect(validateCompilePreconditions(project())).toMatchObject({
      kind: 'empty-project',
      title: 'No hay archivos para compilar',
      description: 'Primero creá un archivo .lumi en tu proyecto para comenzar.',
      notification: 'No hay archivos para compilar. Primero creá un archivo .lumi en tu proyecto para comenzar.',
    });
  });

  it('requires an explicitly selected main Lumi file', () => {
    const failure = validateCompilePreconditions(project({
      files: [{ id: 'file', name: 'uno.lumi', path: 'uno.lumi', content: '' }],
    }));
    expect(failure?.kind).toBe('missing-entry');
    expect(failure?.notification).toBe('Seleccioná un archivo principal desde el explorador: abrí las opciones del archivo .lumi y elegí "Establecer como principal".');
  });

  it('accepts a valid main file', () => {
    expect(validateCompilePreconditions(project({
      entryFileId: 'main',
      files: [{ id: 'main', name: 'principal.lumi', path: 'principal.lumi', content: '', isEntry: true }],
    }))).toBeNull();
  });

  it('rejects a deleted or non-Lumi main file', () => {
    const files = [{ id: 'other', name: 'otro.lumi', path: 'otro.lumi', content: '' }];
    expect(validateCompilePreconditions(project({ entryFileId: 'deleted', files }))?.kind).toBe('invalid-entry');
    expect(validateCompilePreconditions(project({
      entryFileId: 'notes', files: [{ id: 'notes', name: 'notas.txt', path: 'notas.txt', content: '' }, ...files],
    }))?.kind).toBe('invalid-entry');
  });
});
