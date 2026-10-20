import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { startVite } from '../scripts/development.mjs';
import { launchDesktop, temporaryWorkspace } from './workspaceHarness.mjs';
import { RUNTIME_SCENE_SOURCE, assertRuntimeRoom } from './runtimeSceneCase.mjs';
import { verifyRuntimeScene } from './packagedRuntimeScene.mjs';

const workspace = await temporaryWorkspace();
const evidence = new URL(`../../../implementation_tools/integration_reports/runtime-scene-${Date.now()}-${process.pid}/`, import.meta.url);
await mkdir(evidence, { recursive: true });
const vite = await startVite(Number(process.env.LUMI_TEST_PORT ?? 5181));
const env = { ...process.env, LUMI_RENDERER_URL: vite.url, LUMI_CSP_NONCE: vite.nonce };
delete env.ELECTRON_RUN_AS_NODE;
let desktop;

async function eventually(check, message) {
  for (let index = 0; index < 100; index += 1) {
    if (await check()) return;
    await setTimeout(100);
  }
  assert.fail(message);
}

try {
  desktop = await launchDesktop(env, workspace);
  const page = await desktop.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.getByLabel('Modo Python real').waitFor({ timeout: 30_000 });
  const editor = page.locator('textarea');
  await editor.waitFor();
  await page.evaluate(async () => {
    const { ThreeSceneManager } = await import('/src/components/viewport/ThreeSceneManager.ts');
    const original = ThreeSceneManager.prototype.renderRoom;
    ThreeSceneManager.prototype.renderRoom = function (...args) {
      const result = original.apply(this, args);
      const furniture = this.scene.getObjectByName(args[0].objects[0]?.id);
      window.__runtimeSceneAudit = {
        room: structuredClone(args[0]),
        calls: this.renderer.info.render.calls,
        hasFloor: this.scene.getObjectByName('floor') !== undefined,
        furniture: furniture ? {
          name: furniture.name,
          position: furniture.position.toArray(),
          rotation: [furniture.rotation.x, furniture.rotation.y, furniture.rotation.z],
        } : null,
      };
      return result;
    };
  });

  const source = RUNTIME_SCENE_SOURCE;
  await editor.fill(source);
  await page.getByRole('button', { name: 'Ejecutar Python', exact: true }).click();
  await eventually(
    async () => await page.evaluate(() => window.__runtimeSceneAudit?.room?.name) === 'sala',
    'La escena producida por el intérprete no llegó a Three.js',
  );
  const rendered = await page.evaluate(() => window.__runtimeSceneAudit);
  assertRuntimeRoom(rendered.room);
  assert.equal(rendered.hasFloor, true);
  assert.equal(rendered.furniture.name, rendered.room.objects[0].id);
  assert.deepEqual(rendered.furniture.position, [3, 0, -1]);
  assert.ok(Math.abs(rendered.furniture.rotation[0]) < Number.EPSILON);
  assert.ok(Math.abs(rendered.furniture.rotation[1] - Math.PI / 2) < Number.EPSILON);
  assert.ok(Math.abs(rendered.furniture.rotation[2]) < Number.EPSILON);
  assert.ok(rendered.calls > 0);
  assert.equal(await page.locator('#viewport-3d-main canvas').count(), 1);
  await writeFile(new URL('runtime-scene.json', evidence), JSON.stringify({ source, rendered }, null, 2));
  await page.screenshot({ path: fileURLToPath(new URL('runtime-scene.png', evidence)) });
  await page.getByLabel('Acercar cámara', { exact: true }).click();
  await page.getByLabel('Alejar cámara', { exact: true }).click();
  await page.getByLabel('Restablecer cámara isométrica', { exact: true }).click();

  await editor.fill('habitacion invalida(0, 4, 3) { }');
  await page.getByRole('button', { name: 'Ejecutar Python', exact: true }).click();
  await page.locator('#tab-diagnosticos-btn').click();
  await page.getByText('SPA_INVALID_DIMENSION', { exact: true }).waitFor();
  await eventually(
    async () => await page.locator('#room-selector-single, #room-selector-multi').count() === 0,
    'La escena anterior permaneció visible después del error espacial',
  );
  assert.deepEqual(errors, []);
  await page.screenshot({ path: fileURLToPath(new URL('invalid-dimension.png', evidence)) });
  await editor.fill('principal { mostrar("SIN_ESCENA_REAL")>> }');
  await page.getByRole('button', { name: 'Ejecutar Python', exact: true }).click();
  await page.locator('#tab-salida-btn').click();
  await page.getByText('SIN_ESCENA_REAL', { exact: true }).waitFor();
  assert.equal(await page.locator('#room-selector-single, #room-selector-multi').count(), 0);
  assert.deepEqual(errors, []);
  await verifyRuntimeScene(page, fileURLToPath(new URL('shared-checks-development/', evidence)));
  assert.deepEqual(errors, []);
  console.log('Lexer -> Parser -> Interpreter -> ScenePlan -> protocolo -> Three.js verificado con estado final y limpieza tras error.');
} finally {
  if (desktop) await desktop.close();
  vite.processHandle.kill();
  await workspace.dispose();
}
