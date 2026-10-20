import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { atomicWrite } from '../electron/workspaces/safeFiles';

vi.mock('node:fs/promises', async original => ({ ...await original<typeof import('node:fs/promises')>() }));
vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn(async () => undefined) }));

const denied = () => Object.assign(new Error('Replacement denied'), { code: 'EPERM' });
let root: string;
let path: string;
beforeEach(async () => {
  vi.mocked(setTimeout).mockReset().mockResolvedValue(undefined);
  root = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'lumi-atomic-test-')));
  path = join(root, 'source.lumi');
  await fs.writeFile(path, 'original');
});
afterEach(async () => { vi.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true }); });

describe('atomic replacement', () => {
  it('writes the complete content and removes its temporary', async () => {
    await atomicWrite(path, 'replacement');
    expect(await fs.readFile(path, 'utf8')).toBe('replacement');
    expect(await fs.readdir(root)).toEqual(['source.lumi']);
  });
  it.runIf(process.platform === 'win32')('retries transient failures with bounded progressive delays', async () => {
    const rename = vi.spyOn(fs, 'rename').mockRejectedValueOnce(denied()).mockRejectedValueOnce(denied());
    await atomicWrite(path, 'replacement');
    expect(rename).toHaveBeenCalledTimes(3);
    expect(vi.mocked(setTimeout).mock.calls.map(call => call[0])).toEqual([25, 50]);
    expect(await fs.readFile(path, 'utf8')).toBe('replacement');
  });
  it.runIf(process.platform === 'win32')('fails permanent denial after six attempts and keeps the original', async () => {
    const error = denied();
    const rename = vi.spyOn(fs, 'rename').mockRejectedValue(error);
    await expect(atomicWrite(path, 'replacement')).rejects.toBe(error);
    expect(rename).toHaveBeenCalledTimes(6);
    expect(vi.mocked(setTimeout).mock.calls.map(call => call[0])).toEqual([25, 50, 100, 200, 400]);
    expect(await fs.readFile(path, 'utf8')).toBe('original');
    expect(await fs.readdir(root)).toEqual(['source.lumi']);
  });
  it('propagates unexpected replacement errors without retrying', async () => {
    const error = Object.assign(new Error('Disk failure'), { code: 'EIO' });
    vi.spyOn(fs, 'rename').mockRejectedValue(error);
    await expect(atomicWrite(path, 'replacement')).rejects.toBe(error);
    expect(setTimeout).not.toHaveBeenCalled();
  });
  it.runIf(process.platform === 'win32')('does not retry a read-only destination', async () => {
    await fs.chmod(path, 0o444);
    try {
      await expect(atomicWrite(path, 'replacement')).rejects.toMatchObject({ code: 'EPERM' });
      expect(setTimeout).not.toHaveBeenCalled();
      expect(await fs.readFile(path, 'utf8')).toBe('original');
    } finally { await fs.chmod(path, 0o666); }
  });
  it.runIf(process.platform === 'win32')('does not overwrite content changed while waiting', async () => {
    const rename = vi.spyOn(fs, 'rename').mockRejectedValueOnce(denied());
    vi.mocked(setTimeout).mockImplementationOnce(async () => { await fs.writeFile(path, 'external'); });
    await expect(atomicWrite(path, 'replacement')).rejects.toThrow('cambió');
    expect(rename).toHaveBeenCalledTimes(1);
    expect(await fs.readFile(path, 'utf8')).toBe('external');
    expect(await fs.readdir(root)).toEqual(['source.lumi']);
  });
  it.runIf(process.platform === 'win32')('detects replacement by another file with identical text', async () => {
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(denied());
    vi.mocked(setTimeout).mockImplementationOnce(async () => {
      const external = join(root, 'external');
      await fs.writeFile(external, 'original');
      await fs.rename(external, path);
    });
    await expect(atomicWrite(path, 'replacement')).rejects.toThrow('cambió');
    expect(await fs.readFile(path, 'utf8')).toBe('original');
  });
  it.runIf(process.platform === 'win32')('aborts when the parent directory is replaced without deleting foreign files', async () => {
    const folder = join(root, 'project');
    await fs.mkdir(folder);
    path = join(folder, 'source.lumi');
    await fs.writeFile(path, 'original');
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(denied());
    vi.mocked(setTimeout).mockImplementationOnce(async () => {
      await fs.rename(folder, join(root, 'moved'));
      await fs.mkdir(folder);
      await fs.writeFile(path, 'external');
    });
    await expect(atomicWrite(path, 'replacement')).rejects.toMatchObject({
      message: expect.stringContaining('cambió'), cause: expect.objectContaining({ message: expect.stringContaining('temporal') }),
    });
    expect(await fs.readFile(path, 'utf8')).toBe('external');
    expect(await fs.readFile(join(root, 'moved/source.lumi'), 'utf8')).toBe('original');
    expect(await fs.readdir(folder)).toEqual(['source.lumi']);
  });
  it('retains the primary failure when cleanup also fails', async () => {
    const error = Object.assign(new Error('Disk failure'), { code: 'EIO' });
    const cleanup = Object.assign(new Error('Cleanup denied'), { code: 'EACCES' });
    vi.spyOn(fs, 'rename').mockRejectedValue(error);
    vi.spyOn(fs, 'unlink').mockRejectedValue(cleanup);
    await expect(atomicWrite(path, 'replacement')).rejects.toBe(error);
    expect(error.cause).toBe(cleanup);
    expect(await fs.readFile(path, 'utf8')).toBe('original');
  });
  it.runIf(process.platform === 'win32')('validates the caller expectation before every attempt', async () => {
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(denied());
    const check = vi.fn(async () => undefined);
    await atomicWrite(path, 'replacement', check);
    expect(check).toHaveBeenCalledTimes(3);
  });
});
