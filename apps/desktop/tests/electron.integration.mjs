import { _electron } from 'playwright-core';
import electron from 'electron';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { desktopRoot, startVite } from '../scripts/development.mjs';

const vite = await startVite(Number(process.env.LUMI_TEST_PORT ?? 5174));
let desktop;
try {
  const env = { ...process.env, LUMI_RENDERER_URL: vite.url, LUMI_CSP_NONCE: vite.nonce };
  delete env.ELECTRON_RUN_AS_NODE;
  desktop = await _electron.launch({ executablePath: electron, args: ['.'], cwd: desktopRoot, env, timeout: 30_000 });
  const page = await desktop.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByLabel('Modo Python real').waitFor({ timeout: 30_000 });
  const preferences = await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  assert.equal(preferences.contextIsolation, true);
  assert.equal(preferences.nodeIntegration, false);
  assert.equal(preferences.sandbox, true);
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  assert.deepEqual(await page.evaluate(() => Object.keys(window.lumiDesktop).sort()), ['analyze', 'availability', 'execute']);
  assert.equal(await page.getByLabel('Modo de demostración').count(), 0);
  const editor = page.locator('textarea');
  await editor.fill('mostrar("SALIDA_REAL_PYTHON_42")>>');
  await page.getByRole('button', { name: 'Ejecutar Python', exact: true }).click();
  await page.getByText('SALIDA_REAL_PYTHON_42', { exact: true }).waitFor();
  await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
  await page.screenshot({ path: fileURLToPath(new URL('../test-results/electron-real-output.png', import.meta.url)), fullPage: true });
  // CompilerService must call analyze, which must not evaluate the division.
  await editor.fill('mostrar(4 / 0)>>');
  await page.getByTitle('Compilar y validar sintaxis (F5)').click();
  await page.getByText('[Python · Análisis] completed', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Ejecutar Python', exact: true }).click();
  await page.getByRole('button', { name: /Diagnósticos/ }).click();
  await page.getByText('RUN_DIVISION_BY_ZERO', { exact: true }).waitFor();
  await page.getByText('SIN SEVERIDAD PROPORCIONADA', { exact: true }).waitFor();
  await page.getByText('principal.lumi:1:9', { exact: true }).waitFor();
  await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
  await page.getByText('RUN_DIVISION_BY_ZERO', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: fileURLToPath(new URL('../test-results/electron-real-python.png', import.meta.url)), fullPage: true });
  const invalid = await page.evaluate(() => window.lumiDesktop.execute({ entryFile: 'x', files: {}, command: 'whoami' }));
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error.code, 'INVALID_IPC_INPUT');
  const availability = await page.evaluate(() => window.lumiDesktop.availability());
  assert.equal(availability.available, true);
  assert.deepEqual(errors, []);
  console.log('Electron + React + preload sandbox + worker real: salida y diagnóstico verificados.');
  await desktop.close(); desktop = undefined;

  const unavailableEnv = { ...env, LUMI_PYTHON: fileURLToPath(new URL('../test-results/missing-python.exe', import.meta.url)) };
  desktop = await _electron.launch({ executablePath: electron, args: ['.'], cwd: desktopRoot, env: unavailableEnv });
  const unavailablePage = await desktop.firstWindow();
  await unavailablePage.getByLabel('Modo Python real').waitFor();
  await unavailablePage.locator('textarea').fill('mostrar("NO_DEBE_SIMULAR")>>');
  await unavailablePage.getByRole('button', { name: 'Ejecutar Python', exact: true }).click();
  await unavailablePage.getByText(/\[Infraestructura\].*No se pudo iniciar Python/).first().waitFor();
  assert.equal(await unavailablePage.getByLabel('Modo de demostración').count(), 0);
  console.log('Electron sin Python: error de infraestructura visible, sin fallback al mock.');
} finally {
  if (desktop) await desktop.close();
  vite.processHandle.kill();
}
