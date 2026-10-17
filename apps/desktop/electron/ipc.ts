import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { backendError, WorkerError } from './backendError';
import { validateInput } from './requestValidation';
import { trustedFrame } from './security';
import type { PythonWorker } from './pythonWorker';

export function registerIpc(window: BrowserWindow, worker: PythonWorker, renderer: URL): () => void {
  function authorize(event: IpcMainInvokeEvent): void {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame
      || !trustedFrame(event.senderFrame.url, renderer)) {
      throw new WorkerError('UNTRUSTED_SENDER', 'Origen IPC no autorizado.');
    }
  }
  for (const operation of ['analyze', 'execute'] as const) {
    ipcMain.handle(`lumi:${operation}`, async (event, raw: unknown) => {
      try {
        authorize(event);
        const input = validateInput(raw);
        return { ok: true, response: await worker.request(operation, input) };
      } catch (error) { return { ok: false, error: backendError(error) }; }
    });
  }
  ipcMain.handle('lumi:availability', (event) => {
    authorize(event); return worker.availability();
  });
  return () => {
    for (const channel of ['lumi:analyze', 'lumi:execute', 'lumi:availability']) ipcMain.removeHandler(channel);
  };
}
