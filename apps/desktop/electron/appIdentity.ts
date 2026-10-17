import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { BrowserWindow } from 'electron';

/** The future Windows executable and shortcuts must use this same identity. */
export const APP_USER_MODEL_ID = 'org.lumi.estudio';

export function applicationIconPath(isPackaged: boolean, appPath: string, resourcesPath: string): string {
  const path = isPackaged
    ? join(resourcesPath, 'lumi', 'lumi-taskbar-adapted.ico')
    : join(appPath, 'resources', 'lumi-taskbar-adapted.ico');
  if (!existsSync(path)) throw new Error(`No se encontró el ícono oficial de Estudio Lumi: ${path}`);
  return path;
}

export function configureWindowsTaskbar(window: BrowserWindow, iconPath: string): void {
  window.setAppDetails({ appId: APP_USER_MODEL_ID, appIconPath: iconPath, appIconIndex: 0 });
}
