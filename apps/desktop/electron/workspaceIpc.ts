import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron';
import { join, resolve } from 'node:path';
import { realpathSync } from 'node:fs';
import { WorkspaceService } from './workspaces/WorkspaceService';
import { trustedFrame } from './security';

export function registerWorkspaceIpc(window: BrowserWindow, renderer: URL): { dispose: () => void; flush: () => Promise<void> } {
  const service = new WorkspaceService(app.getPath('userData'), {
    chooseFolder: async () => {
      const result = await dialog.showOpenDialog(window, { properties: ['openDirectory', 'createDirectory'] });
      return result.canceled ? null : result.filePaths[0] ?? null;
    },
    chooseSavePath: async (root, name) => {
      const result = await dialog.showSaveDialog(window, {
        defaultPath: join(root, name), filters: [{ name: 'Código Lumi', extensions: ['lumi'] }],
      });
      return result.canceled ? null : result.filePath ?? null;
    },
    confirmDelete: async name => (await dialog.showMessageBox(window, {
      type: 'warning', message: `¿Mover el proyecto «${name}» y todo su contenido a la papelera?`,
      detail: 'Los cambios sin guardar de este proyecto se descartarán.',
      buttons: ['Cancelar', 'Mover a la papelera'], defaultId: 0, cancelId: 0,
    })).response === 1,
    trash: path => shell.trashItem(path),
  }, [app.getPath('userData'), app.getAppPath()], app.isPackaged ? [realpathSync.native(resolve(process.resourcesPath, '..'))] : []);
  const channels = ['list', 'chooseLocation', 'open', 'create', 'save', 'rename', 'saveAs', 'remove', 'lastActive', 'importProject'] as const;
  for (const operation of channels) {
    ipcMain.handle(`lumi:workspace:${operation}`, async (event, ...args: unknown[]) => {
      try {
        if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame
          || !trustedFrame(event.senderFrame.url, renderer)) throw new Error('Origen IPC no autorizado.');
        return await service.serial(async () => {
          const string = (index: number): string => {
            const value = args[index];
            if (typeof value !== 'string' || value.length > 262144) throw new Error('Parámetros no válidos.');
            return value;
          };
          let value: unknown;
          switch (operation) {
            case 'list': case 'chooseLocation': case 'open':
              if (args.length) throw new Error('Parámetros no válidos.');
              value = await service[operation](); break;
            case 'create': {
              const data = args[0];
              if (args.length !== 1 || !data || typeof data !== 'object' || !('name' in data)
                || typeof data.name !== 'string' || !('location' in data) || typeof data.location !== 'string'
                || ('description' in data && typeof data.description !== 'string')) throw new Error('Parámetros no válidos.');
              value = await service.create(data as { name: string; location: string; description?: string }); break;
            }
            case 'save': if (args.length !== 1) throw new Error('Parámetros no válidos.');
              value = await service.save(args[0]); break;
            case 'importProject': if (args.length !== 2) throw new Error('Parámetros no válidos.');
              value = await service.importProject(args[0], string(1)); break;
            case 'rename': if (args.length !== 2) throw new Error('Parámetros no válidos.');
              value = await service.rename(string(0), string(1)); break;
            case 'saveAs': if (args.length !== 3) throw new Error('Parámetros no válidos.');
              value = await service.saveAs(string(0), string(1), string(2)); break;
            case 'remove': if (args.length !== 1) throw new Error('Parámetros no válidos.');
              value = await service.remove(string(0)); break;
            case 'lastActive': if (args.length > 1) throw new Error('Parámetros no válidos.');
              value = await service.lastActive(args[0] === null || args.length === 0 ? args[0] as null | undefined : string(0)); break;
          }
          return { ok: true, value };
        });
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : 'No se pudo completar la operación de archivos.' };
      }
    });
  }
  window.webContents.on('will-prevent-unload', event => {
    const discard = dialog.showMessageBoxSync(window, {
      type: 'warning', message: 'Hay cambios sin guardar. ¿Cerrar y descartarlos?',
      buttons: ['Seguir editando', 'Descartar y cerrar'], defaultId: 0, cancelId: 0,
    });
    if (discard === 1) event.preventDefault();
  });
  return {
    dispose: () => channels.forEach(operation => ipcMain.removeHandler(`lumi:workspace:${operation}`)),
    flush: () => service.serial(async () => undefined),
  };
}
