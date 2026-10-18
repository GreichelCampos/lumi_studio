import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import { APP_USER_MODEL_ID, applicationIconPath, configureWindowsTaskbar } from '../electron/appIdentity';

const temporary: string[] = [];
afterEach(() => temporary.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })));

describe('official application identity', () => {
  it('resolves development resources independently of the working directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'lumi-icon-')); temporary.push(root);
    const icon = join(root, 'resources', 'lumi-taskbar-adapted.ico');
    mkdirSync(dirname(icon)); writeFileSync(icon, 'test');
    expect(applicationIconPath(false, root, 'unused')).toBe(icon);
  });

  it('resolves packaged resources outside ASAR and reports a missing resource', () => {
    const resources = mkdtempSync(join(tmpdir(), 'lumi-icon-')); temporary.push(resources);
    expect(() => applicationIconPath(true, 'unused/app.asar', resources)).toThrow('ícono oficial');
    const icon = join(resources, 'lumi', 'lumi-taskbar-adapted.ico');
    mkdirSync(dirname(icon)); writeFileSync(icon, 'test');
    expect(applicationIconPath(true, 'unused/app.asar', resources)).toBe(icon);
  });

  it('sets the taskbar identity and explicit official icon', () => {
    const setAppDetails = vi.fn();
    configureWindowsTaskbar({ setAppDetails } as unknown as BrowserWindow, 'official.ico');
    expect(setAppDetails).toHaveBeenCalledWith({
      appId: APP_USER_MODEL_ID, appIconPath: 'official.ico', appIconIndex: 0,
    });
  });

  it('contains seven valid 32-bit PNG frames with the requested dimensions', () => {
    const icon = readFileSync(new URL('../resources/lumi-taskbar-adapted.ico', import.meta.url));
    expect(icon.readUInt16LE(0)).toBe(0);
    expect(icon.readUInt16LE(2)).toBe(1);
    expect(icon.readUInt16LE(4)).toBe(7);
    let expectedOffset = 6 + 16 * 7;
    [16, 24, 32, 48, 64, 128, 256].forEach((size, index) => {
      const entry = 6 + index * 16;
      expect(icon[entry] || 256).toBe(size);
      expect(icon[entry + 1] || 256).toBe(size);
      expect(icon.readUInt16LE(entry + 4)).toBe(1);
      expect(icon.readUInt16LE(entry + 6)).toBe(32);
      const offset = icon.readUInt32LE(entry + 12);
      const length = icon.readUInt32LE(entry + 8);
      expect(offset).toBe(expectedOffset);
      expect(icon.subarray(offset, offset + 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(icon.readUInt32BE(offset + 16)).toBe(size);
      expect(icon.readUInt32BE(offset + 20)).toBe(size);
      expect(icon[offset + 24]).toBe(8); // Eight bits per RGBA channel.
      expect(icon[offset + 25]).toBe(6); // PNG truecolor with alpha.
      expectedOffset += length;
    });
    expect(expectedOffset).toBe(icon.length);
  });
});
