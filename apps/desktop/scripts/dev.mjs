import { spawn } from 'node:child_process';
import electron from 'electron';
import { desktopRoot, startVite } from './development.mjs';
import './build.mjs';

const vite = await startVite();
const env = { ...process.env, LUMI_RENDERER_URL: vite.url, LUMI_CSP_NONCE: vite.nonce };
delete env.ELECTRON_RUN_AS_NODE;
const desktop = spawn(electron, ['.'], { cwd: desktopRoot, env, stdio: ['inherit', 'inherit', 'inherit', 'ipc'] });
desktop.once('error', (error) => { console.error(error); vite.processHandle.kill(); process.exitCode = 1; });
desktop.once('exit', (code) => { vite.processHandle.kill(); process.exitCode = code ?? 1; });
function shutdown() {
  // Ask main to close its worker before exiting; do not terminate Electron first.
  if (desktop.connected) desktop.send({ type: 'shutdown' });
  vite.processHandle.kill();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
process.on('message', (message) => {
  if (message?.type === 'shutdown') shutdown();
});
