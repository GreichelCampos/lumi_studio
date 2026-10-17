import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
vi.mock('electron', () => ({ ipcMain: {
  handle: (channel: string, handler: (...args: unknown[]) => unknown) => handlers.set(channel, handler),
  removeHandler: (channel: string) => handlers.delete(channel),
} }));
import { registerWindowControls } from '../electron/windowControls';

afterEach(() => handlers.clear());

function fixture() {
  let maximized = false;
  const window = Object.assign(new EventEmitter(), {
    webContents: { mainFrame: { url: 'http://127.0.0.1:5173/' }, isDestroyed: () => false, send: vi.fn() },
    minimize: vi.fn(), close: vi.fn(), isMaximized: () => maximized,
    maximize: vi.fn(() => { maximized = true; window.emit('maximize'); }),
    unmaximize: vi.fn(() => { maximized = false; window.emit('unmaximize'); }),
  });
  const dispose = registerWindowControls(window as unknown as BrowserWindow, new URL(window.webContents.mainFrame.url));
  const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame } as unknown as IpcMainInvokeEvent;
  const invoke = (name: string, ...args: unknown[]) => handlers.get(`lumi:window:${name}`)!(event, ...args);
  return { window, event, invoke, dispose };
}

describe('limited window controls', () => {
  it('minimizes, toggles maximization, publishes native changes and closes', () => {
    const { window, invoke } = fixture();
    expect(invoke('isMaximized')).toBe(false);
    invoke('minimize'); expect(window.minimize).toHaveBeenCalledOnce();
    expect(invoke('toggleMaximize')).toBe(true);
    expect(window.webContents.send).toHaveBeenLastCalledWith('lumi:window:maximized', true);
    expect(invoke('toggleMaximize')).toBe(false);
    expect(window.webContents.send).toHaveBeenLastCalledWith('lumi:window:maximized', false);
    invoke('close'); expect(window.close).toHaveBeenCalledOnce();
  });

  it('rejects other windows, subframes, navigated origins and arguments', () => {
    const { window, event, invoke } = fixture();
    const handler = handlers.get('lumi:window:close')!;
    for (const invalid of [{ ...event, sender: {} }, { ...event, senderFrame: null },
      { ...event, senderFrame: { url: window.webContents.mainFrame.url } }]) {
      expect(() => handler(invalid)).toThrow('Origen IPC no autorizado');
    }
    expect(() => invoke('close', 'unexpected')).toThrow('no aceptan argumentos');
    window.webContents.mainFrame.url = 'https://example.com/';
    expect(() => invoke('close')).toThrow('Origen IPC no autorizado');
    expect(window.close).not.toHaveBeenCalled();
  });

  it('removes handlers and native listeners when disposed', () => {
    const { window, dispose } = fixture();
    dispose();
    expect(handlers.size).toBe(0);
    expect(window.listenerCount('maximize')).toBe(0);
    expect(window.listenerCount('unmaximize')).toBe(0);
  });
});
