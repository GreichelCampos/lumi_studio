import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout } from 'node:timers/promises';
import { UUID } from 'builder-util-runtime';

const config = JSON.parse(await readFile('electron-builder.json', 'utf8'));
const manifest = JSON.parse(await readFile('package.json', 'utf8'));
const guid = UUID.v5(config.appId, UUID.parse('50e065bc-3134-11e6-9bab-38c9862bdaf3'));
const registry = `Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${guid}`;
const run = (file, args, options = {}) => new Promise((yes, no) => {
  const child = spawn(file, args, { windowsHide: true, shell: false, stdio: 'inherit', ...options });
  child.on('error', no);
  child.on('close', code => code === 0 ? yes() : no(new Error(`${file}: exit ${code}`)));
});
for (const hive of ['HKCU', 'HKLM']) {
  let exists = true;
  try { await run('reg.exe', ['query', `${hive}\\${registry}`], { stdio: 'ignore' }); } catch { exists = false; }
  assert.equal(exists, false, 'Hay una instalación previa de Lumi: no se alterará.');
}
const root = await mkdtemp(join(tmpdir(), 'lumi-installer-'));
const destination = join(root, 'Instalación Lumi');
assert.ok(destination.startsWith(resolve(tmpdir()) + '\\'));
const sentinel = join(root, 'proyecto-conservar.lumi');
const evidence = join(root, 'workspace-evidence.json');
await writeFile(sentinel, 'principal {}');
const installer = resolve(`dist/release/Estudio-Lumi-${manifest.version}-x64-setup.exe`);
let installed = false;
let verified = false;
try {
  await run(installer, ['/S', `/D=${destination}`]);
  await stat(join(destination, 'Estudio Lumi.exe'));
  installed = true;
  await run(process.execPath, ['tests/packaged.integration.mjs'], {
    env: { ...process.env, LUMI_PACKAGED_DIR: destination, LUMI_TEST_EVIDENCE: evidence },
  });
  verified = true;
} finally {
  if (installed) {
    const workspace = JSON.parse(await readFile(evidence, 'utf8'));
    const sourceBefore = await readFile(join(workspace.project, 'principal.lumi'), 'utf8');
    const metadataBefore = await readFile(join(workspace.profile, 'workspaces.json'), 'utf8');
    const uninstaller = (await readdir(destination)).find(name => /^Uninstall.*\.exe$/i.test(name));
    assert.ok(uninstaller, 'No se encontró el desinstalador en la instalación temporal.');
    await run(join(destination, uninstaller), ['/S']);
    let removed = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { await stat(join(destination, 'Estudio Lumi.exe')); }
      catch (error) { if (error.code === 'ENOENT') { removed = true; break; } throw error; }
      await setTimeout(200);
    }
    assert.equal(removed, true, 'La desinstalación no terminó.');
    assert.equal(await readFile(sentinel, 'utf8'), 'principal {}');
    assert.equal(await readFile(join(workspace.project, 'principal.lumi'), 'utf8'), sourceBefore);
    assert.equal(await readFile(join(workspace.profile, 'workspaces.json'), 'utf8'), metadataBefore);
    console.log(`NSIS uninstall and project preservation verified; installed application checks ${verified ? 'passed' : 'failed'}. Evidence directory: ${root}`);
  }
}
