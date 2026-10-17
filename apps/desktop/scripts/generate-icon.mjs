import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import electron from 'electron';

// Reuse Electron's image decoder/resampler; no additional image dependencies.
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, [fileURLToPath(new URL('./generate-icon.cjs', import.meta.url))], {
  env, stdio: 'inherit', windowsHide: true,
});
child.once('error', (error) => { console.error(error); process.exitCode = 1; });
child.once('exit', (code) => { process.exitCode = code ?? 1; });
