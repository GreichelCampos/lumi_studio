import { describe, expect, it, vi } from 'vitest';
import { ProjectSession } from '../../../services/project/ProjectSession';
import type { ProjectStorage } from '../../../services/storage/ProjectStorage';
import { createMockFile, createMockProject } from '../../fixtures/testFixtures';

function setup() {
  const a = createMockProject();
  const b = createMockProject({ id: 'b', name: 'B' });
  const storage: ProjectStorage = {
    getProjects: vi.fn(async () => [a, b]), getProject: vi.fn(async () => a),
    saveProject: vi.fn(async () => undefined), saveAllProjects: vi.fn(async () => undefined),
    deleteProject: vi.fn(async () => undefined), getLastActiveProjectId: vi.fn(async () => a.id),
    setLastActiveProjectId: vi.fn(async () => undefined),
  };
  return { session: new ProjectSession(storage), storage, a, b };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

describe('ProjectSession', () => {
  it('serializes captured saves and retains edits made after both requests', async () => {
    const { session, storage, a } = setup(); await session.initialize();
    const wait = deferred(); vi.mocked(storage.saveProject).mockReturnValueOnce(wait.promise);
    session.edit(a.activeFileId, 'first');
    const first = session.save(); await Promise.resolve();
    session.edit(a.activeFileId, 'second'); const second = session.save();
    session.edit(a.activeFileId, 'third'); wait.resolve();
    expect(await first).toBe(true); expect(await second).toBe(true);
    expect(vi.mocked(storage.saveProject).mock.calls.map(([project]) => project.files[0].content)).toEqual(['first', 'second']);
    expect(session.current!.files[0].content).toBe('second');
    expect(session.state.drafts[a.id][a.activeFileId]).toBe('third');
  });
  it('retains separate drafts through rapid project changes, even with shared file IDs', async () => {
    const { session, a, b } = setup(); await session.initialize();
    session.edit(a.activeFileId, 'draft A');
    await session.selectProject(b.id); session.edit(b.activeFileId, 'draft B');
    const switches = [session.selectProject(a.id), session.selectProject(b.id), session.selectProject(a.id)];
    await Promise.all(switches);
    expect(session.current!.id).toBe(a.id);
    expect(session.state.drafts[a.id][a.activeFileId]).toBe('draft A');
    expect(session.state.drafts[b.id][b.activeFileId]).toBe('draft B');
  });
  it('keeps dirty contents and tabs when saving fails', async () => {
    const { session, storage, a } = setup(); await session.initialize();
    session.edit(a.activeFileId, 'pending');
    vi.mocked(storage.saveProject).mockRejectedValue(new Error('Permission denied'));
    expect(await session.save()).toBe(false);
    expect(session.state.drafts[a.id][a.activeFileId]).toBe('pending');
    expect(session.current!.files[0].content).toBe(a.files[0].content);
    expect(session.current!.openTabIds).toContain(a.activeFileId);
    expect(session.state.error).toBe('Permission denied');
  });
  it('retains edits made while a save is in flight and refuses an unconfirmed close', async () => {
    const { session, storage, a } = setup(); await session.initialize();
    const wait = deferred(); vi.mocked(storage.saveProject).mockReturnValueOnce(wait.promise);
    session.edit(a.activeFileId, 'first');
    const saving = session.save(); await Promise.resolve();
    session.edit(a.activeFileId, 'second'); wait.resolve();
    expect(await saving).toBe(true);
    expect(session.current!.files[0].content).toBe('first');
    expect(session.state.drafts[a.id][a.activeFileId]).toBe('second');
    expect(await session.closeTab(a.activeFileId)).toBe(false);
    expect(await session.closeTab(a.activeFileId, true)).toBe(true);
    expect(session.state.drafts[a.id]).toEqual({});
  });
  it('saves a captured project while changing projects without erasing either draft', async () => {
    const { session, storage, a, b } = setup(); await session.initialize();
    const wait = deferred(); vi.mocked(storage.saveProject).mockReturnValueOnce(wait.promise);
    session.edit(a.activeFileId, 'saved A'); const saving = session.save();
    const switching = session.selectProject(b.id); wait.resolve();
    await saving; await switching;
    session.edit(b.activeFileId, 'pending B');
    expect(session.state.projects[0].files[0].content).toBe('saved A');
    expect(session.state.drafts[b.id][b.activeFileId]).toBe('pending B');
  });
  it('persists main selection separately from active tabs and preserves IDs when renaming', async () => {
    const { session, a } = setup();
    const secondary = createMockFile({ id: 'secondary', name: 'module.lumi', path: `${a.name}/nested/module.lumi`, isEntry: false });
    a.files.push(secondary);
    await session.initialize();
    await session.selectFile('secondary');
    expect(session.current!.entryFileId).toBe(a.entryFileId);
    await session.setEntry('secondary');
    await session.selectFile(a.activeFileId);
    await session.renameFile('secondary', 'renamed.lumi');
    expect(session.current!.files[1]).toMatchObject({ id: 'secondary', path: `${a.name}/nested/renamed.lumi` });
    expect(session.current!.entryFileId).toBe('secondary');
    expect(session.current!.activeFileId).toBe(a.activeFileId);
    expect(session.current!.openTabIds).toContain('secondary');
    await session.closeTab('secondary');
    expect(session.current!.entryFileId).toBe('secondary');
  });
  it('serializes creation and selection without restoring stale project snapshots', async () => {
    const { session } = setup(); await session.initialize();
    await Promise.all([session.createFile('a.lumi'), session.createFile('b.lumi')]);
    expect(session.current!.files.map(f => f.name)).toEqual(['principal.lumi', 'a.lumi', 'b.lumi']);
    expect(new Set(session.current!.openTabIds).size).toBe(3);
    await session.deleteFile(session.current!.activeFileId);
    expect(session.current!.openTabIds).toContain(session.current!.activeFileId);
  });
});
