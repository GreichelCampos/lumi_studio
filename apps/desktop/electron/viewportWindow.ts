import { BrowserWindow, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import { join } from 'node:path';
import type { ViewportSelection, ViewportWindowState } from '../renderer/src/viewportBridge';
import { trustedFrame } from './security';

export function registerViewportWindow(owner: BrowserWindow, renderer: URL, icon: string): () => void {
  let viewport: BrowserWindow | null = null;
  let state: ViewportWindowState | null = null;

  const isOwner = (event: IpcMainEvent | IpcMainInvokeEvent) =>
    event.sender === owner.webContents && event.senderFrame === owner.webContents.mainFrame
    && !!event.senderFrame && trustedFrame(event.senderFrame.url, renderer);
  const isViewport = (event: IpcMainEvent | IpcMainInvokeEvent) =>
    !!viewport && event.sender === viewport.webContents && event.senderFrame === viewport.webContents.mainFrame
    && !!event.senderFrame && trustedFrame(event.senderFrame.url, renderer);

  const sendState = () => {
    if (viewport && state && !viewport.webContents.isDestroyed()) viewport.webContents.send('lumi:viewport:state', state);
  };
  const create = async () => {
    if (viewport && !viewport.isDestroyed()) return viewport;
    viewport = new BrowserWindow({
      width: 1100, height: 760, minWidth: 640, minHeight: 420,
      title: 'Visualizador 3D — Estudio Lumi', resizable: true, minimizable: true,
      maximizable: true, icon,
      webPreferences: {
        preload: join(__dirname, 'preload.cjs'), contextIsolation: true,
        nodeIntegration: false, sandbox: true, webSecurity: true,
      },
    });
    viewport.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    viewport.on('page-title-updated', event => {
      event.preventDefault();
      viewport?.setTitle('Visualizador 3D — Estudio Lumi');
    });
    viewport.webContents.on('will-navigate', event => event.preventDefault());
    viewport.webContents.on('will-attach-webview', event => event.preventDefault());
    viewport.webContents.on('did-finish-load', sendState);
    viewport.on('closed', () => {
      if (state && !owner.isDestroyed()) {
        owner.webContents.send('lumi:viewport:selected', { sessionId: state.sessionId, objectId: null });
      }
      viewport = null;
      state = null;
    });
    const url = new URL(renderer.href);
    url.searchParams.set('window', 'viewport');
    await viewport.loadURL(url.href);
    return viewport;
  };

  ipcMain.handle('lumi:viewport:show', async (event, next: ViewportWindowState) => {
    if (!isOwner(event)) throw new Error('Origen IPC no autorizado.');
    state = next;
    const target = await create();
    sendState();
    if (target.isMinimized()) target.restore();
    target.show(); target.focus();
  });
  ipcMain.on('lumi:viewport:update', (event, next: ViewportWindowState) => {
    if (!isOwner(event)) return;
    if (!state || next.sessionId !== state.sessionId) return;
    state = next; sendState();
  });
  ipcMain.on('lumi:viewport:selected', (event, selection: ViewportSelection) => {
    if (!isViewport(event) || !state || !selection || selection.sessionId !== state.sessionId
      || (selection.objectId !== null && typeof selection.objectId !== 'string')) return;
    if (!owner.isDestroyed()) owner.webContents.send('lumi:viewport:selected', selection);
  });

  return () => {
    ipcMain.removeHandler('lumi:viewport:show');
    ipcMain.removeAllListeners('lumi:viewport:update');
    ipcMain.removeAllListeners('lumi:viewport:selected');
    if (viewport && !viewport.isDestroyed()) viewport.destroy();
    viewport = null; state = null;
  };
}
