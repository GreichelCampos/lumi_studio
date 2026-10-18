import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  chooseFolder: vi.fn(async () => ({ canceled: true, filePaths: [] })),
  confirm: vi.fn(() => 0),
}));
vi.mock('electron', () => ({
  app: { getPath: () => 'unused-profile', getAppPath: () => 'unused-app' },
  dialog: { showOpenDialog: mocks.chooseFolder, showMessageBoxSync: mocks.confirm },
  shell: { trashItem: vi.fn() },
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => mocks.handlers.set(channel, handler),
    removeHandler: (channel: string) => mocks.handlers.delete(channel),
  },
}));
import { registerWorkspaceIpc } from '../electron/workspaceIpc';
afterEach(() => { mocks.handlers.clear(); vi.clearAllMocks(); });

function setup() {
  const contents = Object.assign(new EventEmitter(), { mainFrame: { url: 'http://127.0.0.1:5173/' } });
  const window = { webContents: contents } as unknown as BrowserWindow;
  const service = registerWorkspaceIpc(window, new URL(contents.mainFrame.url));
  const event = { sender: contents, senderFrame: contents.mainFrame };
  const invoke = (name: string, ...args: unknown[]) => mocks.handlers.get(`lumi:workspace:${name}`)!(event, ...args);
  return { event, contents, service, invoke };
}

describe('workspace IPC', () => {
  it('rejects foreign windows, subframes and changed origins before showing dialogs', async () => {
    const { event, contents, service, invoke } = setup();
    const open = mocks.handlers.get('lumi:workspace:open')!;
    for (const invalid of [{ ...event, sender: {} }, { ...event, senderFrame: null },
      { ...event, senderFrame: { url: contents.mainFrame.url } }]) {
      expect(await open(invalid)).toEqual({ ok: false, message: 'Origen IPC no autorizado.' });
    }
    contents.mainFrame.url = 'https://example.com/';
    expect(await invoke('open')).toMatchObject({ ok: false });
    expect(mocks.chooseFolder).not.toHaveBeenCalled();
    service.dispose();
  });
  it('accepts cancellation and rejects malformed or excessive arguments', async () => {
    const { invoke, service } = setup();
    expect(await invoke('open')).toEqual({ ok: true, value: null });
    for (const [name, args] of [['open', ['arbitrary-directory']], ['create', [null]],
      ['save', []], ['rename', [null, 'name']], ['saveAs', ['id', 'file', 3]], ['lastActive', [1]]] as const) {
      expect(await invoke(name, ...args)).toMatchObject({ ok: false });
    }
    await service.flush(); service.dispose();
    expect(mocks.handlers.size).toBe(0);
  });
  it('defaults to keeping unsaved work and permits native close only after explicit discard', () => {
    const { contents, service } = setup();
    const event = { preventDefault: vi.fn() };
    contents.emit('will-prevent-unload', event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    mocks.confirm.mockReturnValue(1);
    contents.emit('will-prevent-unload', event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    service.dispose();
  });
});
