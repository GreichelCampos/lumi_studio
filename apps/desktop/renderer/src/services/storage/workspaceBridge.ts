import type { LumiProject } from '../../types';

export type WorkspaceReply<T> = { ok: true; value: T } | { ok: false; message: string };
export interface WorkspaceBridge {
  list(): Promise<WorkspaceReply<LumiProject[]>>;
  chooseLocation(): Promise<WorkspaceReply<string | null>>;
  open(): Promise<WorkspaceReply<LumiProject | null>>;
  importProject(project: LumiProject, location: string): Promise<WorkspaceReply<LumiProject>>;
  create(data: { name: string; location: string; description?: string }): Promise<WorkspaceReply<LumiProject>>;
  save(project: LumiProject): Promise<WorkspaceReply<void>>;
  rename(id: string, name: string): Promise<WorkspaceReply<LumiProject>>;
  saveAs(id: string, fileId: string, content: string): Promise<WorkspaceReply<LumiProject | null>>;
  remove(id: string): Promise<WorkspaceReply<boolean>>;
  lastActive(id?: string | null): Promise<WorkspaceReply<string | null>>;
}

declare global { interface Window { lumiWorkspace?: WorkspaceBridge } }
