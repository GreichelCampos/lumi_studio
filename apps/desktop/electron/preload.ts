import { contextBridge, ipcRenderer } from 'electron';
import type { BackendInput, DesktopBridge } from '../renderer/src/services/integration/desktopBridge';
import type { WindowControlsBridge } from '../renderer/src/windowBridge';
import type { WorkspaceBridge } from '../renderer/src/services/storage/workspaceBridge';

const bridge: DesktopBridge = Object.freeze({
  analyze: (input: BackendInput) => ipcRenderer.invoke('lumi:analyze', input),
  execute: (input: BackendInput) => ipcRenderer.invoke('lumi:execute', input),
  availability: () => ipcRenderer.invoke('lumi:availability'),
});
contextBridge.exposeInMainWorld('lumiDesktop', bridge);

const windowControls: WindowControlsBridge = Object.freeze({
  minimize: () => ipcRenderer.invoke('lumi:window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('lumi:window:toggleMaximize'),
  close: () => ipcRenderer.invoke('lumi:window:close'),
  isMaximized: () => ipcRenderer.invoke('lumi:window:isMaximized'),
  onMaximizedChange: (listener: (maximized: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, value: unknown) => {
      if (typeof value === 'boolean') listener(value);
    };
    ipcRenderer.on('lumi:window:maximized', handler);
    return () => { ipcRenderer.removeListener('lumi:window:maximized', handler); };
  },
});
contextBridge.exposeInMainWorld('lumiWindow', windowControls);

const workspace = Object.freeze<WorkspaceBridge>({
  list: () => ipcRenderer.invoke('lumi:workspace:list'),
  chooseLocation: () => ipcRenderer.invoke('lumi:workspace:chooseLocation'),
  open: () => ipcRenderer.invoke('lumi:workspace:open'),
  importProject: (project, location) => ipcRenderer.invoke('lumi:workspace:importProject', project, location),
  create: data => ipcRenderer.invoke('lumi:workspace:create', data),
  save: project => ipcRenderer.invoke('lumi:workspace:save', project),
  rename: (id, name) => ipcRenderer.invoke('lumi:workspace:rename', id, name),
  saveAs: (id, fileId, content) => ipcRenderer.invoke('lumi:workspace:saveAs', id, fileId, content),
  remove: id => ipcRenderer.invoke('lumi:workspace:remove', id),
  lastActive: (...args: [] | [string | null]) => ipcRenderer.invoke('lumi:workspace:lastActive', ...args),
});
contextBridge.exposeInMainWorld('lumiWorkspace', workspace);
