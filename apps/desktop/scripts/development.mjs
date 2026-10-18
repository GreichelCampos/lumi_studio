import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const desktopRoot = fileURLToPath(new URL('..', import.meta.url));

export async function startVite(port = Number(process.env.LUMI_DEV_PORT ?? 5173)) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Puerto Vite inválido.');
  const nonce = randomBytes(24).toString('base64');
  const env = { ...process.env, LUMI_CSP_NONCE: nonce };
  const processHandle = spawn(process.execPath, [
    resolve(desktopRoot, 'renderer/node_modules/vite/bin/vite.js'),
    '--host', '127.0.0.1', '--port', String(port), '--strictPort',
  ], { cwd: resolve(desktopRoot, 'renderer'), env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let failure;
  processHandle.once('error', (error) => { failure = error; });
  processHandle.once('exit', (code) => { failure = new Error(`Vite terminó: ${code}`); });
  processHandle.stdout.on('data', (data) => process.stdout.write(data));
  processHandle.stderr.on('data', (data) => process.stderr.write(data));
  const url = `http://127.0.0.1:${port}/`;
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (failure) throw failure;
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(300) });
        // Verify this server uses our nonce, rather than attaching to an occupied port.
        if (response.ok && (await response.text()).includes(nonce)) return { processHandle, url, nonce };
      } catch { /* The server is still starting. */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Vite no inició en el tiempo esperado.');
  } catch (error) { processHandle.kill(); throw error; }
}
