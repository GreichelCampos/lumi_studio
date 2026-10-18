import { _electron } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { temporaryWorkspace } from './workspaceHarness.mjs';

const directory = resolve(process.env.LUMI_PACKAGED_DIR ?? 'dist/release/win-unpacked');
const executable = join(directory, 'Estudio Lumi.exe');
const runtime = join(directory, 'resources/lumi/python/python.exe');
const workspace = await temporaryWorkspace();
const env = { ...process.env, LUMI_PYTHON: 'Z:\\missing-python.exe',
  LUMI_RENDERER_URL: 'https://invalid.example/', PYTHONPATH: 'Z:\\untrusted', PYTHONHOME: 'Z:\\missing' };
delete env.ELECTRON_RUN_AS_NODE;
let desktop;
let runtimeMoved = false;
async function launch() {
  const app = await _electron.launch({ executablePath: executable,
    args: [`--user-data-dir=${workspace.userData}`], cwd: workspace.root, env, timeout: 30000 });
  await app.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 1; });
  return app;
}
try {
  desktop = await launch();
  const page = await desktop.firstWindow();
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.getByLabel('Modo Python real').waitFor();
  assert.equal(page.url(), 'lumi-app://ide/index.html');
  const identity = await desktop.evaluate(({ app, BrowserWindow }) => ({
    packaged: app.isPackaged, profile: app.getPath('userData'),
    preferences: BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(),
  }));
  assert.equal(identity.packaged, true);
  assert.equal(identity.profile.toLowerCase(), workspace.userData.toLowerCase());
  assert.equal(identity.preferences.sandbox, true);
  assert.equal(identity.preferences.nodeIntegration, false);
  await desktop.evaluate(({ dialog }, location) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [location] });
  }, join(directory, 'resources'));
  const forbidden = await page.evaluate(() => window.lumiWorkspace.chooseLocation());
  assert.equal(forbidden.ok, false);
  assert.match(forbidden.message, /fuera de la carpeta de instalación/);
  const editor = page.locator('textarea');
  assert.match(await editor.evaluate(element => getComputedStyle(element).fontFamily), /monospace/);
  await editor.fill('mostrar("PAQUETE_PYTHON_REAL")>>');
  await page.getByRole('button', { name: 'Ejecutar Python', exact: true }).click();
  await page.getByText('PAQUETE_PYTHON_REAL', { exact: true }).waitFor();
  await editor.press('Control+s');
  await page.getByText('Guardado', { exact: true }).waitFor();
  assert.equal(await readFile(join(workspace.project, 'principal.lumi'), 'utf8'), 'mostrar("PAQUETE_PYTHON_REAL")>>');
  const analyzed = await page.evaluate(() => window.lumiDesktop.analyze({
    entryFile: 'principal.lumi', files: { 'principal.lumi': 'principal { habitacion sala(5,4,2.7) {} }' },
  }));
  assert.equal(analyzed.ok, true);
  assert.equal(analyzed.response.status, 'incomplete');
  assert.equal(analyzed.response.result.capabilities.scenePlan, false);
  const failed = await page.evaluate(() => window.lumiDesktop.execute({
    entryFile: 'principal.lumi', files: { 'principal.lumi': 'mostrar(4 / 0)>>' },
  }));
  assert.equal(failed.response.result.diagnostics[0].code, 'RUN_DIVISION_BY_ZERO');
  const input = page.locator('input[type=file][accept=".lumic,.json"]');
  await input.setInputFiles(resolve('../../docs/contracts/lumic/v1.0.0/examples/valid-basic.lumic'));
  await page.getByText(/Archivo .lumic importado/).waitFor();
  assert.ok(await page.locator('canvas').count() > 0);
  assert.equal(await page.getByText('Error al inicializar WebGL').count(), 0);
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/packaged-lumic.png', fullPage: true });
  assert.equal(requests.some(url => /^https?:/.test(url)), false);
  assert.deepEqual(failures, []);
  await desktop.close(); desktop = undefined;
  desktop = await launch();
  const reopened = await desktop.firstWindow();
  await reopened.locator('textarea').waitFor();
  assert.equal(await reopened.locator('textarea').inputValue(), 'mostrar("PAQUETE_PYTHON_REAL")>>');
  await desktop.close(); desktop = undefined;
  const icon = join(directory, 'resources/lumi/lumi-taskbar-adapted.ico');
  assert.ok((await stat(icon)).size > 0);
  const version = spawnSync(runtime, ['-I', '-B', '-c', 'import sys; print(sys.version_info[:3])'], { env, encoding: 'utf8' });
  assert.equal(version.status, 0, version.stderr);
  assert.match(version.stdout, /3, 13, 14/);
  await rename(runtime, runtime + '.unavailable'); runtimeMoved = true;
  desktop = await launch();
  const missing = await desktop.firstWindow();
  await missing.getByLabel('Modo Python real').waitFor();
  await missing.locator('textarea').fill('mostrar("NO_SIMULAR")>>');
  await missing.getByRole('button', { name: 'Ejecutar Python', exact: true }).click();
  await missing.getByText(/Reinstala Estudio Lumi/).first().waitFor();
  assert.equal(await missing.getByLabel('Modo de demostración').count(), 0);
  console.log('Packaged Windows x64: isolated bundled Python, output, analysis, diagnostics, save/reopen, lumic/WebGL, icon and missing-runtime error verified.');
} finally {
  if (desktop) await desktop.close();
  if (runtimeMoved) await rename(runtime + '.unavailable', runtime);
  if (process.env.LUMI_TEST_EVIDENCE) {
    await writeFile(process.env.LUMI_TEST_EVIDENCE, JSON.stringify({ project: workspace.project, profile: workspace.userData }));
  } else await workspace.dispose();
}
