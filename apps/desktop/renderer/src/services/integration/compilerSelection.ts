import type { CompilerService } from '../compiler/CompilerService';
import { MockCompilerService } from '../compiler/MockCompilerService';
import { PythonCompilerService } from './PythonCompilerService';
import type { DesktopBridge } from './desktopBridge';

export function selectCompiler(isElectron: boolean, bridge?: DesktopBridge): CompilerService {
  return isElectron || bridge ? new PythonCompilerService(bridge) : new MockCompilerService(300);
}

export function defaultCompiler(): CompilerService {
  const bridge = window.lumiDesktop;
  return selectCompiler(navigator.userAgent.includes('Electron/'), bridge);
}
