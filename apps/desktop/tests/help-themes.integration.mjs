import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startVite } from '../scripts/development.mjs';
import { launchDesktop, temporaryWorkspace, waitForStudioReady } from './workspaceHarness.mjs';

const workspace = await temporaryWorkspace();
const vite = await startVite(Number(process.env.LUMI_TEST_PORT ?? 5192));
let desktop;
try {
  const env = { ...process.env, LUMI_RENDERER_URL: vite.url, LUMI_CSP_NONCE: vite.nonce };
  delete env.ELECTRON_RUN_AS_NODE;
  desktop = await launchDesktop(env, workspace);
  const page = await desktop.firstWindow();
  await waitForStudioReady(page, { timeout: 60000 });
  const evidence = new URL('../test-results/', import.meta.url);
  await mkdir(evidence, { recursive: true });

  for (const theme of [
    { name: 'Dracula Modern', id: 'dracula' },
    { name: 'Visual Studio Light+ (Modo Claro)', id: 'vs-light' },
  ]) {
    await page.keyboard.press('Control+,');
    await page.locator('#modal-settings').getByText(theme.name, { exact: true }).click();
    await page.waitForFunction(id => document.documentElement.dataset.theme === id, theme.id);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Ayuda', exact: true }).click();
    await page.getByRole('button', { name: 'Acerca de Lumi Studio', exact: true }).click();
    const about = page.locator('#modal-about-lumi');
    await about.waitFor();
    const aboutColors = await about.evaluate(element => {
      const probe = document.createElement('div');
      element.append(probe);
      const expected = variable => {
        probe.style.backgroundColor = `var(${variable})`;
        return getComputedStyle(probe).backgroundColor;
      };
      const hero = element.querySelector('section > div');
      const card = element.querySelector('li');
      const result = {
        hero: getComputedStyle(hero).backgroundColor,
        expectedHero: expected('--ide-accent-bg'),
        card: getComputedStyle(card).backgroundColor,
        expectedCard: expected('--ide-control-bg'),
      };
      probe.remove();
      return result;
    });
    assert.equal(aboutColors.hero, aboutColors.expectedHero);
    assert.equal(aboutColors.card, aboutColors.expectedCard);
    await about.screenshot({ path: fileURLToPath(new URL(`about-${theme.id}.png`, evidence)) });
    await page.keyboard.press('Escape');
    await page.keyboard.press('F1');
    const help = page.locator('#modal-documentation');
    await help.getByRole('button', { name: 'Guía del IDE', exact: true }).click();
    await help.getByText('Estados visuales del asistente Lumi', { exact: true }).scrollIntoViewIfNeeded();
    await help.screenshot({ path: fileURLToPath(new URL(`help-${theme.id}.png`, evidence)) });
    await help.getByRole('button', { name: 'Ejemplos', exact: true }).click();
    const codeColors = await help.locator('pre').first().evaluate(element => {
      const probe = document.createElement('span');
      probe.style.backgroundColor = 'var(--ide-control-bg)';
      probe.style.color = 'var(--ide-text)';
      element.append(probe);
      const result = {
        background: getComputedStyle(element).backgroundColor,
        expectedBackground: getComputedStyle(probe).backgroundColor,
        foreground: getComputedStyle(element).color,
        expectedForeground: getComputedStyle(probe).color,
      };
      probe.remove();
      return result;
    });
    assert.equal(codeColors.background, codeColors.expectedBackground);
    assert.equal(codeColors.foreground, codeColors.expectedForeground);
    await page.keyboard.press('Escape');
    console.log(`PASS help and About colors: ${theme.id}`);
  }
} finally {
  if (desktop) await desktop.close();
  vite.processHandle.kill();
  await workspace.dispose();
}
