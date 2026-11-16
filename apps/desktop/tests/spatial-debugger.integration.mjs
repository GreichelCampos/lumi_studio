import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { startVite } from '../scripts/development.mjs';
import { launchDesktop, temporaryWorkspace, waitForStudioReady } from './workspaceHarness.mjs';

const workspace = await temporaryWorkspace();
const officeSource = await readFile(
  new URL('../../../examples/OficinaEjemplo/principal.lumi', import.meta.url),
  'utf8',
);
await writeFile(`${workspace.project}/principal.lumi`, officeSource, 'utf8');

const vite = await startVite(Number(process.env.LUMI_TEST_PORT ?? 5185));
const env = { ...process.env, LUMI_RENDERER_URL: vite.url, LUMI_CSP_NONCE: vite.nonce };
delete env.ELECTRON_RUN_AS_NODE;
let desktop;

try {
  desktop = await launchDesktop(env, workspace);
  const page = await desktop.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await waitForStudioReady(page);

  const debuggerTab = page.locator('#tab-depurador-btn');
  await page.getByRole('button', { name: 'Compilar', exact: true }).click();
  await debuggerTab.click();
  await page.getByText('Paso 0 de 0', { exact: true }).waitFor();

  const viewportWindowPromise = desktop.waitForEvent('window');
  await page.getByRole('button', { name: 'Ejecutar Lumi', exact: true }).click();
  const viewportPage = await viewportWindowPromise;
  await viewportPage.locator('#viewport-3d-main').waitFor({ state: 'visible' });
  await page.getByText('Paso 1 de 40', { exact: true }).waitFor({ timeout: 30_000 });
  await page.getByText(/Python publicó 40 pasos espaciales reales/).waitFor();
  assert.equal(await page.getByText('start', { exact: true }).count(), 1);

  const viewport = viewportPage.locator('#viewport-3d-main');
  await viewport.locator('#room-selector-single, #room-selector-multi').filter({ hasText: 'oficina' }).waitFor();
  const executionPixels = await viewport.locator('canvas').screenshot();
  const renderedScene = viewport.locator('[data-rendered-object-ids]').first();
  assert.equal((await renderedScene.getAttribute('data-rendered-object-ids')).split(',').filter(Boolean).length, 12);

  await page.locator('#btn-debug-next').click();
  await page.getByText('Paso 2 de 40', { exact: true }).waitFor();
  await page.getByText('room_create', { exact: true }).waitFor();
  await viewport.locator('#room-selector-single, #room-selector-multi').filter({ hasText: 'oficina' }).waitFor();
  const roomOnlyPixels = await viewport.locator('canvas').screenshot();
  assert.notDeepEqual(roomOnlyPixels, executionPixels, 'La primera interacción debe activar el snapshot seleccionado.');
  assert.equal(await renderedScene.getAttribute('data-rendered-object-ids'), '');

  for (let displayedStep = 3; displayedStep <= 19; displayedStep++) {
    await page.locator('#btn-debug-next').click();
    await page.getByText(`Paso ${displayedStep} de 40`, { exact: true }).waitFor();
  }
  assert.equal(await renderedScene.getAttribute('data-rendered-object-ids'), '',
    'Las declaraciones sin colocar no deben crear mallas en Three.js.');

  await page.locator('#btn-debug-next').click();
  await page.getByText('Paso 20 de 40', { exact: true }).waitFor();
  await viewportPage.waitForFunction(() => document.querySelector('[data-rendered-object-ids]')?.getAttribute('data-rendered-object-ids')?.includes('escritorio_analisis'));
  let renderedIds = (await renderedScene.getAttribute('data-rendered-object-ids')).split(',').filter(Boolean);
  assert.equal(renderedIds.length, 1);
  assert.match(renderedIds[0], /escritorio_analisis$/);

  await page.locator('#btn-debug-next').click();
  await page.getByText('Paso 21 de 40', { exact: true }).waitFor();
  await viewportPage.waitForFunction(() => document.querySelector('[data-rendered-object-ids]')?.getAttribute('data-rendered-object-ids')?.includes('silla_analisis'));
  let renderedState = JSON.parse(await renderedScene.getAttribute('data-rendered-object-state'));
  assert.deepEqual(renderedState.find(item => item.id.endsWith('silla_analisis')).rotation, [0, 0, 0]);
  await page.locator('#btn-debug-next').click();
  await page.getByText('Paso 22 de 40', { exact: true }).waitFor();
  await viewportPage.waitForFunction(() => document.querySelector('[data-rendered-object-state]')?.getAttribute('data-rendered-object-state')?.includes('[0,180,0]'));
  renderedState = JSON.parse(await renderedScene.getAttribute('data-rendered-object-state'));
  assert.deepEqual(renderedState.find(item => item.id.endsWith('silla_analisis')).rotation, [0, 180, 0]);

  await page.locator('#btn-debug-prev').click();
  await page.getByText('Paso 21 de 40', { exact: true }).waitFor();
  await viewportPage.waitForFunction(() => {
    const raw = document.querySelector('[data-rendered-object-state]')?.getAttribute('data-rendered-object-state');
    return raw && JSON.parse(raw).some(item => item.id.endsWith('silla_analisis') && item.rotation[1] === 0);
  });
  renderedState = JSON.parse(await renderedScene.getAttribute('data-rendered-object-state'));
  assert.deepEqual(renderedState.find(item => item.id.endsWith('silla_analisis')).rotation, [0, 0, 0]);

  await page.locator('#btn-debug-start').click();
  await page.getByText('Paso 1 de 40', { exact: true }).waitFor();
  await viewport.getByText('Sin habitaciones definidas', { exact: true }).waitFor();
  await page.locator('#btn-debug-next').click();
  await page.getByText('Paso 2 de 40', { exact: true }).waitFor();

  await page.locator('#btn-debug-end').click();
  await page.getByText('Paso 40 de 40', { exact: true }).waitFor();
  await page.getByText('end', { exact: true }).waitFor();
  const finalPixels = await viewport.locator('canvas').screenshot();
  assert.notDeepEqual(finalPixels, roomOnlyPixels, 'El snapshot final debe restaurar todos los elementos.');
  renderedIds = (await renderedScene.getAttribute('data-rendered-object-ids')).split(',').filter(Boolean);
  assert.equal(renderedIds.length, 12);

  await page.locator('#btn-debug-prev').click();
  await page.getByText('Paso 39 de 40', { exact: true }).waitFor();
  await page.locator('#btn-debug-next').click();
  await page.getByText('Paso 40 de 40', { exact: true }).waitFor();

  await page.locator('#btn-debug-reset').click();
  await page.getByText('Paso 1 de 40', { exact: true }).waitFor();
  await page.getByRole('button', { name: '2x', exact: true }).click();
  await page.locator('#btn-debug-play-pause').click();
  await page.getByText(/Paso [2-9] de 40/).first().waitFor({ timeout: 5_000 });
  await page.locator('#btn-debug-play-pause').click();
  await page.getByText('Pausado', { exact: true }).waitFor();
  const pausedLabel = await page.locator('text=/Paso [0-9]+ de 40/').first().textContent();
  await page.waitForTimeout(750);
  assert.equal(await page.locator('text=/Paso [0-9]+ de 40/').first().textContent(), pausedLabel);

  await page.locator('#btn-debug-end').click();
  await viewport.locator('#room-selector-single, #room-selector-multi').filter({ hasText: 'oficina' }).waitFor();
  assert.equal(await viewport.locator('canvas').count(), 1);

  await page.getByTitle('Clic para fijar punto de interrupción en línea 8', { exact: true }).click();
  await page.locator('#btn-debug-reset').click();
  await page.getByRole('button', { name: '2x', exact: true }).click();
  await page.locator('#btn-debug-play-pause').click();
  await page.getByText('Paso 21 de 40', { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText('Pausado', { exact: true }).waitFor();
  await page.getByText(/Línea 8 \(principal\.lumi\)/).waitFor();
  await page.locator('#btn-debug-play-pause').click();
  await page.waitForTimeout(650);
  await page.locator('#btn-debug-play-pause').click();
  await page.getByTitle('Punto de interrupción en línea 8', { exact: true }).click();
  await page.locator('#btn-debug-reset').click();

  await viewportPage.close();
  const reopenedViewportPromise = desktop.waitForEvent('window');
  await page.locator('#btn-debug-next').click();
  const reopenedViewport = await reopenedViewportPromise;
  await reopenedViewport.locator('#viewport-3d-main').waitFor({ state: 'visible' });
  await reopenedViewport.locator('#room-selector-single, #room-selector-multi').filter({ hasText: 'oficina' }).waitFor();

  const replacementViewportPromise = desktop.waitForEvent('window');
  await page.getByRole('button', { name: 'Ejecutar Lumi', exact: true }).click();
  const replacementViewport = await replacementViewportPromise;
  await replacementViewport.locator('#viewport-3d-main').waitFor({ state: 'visible' });
  await replacementViewport.locator('#room-selector-single, #room-selector-multi').filter({ hasText: 'oficina' }).waitFor();
  await page.getByText('Paso 1 de 40', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('OficinaEjemplo: F6 muestra primero la escena final; 40 pasos reales solo reemplazan el viewport tras una acción; una segunda F6 restaura el resultado final.');
} finally {
  if (desktop) await desktop.close();
  vite.processHandle.kill();
  await workspace.dispose();
}
