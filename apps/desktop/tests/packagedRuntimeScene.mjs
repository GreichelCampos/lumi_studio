import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RUNTIME_SCENE_SOURCE, assertRuntimeRoom } from './runtimeSceneCase.mjs';

async function executeWire(page, source) {
  const reply = await page.evaluate(source => window.lumiDesktop.execute({
    entryFile: 'principal.lumi', files: { 'principal.lumi': source },
  }), source);
  assert.equal(reply.ok, true);
  assert.notEqual(reply.response.status, 'error');
  assert.equal(reply.response.operation, 'execute');
  return reply.response;
}

async function executeEditor(page, source) {
  await page.locator('textarea').fill(source);
  await page.getByRole('button', { name: 'Ejecutar Python', exact: true }).click();
}

async function inspectRenderedCanvas(canvas) {
  return canvas.evaluate(async element => {
    const gl = element.getContext('webgl2') ?? element.getContext('webgl');
    if (!gl || gl.isContextLost()) throw new Error('WebGL no está disponible.');
    const image = new Image();
    image.src = element.toDataURL('image/png');
    await image.decode();
    const copy = document.createElement('canvas');
    copy.width = image.width;
    copy.height = image.height;
    const context = copy.getContext('2d');
    if (!context) throw new Error('No se pudo inspeccionar la captura WebGL.');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    const colors = new Set();
    for (let i = 0; i < pixels.length; i += 256) {
      colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    }
    const columns = Math.ceil(copy.width / 4);
    const rows = Math.ceil(copy.height / 4);
    const red = new Set();
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const i = ((y * 4) * copy.width + x * 4) * 4;
        if (pixels[i] > 60 && pixels[i + 1] < pixels[i] * 0.7 && pixels[i + 2] < pixels[i] * 0.7) {
          red.add(y * columns + x);
        }
      }
    }
    let largest = [];
    while (red.size) {
      const start = red.values().next().value;
      const component = [start];
      red.delete(start);
      for (let i = 0; i < component.length; i++) {
        const point = component[i];
        const x = point % columns;
        const y = Math.floor(point / columns);
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
          const next = ny * columns + nx;
          if (nx >= 0 && nx < columns && ny >= 0 && ny < rows && red.delete(next)) component.push(next);
        }
      }
      if (component.length > largest.length) largest = component;
    }
    const rect = element.getBoundingClientRect();
    const pick = largest.length ? {
      x: rect.left + largest.reduce((sum, i) => sum + (i % columns) * 4, 0) / largest.length * rect.width / copy.width,
      y: rect.top + largest.reduce((sum, i) => sum + Math.floor(i / columns) * 4, 0) / largest.length * rect.height / copy.height,
    } : null;
    return { version: gl.getParameter(gl.VERSION), width: copy.width, height: copy.height, colors: colors.size, pick };
  });
}

async function assertSceneCleared(viewport) {
  assert.equal(await viewport.locator('#room-selector-single, #room-selector-multi').count(), 0);
  assert.equal(await viewport.getByText('ScenePlan recibido de Python', { exact: true }).count(), 0);
  assert.equal(await viewport.locator('#object-properties-card').count(), 0);
  const canvas = viewport.locator('canvas');
  await canvas.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  const cleared = await inspectRenderedCanvas(canvas);
  assert.equal(cleared.pick, null, 'El canvas no debe conservar el mueble rojo de la escena anterior.');
}

export async function verifyRuntimeScene(page, evidenceDirectory) {
  await mkdir(evidenceDirectory, { recursive: true });
  const wire = await executeWire(page, RUNTIME_SCENE_SOURCE);
  assert.equal(wire.status, 'completed');
  assert.equal(wire.result.capabilities.scenePlan, true);
  assert.equal(wire.result.capabilities.debugTrace, false);
  assertRuntimeRoom(wire.result.scenePlan.rooms[0]);

  await executeEditor(page, RUNTIME_SCENE_SOURCE);
  const viewport = page.locator('#viewport-3d-main');
  await viewport.getByText('ScenePlan recibido de Python', { exact: true }).waitFor();
  await viewport.locator('#room-selector-single, #room-selector-multi').filter({ hasText: 'sala' }).waitFor();
  assert.equal(await viewport.getByText(/simulado|Archivo .lumic importado/).count(), 0);
  const canvas = viewport.locator('canvas');
  assert.equal(await canvas.count(), 1);
  const rendered = await inspectRenderedCanvas(canvas);
  assert.ok(rendered.width > 0 && rendered.height > 0 && rendered.colors > 10);
  assert.ok(rendered.pick, 'Debe verse el mueble rojo producido por Python.');
  await page.mouse.click(rendered.pick.x, rendered.pick.y);
  const card = viewport.locator('#object-properties-card');
  await card.getByText('mesa1', { exact: true }).waitFor();
  await card.getByText('X: 3.00m, Y: 0.00m, Z: -1.00m', { exact: true }).waitFor();
  await card.getByText('X: 0°, Y: 90°, Z: 0°', { exact: true }).waitFor();
  await page.screenshot({ path: join(evidenceDirectory, 'runtime-scene.png') });
  await card.locator('#btn-close-object-card').click();

  const invalidSource = 'principal { habitacion invalida(0, 4, 3) {} }';
  const invalid = await executeWire(page, invalidSource);
  assert.equal(invalid.status, 'failed');
  assert.equal(invalid.result.diagnostics[0].code, 'SPA_INVALID_DIMENSION');
  assert.equal(invalid.result.capabilities.scenePlan, false);
  assert.equal(Object.hasOwn(invalid.result, 'scenePlan'), false);
  await executeEditor(page, invalidSource);
  await page.locator('#tab-diagnosticos-btn').click();
  await page.getByText('SPA_INVALID_DIMENSION', { exact: true }).waitFor();
  await assertSceneCleared(viewport);
  await page.screenshot({ path: join(evidenceDirectory, 'spatial-diagnostic.png') });

  await executeEditor(page, RUNTIME_SCENE_SOURCE);
  await viewport.getByText('ScenePlan recibido de Python', { exact: true }).waitFor();
  const noSceneSource = 'principal { mostrar("PAQUETE_SIN_ESCENA")>> }';
  const noScene = await executeWire(page, noSceneSource);
  assert.equal(noScene.status, 'completed');
  assert.deepEqual(noScene.result.output, ['PAQUETE_SIN_ESCENA']);
  assert.equal(noScene.result.capabilities.scenePlan, false);
  assert.equal(Object.hasOwn(noScene.result, 'scenePlan'), false);
  await executeEditor(page, noSceneSource);
  await page.locator('#tab-salida-btn').click();
  await page.getByText('PAQUETE_SIN_ESCENA', { exact: true }).waitFor();
  await assertSceneCleared(viewport);
  await page.screenshot({ path: join(evidenceDirectory, 'without-scene.png') });
  await writeFile(join(evidenceDirectory, 'runtime-results.json'), JSON.stringify({
    url: page.url(), source: RUNTIME_SCENE_SOURCE, wire, rendered, invalid, noScene,
  }, null, 2));
}
