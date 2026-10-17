import { _electron } from 'playwright-core';
import electron from 'electron';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { desktopRoot } from '../scripts/development.mjs';

export async function temporaryWorkspace() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'lumi-electron-')));
  const userData = join(root, 'user-data');
  const project = join(root, 'ProyectoPrueba');
  await mkdir(userData);
  await mkdir(project);
  await writeFile(join(project, 'principal.lumi'), 'principal {\n}\n');
  await writeFile(join(userData, 'workspaces.json'), JSON.stringify({
    version: 1, lastActive: 'integration-project', projects: [{
      id: 'integration-project', root: project, description: 'Proyecto de prueba',
      fileIds: { 'principal.lumi': 'integration-main' }, entryPath: 'principal.lumi',
      activePath: 'principal.lumi', tabPaths: ['principal.lumi'], createdAt: '2026-10-17T00:00:00Z',
    }],
  }));
  return { root, userData, project, dispose: () => rm(root, { recursive: true, force: true }) };
}

export async function launchDesktop(env, workspace, mainFile = 'workspace-main.cjs') {
  const desktop = await _electron.launch({
    executablePath: electron, cwd: desktopRoot, env, timeout: 30_000,
    args: [fileURLToPath(new URL(`./fixtures/${mainFile}`, import.meta.url)),
      `--lumi-test-user-data=${workspace.userData}`, `--lumi-test-root=${resolve(desktopRoot)}`],
  });
  await desktop.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 1; });
  return desktop;
}
