import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { startVite } from '../scripts/development.mjs';
import { launchDesktop, temporaryWorkspace } from './workspaceHarness.mjs';

const workspace = await temporaryWorkspace();
const vite = await startVite(Number(process.env.LUMI_TEST_PORT ?? 5177));
const env = { ...process.env, LUMI_RENDERER_URL: vite.url, LUMI_CSP_NONCE: vite.nonce };
delete env.ELECTRON_RUN_AS_NODE;
let desktop;
try {
  desktop = await launchDesktop(env, workspace);
  const page = await desktop.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.getByLabel('Modo Python real').waitFor();
  await page.locator('textarea').waitFor();
  const viewport = page.locator('#viewport-3d-main');
  await viewport.getByText('Generación de ScenePlan pendiente', { exact: true }).waitFor();
  const input = page.locator('input[type=file][accept=".lumic,.json"]');
  let basic;
  for (const name of ['valid-basic', 'valid-debug']) {
    const path = fileURLToPath(new URL(`../../../docs/contracts/lumic/v1.0.0/examples/${name}.lumic`, import.meta.url));
    const artifact = JSON.parse(await readFile(path, 'utf8')); basic ??= artifact;
    await input.setInputFiles(path);
    await viewport.getByText(/Archivo .lumic importado/).waitFor();
    if (artifact.debugSteps?.length) {
      await page.locator('#tab-depurador-btn').click();
      await page.locator('#btn-debug-end').click();
    }
    await viewport.locator('#room-selector-single, #room-selector-multi').filter({ hasText: artifact.scenePlan.rooms[0].name }).waitFor();
    assert.equal(await viewport.getByText(/Aceleración 3D no disponible/).count(), 0);
    assert.equal(await viewport.locator('canvas').count(), 1);
    await page.getByLabel('Acercar cámara', { exact: true }).click();
    await page.getByLabel('Alejar cámara', { exact: true }).click();
    await page.getByLabel('Restablecer cámara isométrica', { exact: true }).click();
  }
  const fixtureScene = await page.evaluate(async () => {
    const fixtures = await import('/src/data/scenePlanFixtures.ts');
    return fixtures.fixtureDoorsAndWindowsRoom;
  });
  const fixtureArtifact = { ...basic, scenePlan: fixtureScene };
  await input.setInputFiles({ name: 'fixture-openings.lumic', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixtureArtifact)) });
  await viewport.locator('#room-selector-single, #room-selector-multi').filter({ hasText: fixtureScene.rooms[0].name }).waitFor();
  await page.getByLabel('Maximizar visor 3D', { exact: true }).click();
  await setTimeout(200);
  const size = await viewport.locator('canvas').evaluate(canvas => ({ width: canvas.width, height: canvas.height, clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight }));
  assert.ok(size.width > 0 && size.height > 0 && size.clientWidth > 0 && size.clientHeight > 0);
  await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
  await viewport.screenshot({ path: fileURLToPath(new URL('../test-results/viewport-imported-openings.png', import.meta.url)) });
  await page.getByLabel('Restaurar vista dividida del IDE', { exact: true }).click();
  const invalid = fileURLToPath(new URL('../../../docs/contracts/lumic/v1.0.0/examples/invalid-dimensions.lumic', import.meta.url));
  await input.setInputFiles(invalid);
  await setTimeout(100);
  await viewport.locator('#room-selector-single, #room-selector-multi').filter({ hasText: fixtureScene.rooms[0].name }).waitFor();

  const harness = await page.evaluateHandle(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { ThreeSceneManager } = await import('/src/components/viewport/ThreeSceneManager.ts');
    const fixtures = await import('/src/data/scenePlanFixtures.ts');
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;inset:0;width:900px;height:650px;z-index:10000';
    document.body.appendChild(container);
    const picked = [];
    const manager = new ThreeSceneManager({ container, onSelectEntity: id => picked.push(id) });
    const renderer = manager.renderer;
    const scene = manager.scene;
    const camera = manager.cameraController.getCamera();
    const plans = Object.values(fixtures).filter(value => value && Array.isArray(value.rooms));
    for (const plan of plans) {
      for (const room of plan.rooms) { manager.renderRoom(room, null); renderer.render(scene, camera); }
    }
    const room = structuredClone(fixtures.fixtureDoorsAndWindowsRoom.rooms[0]);
    room.objects = [{ id: 'selection-cube', name: 'Cubo de prueba', type: 'cubo', position: [0, 0, 0], rotation: [0, 30, 0], dimensions: [1, 1, 1], color: '#ff2200', material: 'metal' }];
    manager.renderRoom(room, null); renderer.render(scene, camera);
    const firstMemory = { ...renderer.info.memory };
    for (let i = 0; i < 30; i++) { manager.renderRoom(room, i % 2 ? 'selection-cube' : null); renderer.render(scene, camera); }
    const lastMemory = { ...renderer.info.memory };
    const position = new THREE.Vector3(0, 0.5, 0).project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    const point = { x: rect.left + (position.x + 1) * rect.width / 2, y: rect.top + (1 - position.y) * rect.height / 2 };
    const pixelSource = manager.captureSnapshot();
    const image = new Image(); image.src = pixelSource; await image.decode();
    const pixelsCanvas = document.createElement('canvas'); pixelsCanvas.width = image.width; pixelsCanvas.height = image.height;
    const context = pixelsCanvas.getContext('2d'); context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const colors = new Set(); for (let i = 0; i < pixels.length; i += 256) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    return { manager, renderer, scene, camera, room, container, picked, firstMemory, lastMemory, point, colors: colors.size, fixtureCount: plans.length };
  });
  const stats = await harness.evaluate(value => ({ first: value.firstMemory, last: value.lastMemory, point: value.point, colors: value.colors, fixtures: value.fixtureCount, calls: value.renderer.info.render.calls }));
  assert.equal(stats.fixtures, 5);
  assert.ok(stats.colors > 10, 'A WebGL snapshot must contain a rendered scene');
  assert.ok(stats.calls > 0);
  assert.ok(stats.last.geometries <= stats.first.geometries + 5, JSON.stringify(stats));
  assert.ok(stats.last.textures <= stats.first.textures + 2, JSON.stringify(stats));
  await page.mouse.click(stats.point.x, stats.point.y);
  assert.equal(await harness.evaluate(value => value.picked.at(-1)), 'selection-cube');
  const before = await harness.evaluate(value => value.camera.position.toArray());
  await page.mouse.move(450, 350); await page.mouse.down(); await page.mouse.move(550, 400, { steps: 10 }); await page.mouse.up();
  await setTimeout(100);
  assert.notDeepEqual(await harness.evaluate(value => value.camera.position.toArray()), before);
  const beforePan = await harness.evaluate(value => ({ target: value.manager.cameraController.getControls().target.toArray(), selections: value.picked.length }));
  await page.mouse.move(450, 350); await page.mouse.down({ button: 'right' });
  await page.mouse.move(500, 380, { steps: 10 }); await page.mouse.up({ button: 'right' });
  await setTimeout(100);
  assert.notDeepEqual(await harness.evaluate(value => value.manager.cameraController.getControls().target.toArray()), beforePan.target);
  assert.equal(await harness.evaluate(value => value.picked.length), beforePan.selections);
  await page.mouse.wheel(0, -500);
  await setTimeout(100);
  const zoom = await harness.evaluate(value => value.camera.zoom);
  assert.ok(zoom >= 0.4 && zoom <= 3.5);
  await harness.evaluate(value => { value.container.style.width = '400px'; value.container.style.height = '800px'; });
  await setTimeout(150);
  const resized = await harness.evaluate(value => ({ width: value.renderer.domElement.clientWidth, height: value.renderer.domElement.clientHeight }));
  assert.deepEqual(resized, { width: 400, height: 800 });
  await harness.evaluate(value => { value.manager.clearRoom(); value.manager.dispose(); value.manager.dispose(); });
  assert.equal(await harness.evaluate(value => value.container.querySelectorAll('canvas').length), 0);
  await harness.evaluate(value => value.container.remove());
  assert.deepEqual(errors, []);
  console.log('Real WebGL: both published lumic files, a fixture-derived lumic with openings, and all five simulated scenes rendered.');
  console.log(`Selection, orbit, pan, wheel zoom, ResizeObserver and cleanup verified; memory after 30 rebuilds: ${JSON.stringify(stats.last)}.`);
} finally {
  if (desktop) await desktop.close();
  vite.processHandle.kill();
  await workspace.dispose();
}
