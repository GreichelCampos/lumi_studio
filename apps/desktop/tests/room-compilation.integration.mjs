import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { startVite } from '../scripts/development.mjs';
import { launchDesktop, temporaryWorkspace } from './workspaceHarness.mjs';

const workspace = await temporaryWorkspace();
const vite = await startVite(Number(process.env.LUMI_TEST_PORT ?? 5179));
const env = { ...process.env, LUMI_RENDERER_URL: vite.url, LUMI_CSP_NONCE: vite.nonce };
delete env.ELECTRON_RUN_AS_NODE;
const source = 'principal {\n    habitacion sala(5.0, 4.0, 2.7) {\n    }\n}\n';
let desktop;
async function eventually(check, message) {
  for (let i = 0; i < 100; i++) { if (await check()) return; await setTimeout(100); }
  assert.fail(message);
}
try {
  desktop = await launchDesktop(env, workspace);
  const page = await desktop.firstWindow();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.getByLabel('Modo Python real').waitFor();
  await page.locator('textarea').waitFor();
  await page.evaluate(async () => {
    const { ThreeSceneManager } = await import('/src/components/viewport/ThreeSceneManager.ts');
    const original = ThreeSceneManager.prototype.renderRoom;
    ThreeSceneManager.prototype.renderRoom = function (...args) {
      const result = original.apply(this, args);
      window.__realRoomAudit = { manager: this, room: structuredClone(args[0]) };
      return result;
    };
  });
  const mainPath = join(workspace.project, 'principal.lumi');
  async function editAndSave(text, path = mainPath) {
    await page.locator('textarea').fill(text);
    await page.locator('textarea').focus();
    await page.keyboard.press('Control+s');
    await eventually(async () => await readFile(path, 'utf8') === text, 'Editor content was not saved to disk');
  }
  async function compile(status) {
    await page.locator('#tab-salida-btn').click();
    const oldId = await page.getByText(/^ID: #/).textContent().catch(() => null);
    await page.getByTitle('Compilar y validar sintaxis (F5)').click();
    await eventually(async () => {
      const current = await page.getByText(/^ID: #/).textContent().catch(() => null);
      return current && current !== oldId;
    }, 'Compilation did not return a new result');
    await page.getByText(`[Python · Análisis] ${status}`, { exact: true }).waitFor();
  }
  await editAndSave(source);
  await compile('completed');
  const viewport = page.locator('#viewport-3d-main');
  await viewport.getByText('ScenePlan recibido de Python', { exact: true }).waitFor();
  await viewport.locator('#room-selector-single').filter({ hasText: 'sala' }).waitFor();
  assert.equal(await page.getByText('Análisis incompleto', { exact: true }).count(), 0);
  assert.equal(await viewport.getByText('Generación de ScenePlan pendiente', { exact: true }).count(), 0);
  assert.equal(await viewport.getByText('Sin ScenePlan para esta compilación', { exact: true }).count(), 0);
  assert.equal(await page.getByText(/ScenePlan y trazas pendientes/).count(), 0);
  const geometry = await page.evaluate(() => {
    const { manager, room } = window.__realRoomAudit;
    const floor = manager.scene.getObjectByName('floor');
    const walls = []; manager.scene.traverse(child => { if (child.name.startsWith('wall-')) walls.push(child.name); });
    return { room, floor: floor.geometry.parameters, walls, calls: manager.renderer.info.render.calls,
      camera: manager.cameraController.getCamera().isOrthographicCamera };
  });
  assert.deepEqual(geometry.room.dimensions, [5, 4, 2.7]);
  assert.equal(geometry.room.id, 'principal.lumi:2:5');
  assert.equal(geometry.floor.width, 5); assert.equal(geometry.floor.depth, 4);
  assert.deepEqual(geometry.walls.sort(), ['wall-este', 'wall-norte', 'wall-oeste', 'wall-sur']);
  assert.ok(geometry.calls > 0 && geometry.camera);
  const reports = new URL('../../../implementation_tools/integration_reports/', import.meta.url);
  await mkdir(reports, { recursive: true });
  await page.getByText(/^ID: #/).scrollIntoViewIfNeeded();
  await page.screenshot({ path: fileURLToPath(new URL('real-room-compilation.png', reports)), fullPage: true });
  console.log('Acceptance passed: saved Lumi source -> real Python -> validated ScenePlan -> real Three.js room, floor and four walls.');

  await editAndSave(source.replace('(5.0, 4.0, 2.7)', '(8.0, 6.0, 3.2)'));
  await compile('completed');
  await eventually(async () => JSON.stringify(await page.evaluate(() => window.__realRoomAudit.room.dimensions)) === '[8,6,3.2]', 'Changed dimensions did not reach Three.js');
  await editAndSave(source.replace('5.0', '-5.0'));
  await compile('failed');
  assert.equal(await viewport.locator('#room-selector-single').count(), 0);
  assert.equal(await page.evaluate(() => window.__realRoomAudit.manager.scene.getObjectByName('floor') !== undefined), false);
  await page.locator('#tab-diagnosticos-btn').click();
  await page.getByText('SPA_INVALID_DIMENSION', { exact: true }).waitFor();
  await page.getByText('principal.lumi:2:21', { exact: true }).waitFor();
  await page.getByText('principal.lumi:2:21', { exact: true }).dblclick();
  assert.equal(await page.locator('textarea').evaluate(editor => editor.selectionStart), source.indexOf('\n') + 1 + 20);
  await editAndSave(source);
  await compile('completed');

  await page.getByLabel('Nuevo archivo .lumi', { exact: true }).click();
  await page.getByPlaceholder(/mobiliario_comedor/).fill('otra');
  await page.getByRole('button', { name: /Crear y abrir/i }).click();
  await page.locator('#modal-new-file').waitFor({ state: 'hidden' });
  await editAndSave('mostrar("NO_ES_PRINCIPAL")>>', join(workspace.project, 'otra.lumi'));
  await compile('completed');
  assert.deepEqual(await page.evaluate(() => window.__realRoomAudit.room.dimensions), [5, 4, 2.7]);
  assert.equal(await page.locator('textarea').inputValue(), 'mostrar("NO_ES_PRINCIPAL")>>');
  await page.getByTestId('tab-integration-main').click();
  await eventually(async () => await page.locator('textarea').inputValue() === source, 'Main tab did not activate');
  const multiple = 'principal {\n    habitacion sala(5, 4, 2.7) {}\n    habitacion estudio(3, 2, 2.5) {}\n}\n';
  await editAndSave(multiple); await compile('completed');
  await viewport.getByRole('button', { name: /estudio/ }).click();
  await eventually(async () => await page.evaluate(() => window.__realRoomAudit.room.name === 'estudio'), 'Second generated room did not render');
  assert.deepEqual(await page.evaluate(() => window.__realRoomAudit.room.dimensions), [3, 2, 2.5]);
  await page.screenshot({ path: fileURLToPath(new URL('real-room-multiple.png', reports)), fullPage: true });
  await editAndSave('principal { habitacion sala(5,4,2.7) { piso suelo { material "madera">> } silla asiento {} } }');
  await compile('incomplete');
  assert.equal(await viewport.locator('#room-selector-single, #room-selector-multi').count(), 0);
  await editAndSave(source); await compile('completed');
  assert.deepEqual(errors, []);
  console.log('Changed dimensions, invalid source diagnostics, stale scene removal, explicit main file, two generated rooms and unsupported spatial elements verified.');
} finally {
  if (desktop) await desktop.close();
  vite.processHandle.kill();
  await workspace.dispose();
}
