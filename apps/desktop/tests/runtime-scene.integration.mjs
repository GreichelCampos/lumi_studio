import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
import { startVite } from '../scripts/development.mjs';
import { launchDesktop, temporaryWorkspace } from './workspaceHarness.mjs';

const workspace = await temporaryWorkspace();
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

  const source = [
    'funcion decimal destino(decimal valor) { retornar valor + 1>> }',
    'habitacion sala(6, 5, 3) {',
    '  piso suelo { material "madera">> color "beige">> }',
    '  mesa mesa1 { color "rojo">> }',
    '  colocar mesa1 [0, 0, 0]>>',
    '  si verdadero { mover mesa1 [destino(2), 0, -1]>> }',
    '  rotar mesa1 [0, 90, 0]>>',
    '}',
  ].join('\n');
  await editor.fill(source);
  await page.getByRole('button', { name: 'Ejecutar Python', exact: true }).click();
  await eventually(
    async () => await page.evaluate(() => window.__runtimeSceneAudit?.room?.name) === 'sala',
    'La escena producida por el intérprete no llegó a Three.js',
  );
  const rendered = await page.evaluate(() => window.__runtimeSceneAudit);
  assert.equal(rendered.room.name, 'sala');
  assert.deepEqual(rendered.room.dimensions, [6, 5, 3]);
  assert.equal(rendered.room.floor.material, 'madera');
  assert.equal(rendered.room.floor.color, 'beige');
  assert.equal(rendered.room.objects.length, 1);
  assert.deepEqual(rendered.room.objects[0].position, [3, 0, -1]);
  assert.deepEqual(rendered.room.objects[0].rotation, [0, 90, 0]);
  assert.deepEqual(rendered.room.objects[0].dimensions, [1.2, 0.5, 0.8]);
  assert.equal(rendered.hasFloor, true);
  assert.equal(rendered.furniture.name, rendered.room.objects[0].id);
  assert.deepEqual(rendered.furniture.position, [3, 0, -1]);
  assert.ok(Math.abs(rendered.furniture.rotation[0]) < Number.EPSILON);
  assert.ok(Math.abs(rendered.furniture.rotation[1] - Math.PI / 2) < Number.EPSILON);
  assert.ok(Math.abs(rendered.furniture.rotation[2]) < Number.EPSILON);
  assert.ok(rendered.calls > 0);
  assert.equal(await page.locator('#viewport-3d-main canvas').count(), 1);

  await editor.fill('habitacion invalida(0, 4, 3) { }');
  await page.getByRole('button', { name: 'Ejecutar Python', exact: true }).click();
  await page.getByText('SPA_INVALID_DIMENSION', { exact: true }).waitFor();
  await eventually(
    async () => await page.locator('#room-selector-single, #room-selector-multi').count() === 0,
    'La escena anterior permaneció visible después del error espacial',
  );
  assert.deepEqual(errors, []);
  console.log('Lexer -> Parser -> Interpreter -> ScenePlan -> protocolo -> Three.js verificado con estado final y limpieza tras error.');
} finally {
  if (desktop) await desktop.close();
  vite.processHandle.kill();
  await workspace.dispose();
}
