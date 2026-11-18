import { clipboard, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { backendError, WorkerError } from './backendError';
import { validateInput } from './requestValidation';
import { trustedFrame } from './security';
import type { PythonWorker } from './pythonWorker';
import type { InputPrompt } from '../renderer/src/services/integration/desktopBridge';

export function registerIpc(window: BrowserWindow, worker: PythonWorker, renderer: URL): () => void {
  function authorize(event: IpcMainInvokeEvent): void {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame
      || !trustedFrame(event.senderFrame.url, renderer)) {
      throw new WorkerError('UNTRUSTED_SENDER', 'Origen IPC no autorizado.');
    }
  }
  ipcMain.handle('lumi:copyText', (event, text: unknown) => {
    authorize(event);
    if (typeof text !== 'string' || text.length > 262_144) {
      throw new WorkerError('INVALID_IPC_INPUT', 'El texto para copiar no es válido.');
    }
    clipboard.writeText(text);
  });
  for (const operation of ['analyze', 'execute'] as const) {
    ipcMain.handle(`lumi:${operation}`, async (event, raw: unknown, interactive?: unknown) => {
      try {
        authorize(event);
        const input = validateInput(raw);
        const onInput = operation === 'execute' && interactive === true
          ? (prompt: InputPrompt | null) => {
              const currentFrame = window.webContents.isDestroyed() ? null : window.webContents.mainFrame;
              if (currentFrame && currentFrame === event.senderFrame && trustedFrame(currentFrame.url, renderer)) {
                currentFrame.send('lumi:inputPrompt', prompt);
              }
            }
          : undefined;
        return { ok: true, response: await worker.request(operation, input, onInput) };
      } catch (error) { return { ok: false, error: backendError(error) }; }
    });
  }
  ipcMain.handle('lumi:replyInput', (event, raw: unknown) => {
    try {
      authorize(event);
      worker.replyInput(raw);
      return { ok: true };
    } catch (error) { return { ok: false, error: backendError(error) }; }
  });
  ipcMain.handle('lumi:availability', (event) => {
    authorize(event); return worker.availability();
  });
  return () => {
    for (const channel of ['lumi:copyText', 'lumi:analyze', 'lumi:execute', 'lumi:availability', 'lumi:replyInput']) ipcMain.removeHandler(channel);
  };
}
