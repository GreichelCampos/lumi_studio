import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { startVite } from '../scripts/development.mjs';
import { launchDesktop, temporaryWorkspace } from './workspaceHarness.mjs';
import { languageCases } from './languageCases.mjs';

const reports = new URL('../../../implementation_tools/integration_reports/language_validation/', import.meta.url);
const phase = 'after';
await mkdir(reports, { recursive: true });
const workspace = await temporaryWorkspace();
const results = [];
const vite = await startVite(Number(process.env.LUMI_TEST_PORT ?? 5181));
const env = { ...process.env, LUMI_RENDERER_URL: vite.url, LUMI_CSP_NONCE: vite.nonce };
delete env.ELECTRON_RUN_AS_NODE;
let desktop;
async function eventually(check, message) {
  for (let i = 0; i < 120; i++) { if (await check()) return; await setTimeout(100); }
  assert.fail(message);
}
try {
  desktop = await launchDesktop(env, workspace, 'language-main.cjs');
  const page = await desktop.firstWindow();
  page.setDefaultTimeout(8000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.getByLabel('Modo Python real').waitFor();
  const editor = page.locator('textarea');
  await editor.waitFor();
  await page.evaluate(async () => {
    const { ThreeSceneManager } = await import('/src/components/viewport/ThreeSceneManager.ts');
    const original = ThreeSceneManager.prototype.renderRoom;
    ThreeSceneManager.prototype.renderRoom = function (...args) {
      const result = original.apply(this, args);
      window.__languageAudit = { manager: this, room: structuredClone(args[0]) };
      return result;
    };
  });
  async function save(source, name = 'principal.lumi') {
    await editor.fill(source); await editor.focus(); await page.keyboard.press('Control+s');
    await eventually(async () => await readFile(join(workspace.project, name), 'utf8') === source, 'Source was not saved');
  }
  await page.getByLabel('Nuevo archivo .lumi', { exact: true }).click();
  await page.getByPlaceholder(/mobiliario_comedor/).fill('utilidades');
  await page.getByRole('button', { name: /Crear y abrir/i }).click();
  await page.locator('#modal-new-file').waitFor({ state: 'hidden' });
  const moduleSource = 'funcion entero sumar(entero a, entero b) { retornar a + b>> }';
  await save(moduleSource, 'utilidades.lumi');
  await writeFile(new URL('utilidades.lumi', reports), moduleSource);
  await page.getByTestId('tab-integration-main').click();

  async function operation(kind) {
    await page.locator('#tab-salida-btn').click();
    const count = await desktop.evaluate(() => global.lumiObservedResponses.length);
    const oldId = await page.getByText(/^ID: #/).textContent().catch(() => null);
    if (kind === 'analyze') await page.getByTitle('Compilar y validar sintaxis (F5)').click();
    else await page.getByRole('button', { name: 'Ejecutar Python', exact: true }).click();
    await eventually(async () => await desktop.evaluate(() => global.lumiObservedResponses.length) > count, 'Python did not respond');
    const response = await desktop.evaluate(() => global.lumiObservedResponses.at(-1));
    if (response.status === 'error') await page.getByText(new RegExp(response.error.code)).first().waitFor();
    else {
      await eventually(async () => {
        const current = await page.getByText(/^ID: #/).textContent().catch(() => null);
        return current && current !== oldId;
      }, 'Renderer did not consume the Python response');
      await page.getByText(`[Python · ${kind === 'analyze' ? 'Análisis' : 'Ejecución'}] ${response.status}`, { exact: true }).waitFor();
    }
    return response;
  }

  for (const test of languageCases) {
    await writeFile(new URL(`${test.id}.lumi`, reports), test.source);
    await save(test.source);
    const record = { id: test.id, source: test.source, checks: [] };
    results.push(record);
    try {
      const response = await operation('analyze'); record.analysis = response;
      const payload = response.result;
      const expected = test.incomplete ? 'incomplete' : test.diagnostic || test.lexical ? 'failed' : 'completed';
      assert.equal(response.status, expected);
      assert.deepEqual(payload.output, []);
      if (test.diagnostic) {
        const diagnostic = payload.diagnostics.find(item => item.code === test.diagnostic);
        assert.ok(diagnostic, JSON.stringify(payload.diagnostics));
        await page.locator('#tab-diagnosticos-btn').click();
        await page.getByText(test.diagnostic, { exact: true }).first().waitFor();
        const location = `${diagnostic.file}:${diagnostic.line}:${diagnostic.column}`;
        await page.getByText(location, { exact: true }).first().dblclick();
        const lines = test.source.split('\n');
        const prefix = lines.slice(0, diagnostic.line - 1).join('\n');
        const column = Array.from(lines[diagnostic.line - 1]).slice(0, diagnostic.column - 1).join('').length;
        assert.equal(await editor.evaluate(node => node.selectionStart), (diagnostic.line > 1 ? prefix.length + 1 : 0) + column);
        record.checks.push('diagnostic and source navigation');
      }
      if (test.lexical) assert.ok(payload.lexicalError);
      if (test.scene) {
        const scene = payload.scenePlan;
        assert.equal(payload.capabilities.scenePlan, true);
        assert.equal(scene.rooms.length, test.rooms ?? 1);
        assert.deepEqual(scene.rooms[0].dimensions, test.scene.dimensions);
        if (test.scene.floor) assert.deepEqual(scene.rooms[0].floor, test.scene.floor);
        await page.locator('#viewport-3d-main').getByText('ScenePlan recibido de Python', { exact: true }).waitFor();
        const rendered = await page.evaluate(() => {
          const { manager, room } = window.__languageAudit;
          const floor = manager.scene.getObjectByName('floor');
          const walls = []; manager.scene.traverse(child => { if (child.name.startsWith('wall-')) walls.push(child.name); });
          return { room, dimensions: floor.geometry.parameters, color: floor.material.color.getHexString(),
            roughness: floor.material.roughness, metalness: floor.material.metalness,
            texture: floor.material.map.isCanvasTexture, walls, calls: manager.renderer.info.render.calls };
        });
        record.rendered = rendered;
        assert.deepEqual(rendered.room, scene.rooms[0]);
        assert.equal(rendered.dimensions.width, test.scene.dimensions[0]);
        assert.equal(rendered.dimensions.depth, test.scene.dimensions[1]);
        assert.equal(rendered.walls.length, 4); assert.ok(rendered.calls > 0 && rendered.texture);
        if (test.id === 'wood-floor') {
          assert.equal(rendered.color, 'c8a27a'); assert.equal(rendered.roughness, 0.6); assert.equal(rendered.metalness, 0.05);
        }
        if (test.id === 'floor-recompiled') {
          assert.equal(rendered.color, '1e3a8a'); assert.equal(rendered.roughness, 0.2); assert.equal(rendered.metalness, 0.8);
        }
        await page.screenshot({ path: fileURLToPath(new URL(`${phase}-${test.id}.png`, reports)), fullPage: true });
        record.checks.push('real worker ScenePlan, WebGL geometry and material, screenshot');
      } else {
        assert.equal(payload.scenePlan, undefined);
        assert.equal(await page.evaluate(() => window.__languageAudit?.manager.scene.getObjectByName('floor') !== undefined), false);
        record.checks.push('no stale scene');
      }
      if (test.output || test.runtimeCode || test.infrastructure) {
        const execution = await operation('execute'); record.execution = execution;
        if (test.infrastructure) {
          assert.equal(execution.status, 'error'); assert.equal(execution.error.code, test.infrastructure);
        } else if (test.runtimeCode) {
          assert.equal(execution.status, 'failed'); assert.equal(execution.result.diagnostics[0].code, test.runtimeCode);
          await page.locator('#tab-diagnosticos-btn').click();
          await page.getByText(test.runtimeCode, { exact: true }).waitFor();
        } else {
          assert.equal(execution.status, 'completed'); assert.deepEqual(execution.result.output, test.output);
          for (const output of new Set(test.output)) await page.getByTestId('stdout-logs-stream').getByText(output, { exact: true }).first().waitFor();
        }
        record.checks.push('execution result represented in UI');
      }
      if (['variables', 'input', 'type-error'].includes(test.id)) {
        await page.screenshot({ path: fileURLToPath(new URL(`${phase}-${test.id}.png`, reports)), fullPage: true });
      }
      record.passed = true;
      console.log(`PASS ${phase}: ${test.id}`);
    } catch (error) {
      record.passed = false; record.error = error.stack;
      await page.screenshot({ path: fileURLToPath(new URL(`${phase}-failure-${test.id}.png`, reports)), fullPage: true });
      console.error(`FAIL ${phase}: ${test.id}: ${error.message}`);
    }
  }
  assert.deepEqual(errors, []);
  assert.equal(results.filter(item => !item.passed).length, 0, 'See local language acceptance report');
} finally {
  await writeFile(new URL(`electron-${phase}.json`, reports), JSON.stringify(results, null, 2));
  if (desktop) await desktop.close();
  vite.processHandle.kill(); await workspace.dispose();
}
