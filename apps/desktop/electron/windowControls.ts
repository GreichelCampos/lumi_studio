import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { trustedFrame } from './security';

/** Only the owning window's trusted main frame can operate its controls. */
export function registerWindowControls(window: BrowserWindow, renderer: URL): () => void {
  const operations = {
    minimize: () => { window.minimize(); },
    toggleMaximize: () => {
      if (window.isMaximized()) window.unmaximize(); else window.maximize();
      return window.isMaximized();
    },
    close: () => { window.close(); },
    isMaximized: () => window.isMaximized(),
  };
  const channels = Object.entries(operations).map(([name, operation]) => {
    const channel = `lumi:window:${name}`;
    ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame
        || !event.senderFrame || !trustedFrame(event.senderFrame.url, renderer)) {
        throw new Error('Origen IPC no autorizado.');
      }
      if (args.length !== 0) throw new Error('Los controles de ventana no aceptan argumentos.');
      return operation();
    });
    return channel;
  });
  const notify = () => {
    if (!window.webContents.isDestroyed()) {
      window.webContents.send('lumi:window:maximized', window.isMaximized());
    }
  };
  window.on('maximize', notify);
  window.on('unmaximize', notify);
  return () => {
    channels.forEach((channel) => ipcMain.removeHandler(channel));
    window.removeListener('maximize', notify);
    window.removeListener('unmaximize', notify);
  };
}
