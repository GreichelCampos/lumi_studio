import { _electron } from 'playwright-core';
import electron from 'electron';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { desktopRoot, startVite } from '../scripts/development.mjs';

async function eventually(check, message) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await check()) return;
    await setTimeout(100);
  }
  assert.fail(message);
}

function workerPids() {
  if (process.platform !== 'win32') return [];
  const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    'Get-CimInstance Win32_Process | Where-Object { $_.Name -like "python*.exe" -and $_.CommandLine -like "*-m services.worker*" } | Select-Object -ExpandProperty ProcessId'],
  { encoding: 'utf8', windowsHide: true });
  return output.trim().split(/\s+/).filter(Boolean).map(Number);
}

const before = workerPids();
const vite = await startVite(Number(process.env.LUMI_TEST_PORT ?? 5175));
let desktop;
try {
  const env = { ...process.env, LUMI_RENDERER_URL: vite.url, LUMI_CSP_NONCE: vite.nonce };
  delete env.ELECTRON_RUN_AS_NODE;
  desktop = await _electron.launch({ executablePath: electron, args: ['.'], cwd: desktopRoot, env });
  const page = await desktop.firstWindow();
  await page.getByLabel('Modo Python real').waitFor();
  const iconUrl = new URL('../resources/lumi-taskbar-adapted.ico', import.meta.url);
  const ico = await readFile(iconUrl);
  const sourceBytes = await readFile(new URL('../resources/lumi-taskbar.png', import.meta.url));
  const frames = [16, 24, 32, 48, 64, 128, 256].map((size, index) => {
    const entry = 6 + index * 16;
    const offset = ico.readUInt32LE(entry + 12);
    const length = ico.readUInt32LE(entry + 8);
    return { size, dataUrl: `data:image/png;base64,${ico.subarray(offset, offset + length).toString('base64')}` };
  });
  const officialIcon = await desktop.evaluate(async ({ app, nativeImage }, input) => {
    const source = nativeImage.createFromDataURL(input.sourceDataUrl);
    const framesMatch = input.frames.every(({ size, dataUrl }) => {
      const actual = nativeImage.createFromDataURL(dataUrl);
      const expected = source.resize({ width: size, height: size, quality: 'best' });
      return !actual.isEmpty() && actual.toBitmap().equals(expected.toBitmap());
    });
    const small = nativeImage.createFromDataURL(input.frames.find((frame) => frame.size === 32).dataUrl);
    const pixels = small.toBitmap();
    let left = 32, top = 32, right = -1, bottom = -1;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      if (pixels[(y * 32 + x) * 4 + 3] < 128) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    return { framesMatch, visibleWidth: right - left + 1, visibleHeight: bottom - top + 1,
      transparentCorner: pixels[3] === 0,
      windowsRecognizesIcon: !(await app.getFileIcon(input.iconPath)).isEmpty() };
  }, { frames, sourceDataUrl: `data:image/png;base64,${sourceBytes.toString('base64')}`, iconPath: fileURLToPath(iconUrl) });
  assert.equal(officialIcon.framesMatch, true, 'ICO frames must preserve the supplied image');
  assert.equal(officialIcon.windowsRecognizesIcon, true, 'Windows must recognize the generated ICO');
  assert.ok(officialIcon.visibleWidth >= 28 && officialIcon.visibleHeight >= 28, 'Mascot must fill the 32px taskbar slot');
  assert.equal(officialIcon.transparentCorner, true, 'Taskbar icon must have a transparent background');
  console.log(`Mascota visible a 32px: ${officialIcon.visibleWidth}×${officialIcon.visibleHeight}px, fondo transparente.`);
  assert.deepEqual(await page.evaluate(() => Object.keys(window.lumiWindow).sort()),
    ['close', 'isMaximized', 'minimize', 'onMaximizedChange', 'toggleMaximize']);
  const nativeState = () => desktop.evaluate(({ BrowserWindow, Menu }) => {
    const window = BrowserWindow.getAllWindows()[0];
    return { minimized: window.isMinimized(), maximized: window.isMaximized(),
      resizable: window.isResizable(), menu: Menu.getApplicationMenu(), bounds: window.getBounds(),
      preferences: window.webContents.getLastWebPreferences() };
  });
  const state = await nativeState();
  assert.equal(state.menu, null);
  assert.equal(state.resizable, true);
  assert.equal(state.preferences.sandbox, true);
  assert.equal(state.preferences.contextIsolation, true);
  assert.equal(state.preferences.nodeIntegration, false);
  assert.equal(await page.getByTestId('window-titlebar').count(), 1);
  assert.equal(await page.getByTestId('window-titlebar').locator('button').count(), 3);
  assert.equal(await page.getByTestId('window-titlebar').evaluate((el) => getComputedStyle(el).webkitAppRegion), 'drag');
  assert.equal(await page.getByLabel('Minimizar ventana', { exact: true }).evaluate((el) => getComputedStyle(el).webkitAppRegion), 'no-drag');

  await page.getByLabel('Maximizar ventana', { exact: true }).click();
  await eventually(async () => (await nativeState()).maximized, 'Maximization failed');
  await page.getByLabel('Restaurar ventana', { exact: true }).click();
  await eventually(async () => !(await nativeState()).maximized, 'Restore failed');
  await page.getByLabel('Minimizar ventana', { exact: true }).click();
  await eventually(async () => (await nativeState()).minimized, 'Minimize failed');
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].restore());
  await eventually(async () => !(await nativeState()).minimized, 'Restore after minimize failed');
  // Programmatic bounds verify resize support, not native edge dragging.
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ width: 1200, height: 800 }));
  // Windows rounds DIP bounds to physical pixels at fractional display scales.
  await eventually(async () => {
    const { width, height } = (await nativeState()).bounds;
    return Math.abs(width - 1200) <= 1 && Math.abs(height - 800) <= 1;
  }, 'Resize failed (including one DIP of Windows scaling tolerance)');

  for (const menu of ['Archivo', 'Editar', 'Insertar', 'Proyecto', 'Compilar', 'Ejecutar', 'Ayuda']) {
    const button = page.getByRole('button', { name: menu, exact: true }).first();
    await button.click();
    await button.click();
  }
  const editor = page.locator('textarea');
  await editor.fill('mostrar("ATAJO_F5")>>');
  await editor.focus();
  await page.keyboard.press('Control+a');
  assert.equal(await editor.evaluate((el) => el.selectionEnd - el.selectionStart), 'mostrar("ATAJO_F5")>>'.length);
  await page.keyboard.press('F5');
  await page.getByText('[Python · Análisis] completed', { exact: true }).waitFor();
  await editor.focus();
  await page.keyboard.press('End');
  await page.keyboard.type(' ');
  await page.keyboard.press('Control+z');
  assert.equal(await editor.inputValue(), 'mostrar("ATAJO_F5")>>');
  await page.keyboard.press('Control+y');
  assert.equal(await editor.inputValue(), 'mostrar("ATAJO_F5")>> ');
  await page.keyboard.press('Control+s');
  assert.equal(await editor.evaluate((el) => document.activeElement === el), true);
  await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
  await page.screenshot({ path: fileURLToPath(new URL('../test-results/electron-window-controls.png', import.meta.url)), fullPage: true });
  const started = workerPids().filter((pid) => !before.includes(pid));
  if (process.platform === 'win32') assert.ok(started.length > 0, 'Real Python worker must be running');
  const exited = new Promise((resolve) => desktop.process().once('exit', resolve));
  await page.getByLabel('Cerrar ventana', { exact: true }).click();
  await Promise.race([exited, setTimeout(15_000, undefined, { ref: false }).then(() => assert.fail('Custom close did not exit Electron'))]);
  desktop = undefined;
  await eventually(() => started.every((pid) => !workerPids().includes(pid)), 'Python worker remained after custom close');
  console.log('Controles originales: minimizar, maximizar/restaurar, cierre y limpieza Python; menús, F5, Ctrl+S/A/Z/Y verificados.');
  console.log('Regiones drag/no-drag y resize programático verificados. Arrastre y bordes nativos requieren revisión manual.');
} finally {
  if (desktop) await desktop.close();
  vite.processHandle.kill();
}
