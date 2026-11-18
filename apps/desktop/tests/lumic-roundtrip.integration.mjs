import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { startVite } from '../scripts/development.mjs';
import { launchDesktop, temporaryWorkspace, waitForStudioReady } from './workspaceHarness.mjs';

const workspace = await temporaryWorkspace();
const source = [
  'principal {',
  '  habitacion sala(6, 5, 3) {',
  '    silla asiento {}',
  '    colocar asiento [0, 0, 0]>>',
  '    mover asiento [1, 0, 0]>>',
  '  }',
  '  habitacion estudio(4, 4, 3) {}',
  '  visualizar3D(estudio)>>',
  '}',
].join('\n');
await writeFile(join(workspace.project, 'principal.lumi'), source);
const vite = await startVite(Number(process.env.LUMI_TEST_PORT ?? 5191));
let desktop;
try {
  const env = { ...process.env, LUMI_RENDERER_URL: vite.url, LUMI_CSP_NONCE: vite.nonce };
  delete env.ELECTRON_RUN_AS_NODE;
  desktop = await launchDesktop(env, workspace);
  const page = await desktop.firstWindow();
  page.setDefaultTimeout(12000);
  await waitForStudioReady(page, { timeout: 60000 });
  const button = (p, name) => p.getByRole('button', { name, exact: true });
  await button(page, 'Compilar').click();
  await page.locator('#tab-depurador-btn').click();
  await page.getByText('Paso 0 de 0', { exact: true }).waitFor();
  const [viewport] = await Promise.all([desktop.waitForEvent('window', { timeout: 20000 }), button(page, 'Ejecutar Lumi').click()]);
  viewport.setDefaultTimeout(60000);
  const room = viewport.locator('#room-selector-multi');
  await room.waitFor({ timeout: 60000 });
  assert.match(await room.innerText(), /estudio/i);
  await desktop.evaluate(({ session }, path) => {
    session.defaultSession.once('will-download', (_event, item) => item.setSavePath(path));
  }, join(workspace.root, 'roundtrip.lumic'));
  await button(page, 'Archivo').click();
  await page.getByRole('button', { name: /Exportar escena/ }).click();
  const exported = join(workspace.root, 'roundtrip.lumic');
  for (let i = 0; i < 50; i++) {
    try { JSON.parse(await readFile(exported, 'utf8')); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  const artifact = JSON.parse(await readFile(exported, 'utf8'));
  assert.equal(artifact.scenePlan.rooms.length, 2);
  await viewport.close();
  await desktop.evaluate(({ BrowserWindow }) => {
    if (BrowserWindow.getAllWindows().length !== 1) throw new Error('El visor anterior sigue abierto.');
  });
  const [imported] = await Promise.all([
    desktop.waitForEvent('window', { timeout: 30000 }),
    page.locator('input[type=file][accept=".lumic,.json"]').setInputFiles(exported),
  ]).catch(async error => {
    throw new Error(await page.locator('body').innerText(), { cause: error });
  });
  await imported.locator('#viewport-3d-main').waitFor();
  await imported.locator('#room-selector-multi').waitFor();
  console.log('PASS .lumic export, close, import and new 3D window');
  const before = await imported.locator('canvas').screenshot();
  await page.keyboard.press('Control+,');
  const settings = page.locator('#modal-settings');
  await settings.getByRole('button', { name: /Visor 3D y Gráficos/i }).click();
  for (const label of ['Cuadrícula del suelo', 'Ejes cartesianos', 'Cotas y medidas métricas']) {
    await settings.getByRole('checkbox', { name: label, exact: true }).uncheck();
  }
  await settings.getByRole('combobox', { name: 'Iluminación ambiental', exact: true }).selectOption('night');
  await settings.getByRole('button', { name: /Rendimiento/i }).click();
  await page.keyboard.press('Escape');
  await imported.getByRole('button', { name: 'Iluminación nocturna', exact: true }).waitFor();
  await imported.waitForFunction(() => {
    const value = JSON.parse(localStorage.getItem('lumi_ide_settings_v2'));
    return value.showGrid === false && value.renderQuality === 'performance';
  });
  const after = await imported.locator('canvas').screenshot();
  assert.notDeepEqual(after, before, 'El cambio de preferencias debe modificar la escena renderizada.');
  await imported.getByRole('button', { name: 'Mostrar u ocultar ejes coordenados', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('lumi_ide_settings_v2')).showAxes === true);
  console.log('PASS cross-window preferences and toolbar changes');
} finally {
  if (desktop) await desktop.close();
  vite.processHandle.kill();
  await workspace.dispose();
}
