import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { atomicWrite } from '../electron/workspaces/safeFiles';
import { WorkspaceMetadata } from '../electron/workspaces/workspaceMetadata';

let root: string;
let child: ChildProcessWithoutNullStreams | undefined;
async function lock(path: string) {
  child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    "$h=[IO.File]::Open($env:LUMI_LOCK_TARGET,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite); Write-Output 'READY'; [Console]::In.ReadLine() | Out-Null; $h.Dispose()"],
  { env: { ...process.env, LUMI_LOCK_TARGET: path }, windowsHide: true });
  const lockProcess = child;
  await new Promise<void>((resolve, reject) => {
    lockProcess.stdout.once('data', () => resolve());
    lockProcess.once('error', reject);
    lockProcess.once('exit', code => { if (code) reject(new Error(`Lock process exited: ${code}`)); });
  });
}
async function release() {
  const lockProcess = child; child = undefined;
  if (!lockProcess || lockProcess.exitCode !== null) return;
  const closed = new Promise<void>(resolve => lockProcess.once('close', () => resolve()));
  lockProcess.stdin.end('\n');
  await closed;
}

describe.runIf(process.platform === 'win32')('real Windows replacement contention', () => {
  beforeEach(async () => { root = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'lumi-native-write-'))); });
  afterEach(async () => { await release(); await fs.rm(root, { recursive: true, force: true }); });
  it('saves after a temporary lock releases without deleting the destination', async () => {
    const path = join(root, 'source.lumi');
    await fs.writeFile(path, 'original'); await lock(path);
    const unlocking = setTimeout(100).then(release);
    await atomicWrite(path, 'replacement'); await unlocking;
    expect(await fs.readFile(path, 'utf8')).toBe('replacement');
    expect(await fs.readdir(root)).toEqual(['source.lumi']);
  });
  it('fails bounded permanent lock contention and preserves the source', async () => {
    const path = join(root, 'source.lumi');
    await fs.writeFile(path, 'original'); await lock(path);
    const start = Date.now();
    await expect(atomicWrite(path, 'replacement')).rejects.toMatchObject({ code: 'EPERM' });
    expect(Date.now() - start).toBeLessThan(3000);
    expect(await fs.readFile(path, 'utf8')).toBe('original');
    expect(await fs.readdir(root)).toEqual(['source.lumi']);
  });
  it('does not overwrite an external edit made during the lock wait', async () => {
    const path = join(root, 'source.lumi');
    await fs.writeFile(path, 'original'); await lock(path);
    const editing = setTimeout(10).then(() => fs.writeFile(path, 'external'));
    await expect(atomicWrite(path, 'replacement')).rejects.toThrow('cambió'); await editing;
    expect(await fs.readFile(path, 'utf8')).toBe('external');
    expect(await fs.readdir(root)).toEqual(['source.lumi']);
  });
  it('persists metadata after a brief lock and rejects a later external change', async () => {
    const metadata = new WorkspaceMetadata(root);
    await metadata.load(); await metadata.persist();
    const path = join(root, 'workspaces.json');
    await lock(path);
    const unlocking = setTimeout(100).then(release);
    metadata.state.lastActive = 'project';
    await metadata.persist(); await unlocking;
    expect(JSON.parse(await fs.readFile(path, 'utf8')).lastActive).toBe('project');
    const external = '{"version":1,"projects":[],"lastActive":"external"}';
    await fs.writeFile(path, external);
    await expect(metadata.persist()).rejects.toThrow('metadatos cambiaron');
    expect(await fs.readFile(path, 'utf8')).toBe(external);
  });
});
