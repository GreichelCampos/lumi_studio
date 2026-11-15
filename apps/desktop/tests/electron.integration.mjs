import { launchDesktop, temporaryWorkspace, waitForStudioReady } from './workspaceHarness.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { desktopRoot, startVite } from '../scripts/development.mjs';

const vite = await startVite(Number(process.env.LUMI_TEST_PORT ?? 5174));
const workspace = await temporaryWorkspace();
let desktop;
try {
  const env = { ...process.env, LUMI_RENDERER_URL: vite.url, LUMI_CSP_NONCE: vite.nonce };
  delete env.ELECTRON_RUN_AS_NODE;
  desktop = await launchDesktop(env, workspace);
  const page = await desktop.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await waitForStudioReady(page);
  const preferences = await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  assert.equal(preferences.contextIsolation, true);
  assert.equal(preferences.nodeIntegration, false);
  assert.equal(preferences.sandbox, true);
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  assert.deepEqual(await page.evaluate(() => Object.keys(window.lumiDesktop).sort()), ['analyze', 'availability', 'execute', 'onInputPrompt', 'replyInput']);
  assert.equal(await page.getByLabel('Modo de demostración').count(), 0);
  const editor = page.locator('textarea');
  await editor.fill('mostrar("SALIDA_REAL_PYTHON_42")>>');
  await page.getByRole('button', { name: 'Ejecutar Lumi', exact: true }).click();
  await page.getByText('SALIDA_REAL_PYTHON_42', { exact: true }).waitFor();
  await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
  await page.screenshot({ path: fileURLToPath(new URL('../test-results/electron-real-output.png', import.meta.url)), fullPage: true });
  // CompilerService must call analyze, which must not evaluate the division.
  await editor.fill('mostrar(4 / 0)>>');
  await page.getByRole('button', { name: 'Compilar', exact: true }).click();
  await page.getByText('[Python · Análisis] completed', { exact: true }).waitFor();
  assert.equal(await page.getByTestId('output-log-view').getByText('Análisis terminado', { exact: true }).count(), 1);
  assert.equal(await page.getByText(/Válido para 3D/).count(), 0);
  await page.getByRole('button', { name: 'Ejecutar Lumi', exact: true }).click();
  await page.getByRole('button', { name: /Diagnósticos/ }).click();
  await page.getByText('RUN_DIVISION_BY_ZERO', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Errores (1)', exact: true }).click();
  await page.getByText('ERROR', { exact: true }).waitFor();
  await page.getByText('principal.lumi:1:9', { exact: true }).waitFor();
  await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
  await page.getByText('RUN_DIVISION_BY_ZERO', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: fileURLToPath(new URL('../test-results/electron-real-python.png', import.meta.url)), fullPage: true });
  await editor.fill('principal {\n  @\n}');
  await page.getByRole('button', { name: 'Compilar', exact: true }).click();
  await page.locator('#tab-salida-btn').click();
  await page.getByText('[Python · Análisis] failed', { exact: true }).waitFor();
  assert.equal(await page.getByText('Fallo de infraestructura', { exact: true }).count(), 0);
  assert.equal(await page.getByTestId('output-log-view').getByText('Análisis fallido', { exact: true }).count(), 1);
  assert.equal(await page.getByText(/Válido para 3D/).count(), 0);

  await editor.fill([
    'principal {',
    '  texto nombre = leer("¿Cómo te llamás?")>>',
    '  texto extra = leer("Deja la respuesta vacía")>>',
    '  mostrar("Hola, " + nombre + "[" + extra + "]")>>',
    '  habitacion sala(7, 5, 3) {}',
    '}',
  ].join('\n'));
  await page.getByRole('button', { name: 'Compilar', exact: true }).click();
  await page.getByTestId('output-log-view').getByText('Análisis terminado', { exact: true }).waitFor();
  const inputDialog = page.getByRole('dialog', { name: 'Entrada del programa Lumi' });
  assert.equal(await inputDialog.count(), 0);
  const run = page.getByRole('button', { name: 'Ejecutar Lumi', exact: true });
  await run.click();
  await inputDialog.getByText('¿Cómo te llamás?', { exact: true }).waitFor();
  assert.equal(await run.isDisabled(), true);
  const staleInput = await page.evaluate(() => window.lumiDesktop.replyInput({
    requestId: 'old-run', inputId: 'old-prompt', value: 'Respuesta tardía',
  }));
  assert.equal(staleInput.error.code, 'STALE_INPUT_REPLY');
  await page.screenshot({ path: fileURLToPath(new URL('../test-results/leer-prompt.png', import.meta.url)) });
  // Human input must survive the normal 10-second execution timeout.
  await new Promise(resolve => setTimeout(resolve, 10_300));
  await inputDialog.getByLabel('Respuesta').fill('María');
  await inputDialog.getByRole('button', { name: 'Enviar entrada' }).click();
  await inputDialog.getByText('Deja la respuesta vacía', { exact: true }).waitFor().catch(async error => {
    const output = await page.locator('body').innerText();
    throw new Error(`Lumi no abrió la segunda pregunta. ${output}`, { cause: error });
  });
  assert.equal(await inputDialog.getByLabel('Respuesta').inputValue(), '');
  await inputDialog.getByRole('button', { name: 'Enviar entrada' }).click();
  await page.getByText('Hola, María[]', { exact: true }).waitFor();
  await page.locator('#room-selector-single').waitFor();
  await page.screenshot({ path: fileURLToPath(new URL('../test-results/leer-result.png', import.meta.url)) });
  await run.click();
  await inputDialog.getByText('¿Cómo te llamás?', { exact: true }).waitFor();
  await inputDialog.getByRole('button', { name: 'Cancelar ejecución' }).click();
  await inputDialog.waitFor({ state: 'hidden' });
  await page.getByText(/\[INPUT_CANCELLED\]/).first().waitFor();
  await editor.fill('mostrar("DESPUÉS_DE_CANCELAR")>>');
  await run.click();
  await page.getByText('DESPUÉS_DE_CANCELAR', { exact: true }).waitFor();

  const baseCase = [
    'funcion entero factorial(entero n) {',
    '  si n == 0 { retornar 1>> }',
    '  retornar n * factorial(n - 1)>>',
    '}',
    'principal { mostrar(factorial(5))>> habitacion sala(7, 5, 3) {} }',
  ].join('\n');
  async function runFactorial() {
    await page.locator('#tab-salida-btn').click();
    await editor.fill(baseCase);
    await run.click();
    await page.getByText('120', { exact: true }).waitFor();
    await page.locator('#room-selector-single').waitFor();
  }
  await runFactorial();
  await editor.fill('funcion vacio ciclo() {\n  ciclo()>>\n}\nprincipal { ciclo()>> }');
  await run.click();
  await page.locator('#tab-diagnosticos-btn').click();
  await page.getByText('RUN_CALL_DEPTH_EXCEEDED', { exact: true }).waitFor();
  assert.equal(await page.locator('#room-selector-single').count(), 0);
  assert.equal(await page.getByText(/INTERNAL_ERROR/).count(), 0);
  await page.getByRole('button', { name: 'Ir al código (principal.lumi:2)', exact: true }).click();
  await page.screenshot({ path: fileURLToPath(new URL('../test-results/recursion-error.png', import.meta.url)) });
  await runFactorial();
  await page.screenshot({ path: fileURLToPath(new URL('../test-results/recursion-valida.png', import.meta.url)) });

  const invalid = await page.evaluate(() => window.lumiDesktop.execute({ entryFile: 'x', files: {}, command: 'whoami' }));
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error.code, 'INVALID_IPC_INPUT');
  const availability = await page.evaluate(() => window.lumiDesktop.availability());
  assert.equal(availability.available, true);
  assert.deepEqual(errors, []);
  console.log('Electron + React + preload sandbox + worker real: salida y diagnóstico verificados.');
  await desktop.close(); desktop = undefined;

  const unavailableEnv = { ...env, LUMI_PYTHON: fileURLToPath(new URL('../test-results/missing-python.exe', import.meta.url)) };
  desktop = await launchDesktop(unavailableEnv, workspace);
  const unavailablePage = await desktop.firstWindow();
  await waitForStudioReady(unavailablePage, { expectedBackendAvailable: false });
  await unavailablePage.locator('textarea').fill('mostrar("NO_DEBE_SIMULAR")>>');
  await unavailablePage.getByRole('button', { name: 'Ejecutar Lumi', exact: true }).click();
  await unavailablePage.getByText(/\[Infraestructura\].*No se pudo iniciar Python/).first().waitFor();
  assert.equal(await unavailablePage.getByLabel('Modo de demostración').count(), 0);
  console.log('Electron sin Python: error de infraestructura visible, sin fallback al mock.');
} finally {
  if (desktop) await desktop.close();
  vite.processHandle.kill();
  await workspace.dispose();
}
