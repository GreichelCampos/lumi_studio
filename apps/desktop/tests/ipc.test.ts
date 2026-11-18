import { describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { validateInput } from '../electron/requestValidation';
import { localRendererUrl, trustedFrame, contentSecurityPolicy } from '../electron/security';
import { PythonWorker } from '../electron/pythonWorker';

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const writeText = vi.hoisted(() => vi.fn());
vi.mock('electron', () => ({ clipboard: { writeText }, ipcMain: {
  handle: (channel: string, handler: (...args: unknown[]) => unknown) => handlers.set(channel, handler),
  removeHandler: (channel: string) => handlers.delete(channel),
} }));
import { registerIpc } from '../electron/ipc';

describe('IPC boundary', () => {
  it.each([null, {}, { entryFile: 'x', files: {} }, { entryFile: 'x', files: { x: 1 } },
    { entryFile: 'x', files: { x: 'a'.repeat(262145) } },
    { entryFile: 'x', files: { x: '' }, command: 'whoami' },
  ])('rejects malformed input', (input) => { expect(() => validateInput(input)).toThrow(); });

  it('authorizes only the known window and its main frame', async () => {
    const mainFrame = { url: 'http://127.0.0.1:5173/' };
    const window = { webContents: { mainFrame } } as unknown as BrowserWindow;
    const worker = new PythonWorker({ root: '.' });
    const request = vi.spyOn(worker, 'request').mockRejectedValue(new Error('test transport'));
    const dispose = registerIpc(window, worker, new URL(mainFrame.url));
    const handler = handlers.get('lumi:analyze')!;
    const valid = { entryFile: 'a.lumi', files: { 'a.lumi': '' } };
    const event = { sender: window.webContents, senderFrame: mainFrame } as unknown as IpcMainInvokeEvent;
    expect(await handler(event, valid)).toMatchObject({ ok: false, error: { message: 'test transport' } });
    expect(request).toHaveBeenCalledOnce();
    expect(await handler({ ...event, sender: {} }, valid)).toMatchObject({ ok: false, error: { code: 'UNTRUSTED_SENDER' } });
    expect(await handler({ ...event, senderFrame: { url: mainFrame.url } }, valid)).toMatchObject({ ok: false });
    expect(request).toHaveBeenCalledOnce();
    dispose(); expect(handlers.size).toBe(0);
  });

  it('copies only text from the authorized renderer', () => {
    const mainFrame = { url: 'http://127.0.0.1:5173/' };
    const window = { webContents: { mainFrame } } as unknown as BrowserWindow;
    const worker = new PythonWorker({ root: '.' });
    const dispose = registerIpc(window, worker, new URL(mainFrame.url));
    try {
      const handler = handlers.get('lumi:copyText')!;
      const event = { sender: window.webContents, senderFrame: mainFrame };
      handler(event, 'principal {}');
      expect(writeText).toHaveBeenCalledWith('principal {}');
      expect(() => handler({ ...event, sender: {} }, 'secret')).toThrow();
      expect(() => handler(event, {})).toThrow();
      expect(() => handler(event, 'a'.repeat(262145))).toThrow();
      expect(writeText).toHaveBeenCalledTimes(1);
    } finally { dispose(); }
  });

  it('restricts renderer URL and script policy', () => {
    const url = localRendererUrl('http://127.0.0.1:5173/');
    expect(trustedFrame('https://example.com/', url)).toBe(false);
    expect(trustedFrame('http://127.0.0.1:5173/other', url)).toBe(false);
    expect(() => localRendererUrl('https://example.com/')).toThrow();
    expect(() => localRendererUrl('file:///tmp/a')).toThrow();
    expect(contentSecurityPolicy(url, 'abc123')).toContain("script-src 'self' 'nonce-abc123'");
  });
});
