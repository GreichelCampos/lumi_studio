import { app, BrowserWindow, Menu, session } from 'electron';
import { join, resolve } from 'node:path';
import { PythonWorker } from './pythonWorker';
import { workerTimeout } from './pythonConfig';
import { registerIpc } from './ipc';
import { contentSecurityPolicy, localRendererUrl } from './security';
import { registerWindowControls } from './windowControls';
import { registerWorkspaceIpc } from './workspaceIpc';
import { APP_USER_MODEL_ID, applicationIconPath, configureWindowsTaskbar } from './appIdentity';

if (process.platform === 'win32') app.setAppUserModelId(APP_USER_MODEL_ID);

const root = resolve(__dirname, '../../..');
const renderer = localRendererUrl(process.env.LUMI_RENDERER_URL ?? 'http://127.0.0.1:5173/');
const worker = new PythonWorker({ root, timeoutMs: workerTimeout(), log: (text) => process.stderr.write(text) });
let closed = false;
let quitting = false;
let flushWorkspace = async (): Promise<void> => undefined;
process.on('message', (message: unknown) => {
  if (message && typeof message === 'object' && 'type' in message && message.type === 'shutdown') app.quit();
});
process.on('SIGINT', () => app.quit());
process.on('SIGTERM', () => app.quit());

app.whenReady().then(async () => {
  const icon = applicationIconPath(app.isPackaged, app.getAppPath(), process.resourcesPath);
  Menu.setApplicationMenu(null);
  const policy = contentSecurityPolicy(renderer, process.env.LUMI_CSP_NONCE ?? '');
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => callback({
    responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [policy] },
  }));
  const window = new BrowserWindow({
    width: 1440, height: 960, title: 'Estudio Lumi', frame: false, resizable: true, icon,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'), contextIsolation: true,
      nodeIntegration: false, sandbox: true, webSecurity: true,
    },
  });
  if (process.platform === 'win32') configureWindowsTaskbar(window, icon);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, target) => {
    if (target !== renderer.href) event.preventDefault();
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  const dispose = registerIpc(window, worker, renderer);
  const disposeControls = registerWindowControls(window, renderer);
  const workspace = registerWorkspaceIpc(window, renderer);
  flushWorkspace = workspace.flush;
  window.once('closed', dispose);
  window.once('closed', disposeControls);
  window.once('closed', workspace.dispose);
  try { await worker.start(); } catch (error) { console.error('Backend Python no disponible:', error); }
  await window.loadURL(renderer.href);
  console.log('Estudio Lumi iniciado.');
}).catch((error: unknown) => { console.error(error); app.quit(); });

app.on('window-all-closed', () => app.quit());
app.on('before-quit', (event) => {
  if (closed) return;
  event.preventDefault();
  const windows = BrowserWindow.getAllWindows();
  if (windows.length) { windows.forEach(window => window.close()); return; }
  if (quitting) return;
  quitting = true;
  void flushWorkspace().then(() => worker.close()).finally(() => { closed = true; app.quit(); });
});
