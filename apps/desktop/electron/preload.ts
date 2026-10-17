import { contextBridge, ipcRenderer } from 'electron';
import type { BackendInput, DesktopBridge } from '../renderer/src/services/integration/desktopBridge';
import type { WindowControlsBridge } from '../renderer/src/windowBridge';

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
