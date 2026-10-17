import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWrite, isMissing, sourcePath } from './safeFiles';

export interface WorkspaceRecord {
  id: string;
  root: string;
  description: string;
  fileIds: Record<string, string>;
  entryPath?: string;
  activePath?: string;
  tabPaths: string[];
  createdAt: string;
}
interface WorkspaceState { version: 1; projects: WorkspaceRecord[]; lastActive: string | null }

export class WorkspaceMetadata {
  state: WorkspaceState = { version: 1, projects: [], lastActive: null };
  private loaded = false;
  constructor(private readonly directory: string) {}

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw: unknown = JSON.parse(await fs.readFile(join(this.directory, 'workspaces.json'), 'utf8'));
      if (!raw || typeof raw !== 'object' || !('version' in raw) || raw.version !== 1
        || !('projects' in raw) || !Array.isArray(raw.projects) || !('lastActive' in raw)
        || (raw.lastActive !== null && typeof raw.lastActive !== 'string')) throw new Error('Metadatos del IDE no válidos.');
      for (const record of raw.projects) {
        if (!record || typeof record.id !== 'string' || typeof record.root !== 'string'
          || typeof record.description !== 'string' || typeof record.createdAt !== 'string'
          || !record.fileIds || typeof record.fileIds !== 'object' || Array.isArray(record.fileIds)
          || !Array.isArray(record.tabPaths) || record.tabPaths.some((path: unknown) => typeof path !== 'string')
          || Object.values(record.fileIds).some(id => typeof id !== 'string')) throw new Error('Metadatos del IDE no válidos.');
        Object.keys(record.fileIds).forEach(sourcePath);
        record.tabPaths.forEach(sourcePath);
        if (record.entryPath !== undefined) sourcePath(record.entryPath);
        if (record.activePath !== undefined) sourcePath(record.activePath);
      }
      this.state = raw as WorkspaceState;
    } catch (error) { if (!isMissing(error)) throw error; }
    this.loaded = true;
  }

  async persist(): Promise<void> {
    await fs.mkdir(this.directory, { recursive: true });
    await atomicWrite(join(this.directory, 'workspaces.json'), JSON.stringify(this.state, null, 2));
  }
}
