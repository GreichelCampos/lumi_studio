import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startVite } from '../scripts/development.mjs';
import { launchDesktop, temporaryWorkspace } from './workspaceHarness.mjs';

const workspace = await temporaryWorkspace();
const evidence = fileURLToPath(new URL(`../../../implementation_tools/integration_reports/spatial-placement-${Date.now()}-${process.pid}/`, import.meta.url));
await mkdir(evidence, { recursive: true });
const dependencies = {
  'uno.lumi': 'funcion vacio crear() { importar "dos.lumi" usar poblar>> poblar()>> }',
  'dos.lumi': 'funcion vacio poblar() { habitacion importada(6,5,3) { piso suelo {} mesa ubicada {} silla pendiente {} colocar ubicada [1,0,-1]>> } }',
};
for (const [name, content] of Object.entries(dependencies)) await writeFile(join(workspace.project, name), content);
const vite = await startVite(Number(process.env.LUMI_TEST_PORT ?? 5183));
const env = { ...process.env, LUMI_RENDERER_URL: vite.url, LUMI_CSP_NONCE: vite.nonce };
delete env.ELECTRON_RUN_AS_NODE;
let desktop;
const results = [];

try {
  desktop = await launchDesktop(env, workspace);
  const page = await desktop.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.getByLabel('Modo Python real').waitFor({ timeout: 30_000 });
  await page.locator('textarea').waitFor();
  await page.evaluate(async () => {
    const { ThreeSceneManager } = await import('/src/components/viewport/ThreeSceneManager.ts');
    const original = ThreeSceneManager.prototype.renderRoom;
    ThreeSceneManager.prototype.renderRoom = function (...args) {
      const result = original.apply(this, args);
      window.__placementManager = this;
      window.__placementRoom = structuredClone(args[0]);
      return result;
    };
  });

  async function wire(source) {
    const reply = await page.evaluate(files => window.lumiDesktop.execute({ entryFile: 'principal.lumi', files }), {
      ...dependencies, 'principal.lumi': source,
    });
    assert.equal(reply.ok, true);
    assert.notEqual(reply.response.status, 'error');
    return reply.response;
  }

  async function execute(source, roomName) {
    await page.evaluate(() => { window.__placementRoom = null; });
    await page.locator('textarea').fill(source);
    await page.getByRole('button', { name: 'Ejecutar Python', exact: true }).click();
    await page.waitForFunction(name => window.__placementRoom?.name === name, roomName, { timeout: 20_000 });
    await page.getByText('ScenePlan recibido de Python', { exact: true }).waitFor();
    return page.evaluate(async () => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const room = window.__placementRoom;
      const manager = window.__placementManager;
      const gl = manager.renderer.getContext();
      return {
        room, meshes: room.objects.map(item => ({ id: item.id, rendered: Boolean(manager.scene.getObjectByName(item.id)) })),
        floor: Boolean(manager.scene.getObjectByName('floor')), calls: manager.renderer.info.render.calls,
        webgl: gl.getParameter(gl.VERSION), contextLost: gl.isContextLost(),
      };
    });
  }

  const cases = [
    { name: 'colocada', source: 'habitacion colocada(6,5,3) { mesa ubicada {} colocar ubicada [1,0,-1]>> }', placed: 1, unplaced: 0 },
    { name: 'pendiente', source: 'habitacion pendiente(6,5,3) { silla pendiente {} }', placed: 0, unplaced: 1 },
    { name: 'mixta', source: 'habitacion mixta(6,5,3) { piso suelo {} mesa ubicada {} silla pendiente {} colocar ubicada [1,0,-1]>> }', placed: 1, unplaced: 1 },
    { name: 'importada', source: 'importar "uno.lumi" usar crear>> principal { crear()>> }', placed: 1, unplaced: 1 },
  ];
  for (const item of cases) {
    const response = await wire(item.source);
    assert.equal(response.status, 'completed');
    assert.equal(response.result.capabilities.scenePlan, true);
    assert.equal(response.result.capabilities.debugTrace, false);
    const room = response.result.scenePlan.rooms[0];
    assert.equal(room.objects.filter(object => object.placed === true).length, item.placed);
    assert.equal(room.objects.filter(object => object.placed === false).length, item.unplaced);
    for (const object of room.objects) {
      assert.equal(object.roomId, room.id);
      assert.ok(object.id);
      assert.equal(object.sourceRef.file, item.name === 'importada' ? 'dos.lumi' : 'principal.lumi');
      assert.ok(object.sourceRef.line >= 1 && object.sourceRef.column >= 1);
      if (object.placed) assert.deepEqual(object.position, [1, 0, -1]);
      else assert.equal(Object.hasOwn(object, 'position'), false);
    }
    const rendered = await execute(item.source, item.name);
    assert.deepEqual(rendered.room, room);
    assert.equal(rendered.floor, true);
    assert.equal(rendered.contextLost, false);
    assert.match(rendered.webgl, /WebGL/);
    assert.ok(rendered.calls > 0);
    assert.equal(rendered.meshes.filter(mesh => mesh.rendered).length, item.placed);
    for (const object of room.objects) {
      assert.equal(rendered.meshes.find(mesh => mesh.id === object.id).rendered, object.placed);
    }
    results.push({ case: item.name, source: item.source, response, rendered });
    await page.screenshot({ path: join(evidence, `${item.name}.png`) });
  }

  const exportPath = join(evidence, 'runtime-importada.lumic');
  await desktop.evaluate(({ session }, path) => {
    globalThis.__placementDownloadState = 'pending';
    session.defaultSession.once('will-download', (_event, item) => {
      item.setSavePath(path);
      item.once('done', (_doneEvent, state) => { globalThis.__placementDownloadState = state; });
    });
  }, exportPath);
  await page.getByRole('button', { name: 'Archivo', exact: true }).first().click();
  await page.getByText('Exportar escena (.lumic)...', { exact: true }).click();
  const deadline = Date.now() + 30_000;
  let downloadState;
  do {
    downloadState = await desktop.evaluate(() => globalThis.__placementDownloadState);
    if (downloadState !== 'pending') break;
    await delay(100);
  } while (Date.now() < deadline);
  assert.equal(downloadState, 'completed');
  const exported = JSON.parse(await readFile(exportPath, 'utf8'));
  assert.equal(exported.schemaVersion, '1.1.0');
  assert.deepEqual(exported.scenePlan, results.at(-1).response.result.scenePlan);
  assert.deepEqual(exported.debugSteps, []);
  const input = page.locator('input[type=file][accept=".lumic,.json"]');
  await input.setInputFiles(exportPath);
  await page.getByText('Artefacto .lumic cargado: runtime-importada.lumic', { exact: true }).waitFor();
  await page.getByText('Archivo .lumic importado · no implica generación espacial desde Python', { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.__placementRoom), exported.scenePlan.rooms[0]);
  const legacyPath = fileURLToPath(new URL('../../../docs/contracts/lumic/v1.0.0/examples/valid-basic.lumic', import.meta.url));
  await input.setInputFiles(legacyPath);
  await page.getByText('Artefacto .lumic cargado: valid-basic.lumic', { exact: true }).waitFor();
  assert.equal(await page.locator('#viewport-3d-main canvas').count(), 1);

  const invalidSource = 'habitacion invalida(6,5,3) { piso uno {} piso dos {} }';
  const invalid = await wire(invalidSource);
  assert.equal(invalid.status, 'failed');
  assert.equal(invalid.result.diagnostics[0].code, 'SPA_MULTIPLE_FLOORS');
  assert.equal(invalid.result.capabilities.scenePlan, false);
  assert.equal(Object.hasOwn(invalid.result, 'scenePlan'), false);
  await page.locator('textarea').fill(invalidSource);
  await page.getByRole('button', { name: 'Ejecutar Python', exact: true }).click();
  await page.locator('#tab-diagnosticos-btn').click();
  await page.getByText('SPA_MULTIPLE_FLOORS', { exact: true }).waitFor();
  assert.equal(await page.locator('#room-selector-single, #room-selector-multi').count(), 0);
  await page.screenshot({ path: join(evidence, 'multiple-floors.png') });
  const recovered = await execute(cases[2].source, 'mixta');
  assert.equal(recovered.meshes.filter(mesh => mesh.rendered).length, 1);
  assert.deepEqual(errors, []);
  await writeFile(join(evidence, 'results.json'), JSON.stringify({
    origin: 'real Python worker and interpreter; no scene fixtures', results, invalid, exported,
    legacyImported: true, recovered, pageErrors: errors,
  }, null, 2));
  console.log(`Real spatial producer: placed/unplaced/mixed, L-034 transitive imports, references, WebGL, .lumic 1.1 export/reimport, legacy 1.0 import, SPA_MULTIPLE_FLOORS and recovery verified. Evidence: ${evidence}`);
} finally {
  if (desktop) await desktop.close();
  vite.processHandle.kill();
  await workspace.dispose();
}
