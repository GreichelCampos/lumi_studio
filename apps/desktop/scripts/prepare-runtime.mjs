import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Este paquete requiere Windows x64.');
const desktop = fileURLToPath(new URL('..', import.meta.url));
const root = resolve(desktop, '../..');
const config = JSON.parse(await readFile(join(desktop, 'packaging/python-runtime.json'), 'utf8'));
const output = join(desktop, 'dist/runtime');
await mkdir(output, { recursive: true });
const archive = join(output, `python-${config.version}.zip`);
let bytes;
try { bytes = await readFile(archive); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!bytes) {
  const response = await fetch(config.url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Descarga de CPython fallida: ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
}
const digest = createHash('sha256').update(bytes).digest('hex');
if (digest !== config.sha256) throw new Error('Checksum SHA-256 incorrecto: no se incorporará CPython.');
await writeFile(archive, bytes);
const python = join(output, 'python');
const extract = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
  'Expand-Archive -LiteralPath $env:LUMI_RUNTIME_ZIP -DestinationPath $env:LUMI_RUNTIME_DEST -Force'], {
  env: { ...process.env, LUMI_RUNTIME_ZIP: archive, LUMI_RUNTIME_DEST: python }, windowsHide: true, stdio: 'inherit',
});
if (extract.error) throw extract.error;
if (extract.status !== 0) throw new Error('No se pudo extraer CPython.');
await writeFile(join(python, 'python313._pth'), 'python313.zip\n.\n../backend\n');
for (const name of ['services', 'lumi_language', 'spatial']) {
  await cp(join(root, name), join(output, 'backend', name), { recursive: true,
    filter: source => !source.includes('__pycache__') && !source.endsWith('.pyc'),
  });
}
const probe = spawnSync(join(python, 'python.exe'), ['-I', '-B', '-c',
  'import sys; from services.protocol.dispatcher import RequestDispatcher; print(sys.version)'], {
  cwd: join(output, 'backend'), windowsHide: true, encoding: 'utf8',
});
if (probe.error) throw probe.error;
if (probe.status !== 0) throw new Error(`El runtime no pudo cargar Lumi: ${probe.stderr}`);
console.log(`CPython verificado: ${digest}\n${probe.stdout.trim()}`);
