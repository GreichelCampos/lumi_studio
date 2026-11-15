import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startVite } from '../scripts/development.mjs';
import { launchDesktop, temporaryWorkspace, waitForStudioReady } from './workspaceHarness.mjs';
import { verifyRuntimeScene } from './packagedRuntimeScene.mjs';

const workspace = await temporaryWorkspace();
const evidence = new URL(`../../../implementation_tools/integration_reports/runtime-scene-${Date.now()}-${process.pid}/`, import.meta.url);
await mkdir(evidence, { recursive: true });
const vite = await startVite(Number(process.env.LUMI_TEST_PORT ?? 5181));
const env = { ...process.env, LUMI_RENDERER_URL: vite.url, LUMI_CSP_NONCE: vite.nonce };
delete env.ELECTRON_RUN_AS_NODE;
let desktop;

try {
  desktop = await launchDesktop(env, workspace);
  const page = await desktop.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await waitForStudioReady(page, { requireViewport: true });
  await verifyRuntimeScene(page, fileURLToPath(new URL('shared-checks-development/', evidence)));
  assert.deepEqual(errors, []);
  console.log('Lexer -> Parser -> Interpreter -> ScenePlan -> protocolo -> Three.js verificado con estado final y limpieza tras error.');
} finally {
  if (desktop) await desktop.close();
  vite.processHandle.kill();
  await workspace.dispose();
}
