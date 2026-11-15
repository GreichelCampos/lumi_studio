import { contextBridge, ipcRenderer } from 'electron';
import type { BackendInput, DesktopBridge, InputPrompt, InputReply } from '../renderer/src/services/integration/desktopBridge';
import type { WindowControlsBridge } from '../renderer/src/windowBridge';
import type { WorkspaceBridge } from '../renderer/src/services/storage/workspaceBridge';
import type { ViewportSelection, ViewportWindowBridge, ViewportWindowState } from '../renderer/src/viewportBridge';

const bridge: DesktopBridge = Object.freeze({
  analyze: (input: BackendInput) => ipcRenderer.invoke('lumi:analyze', input),
  execute: (input: BackendInput, interactive?: boolean) => ipcRenderer.invoke('lumi:execute', input, interactive),
  onInputPrompt: (listener: (prompt: InputPrompt | null) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, prompt: InputPrompt | null) => listener(prompt);
    ipcRenderer.on('lumi:inputPrompt', handler);
    return () => { ipcRenderer.removeListener('lumi:inputPrompt', handler); };
  },
  replyInput: (reply: InputReply) => ipcRenderer.invoke('lumi:replyInput', reply),
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

const viewport: ViewportWindowBridge = Object.freeze({
  show: (state: ViewportWindowState) => ipcRenderer.invoke('lumi:viewport:show', state),
  update: (state: ViewportWindowState) => ipcRenderer.send('lumi:viewport:update', state),
  clear: () => ipcRenderer.send('lumi:viewport:clear'),
  onState: (listener: (state: ViewportWindowState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: ViewportWindowState) => listener(state);
    ipcRenderer.on('lumi:viewport:state', handler);
    return () => { ipcRenderer.removeListener('lumi:viewport:state', handler); };
  },
  selectObject: (selection: ViewportSelection) => ipcRenderer.send('lumi:viewport:selected', selection),
  onObjectSelected: (listener: (selection: ViewportSelection) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, selection: ViewportSelection) => listener(selection);
    ipcRenderer.on('lumi:viewport:selected', handler);
    return () => { ipcRenderer.removeListener('lumi:viewport:selected', handler); };
  },
});
contextBridge.exposeInMainWorld('lumiViewport', viewport);
