import assert from 'node:assert/strict';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { startVite } from '../scripts/development.mjs';
import { launchDesktop, temporaryWorkspace } from './workspaceHarness.mjs';

const workspace = await temporaryWorkspace();
const vite = await startVite(Number(process.env.LUMI_TEST_PORT ?? 5176));
const env = { ...process.env, LUMI_RENDERER_URL: vite.url, LUMI_CSP_NONCE: vite.nonce };
delete env.ELECTRON_RUN_AS_NODE;
let desktop;
async function eventually(check, message) {
  for (let i = 0; i < 100; i++) {
    if (await check()) return;
    await setTimeout(100);
  }
  assert.fail(message);
}
const metadata = async () => JSON.parse(await readFile(join(workspace.userData, 'workspaces.json'), 'utf8'));
async function chooseFolder(path) {
  await desktop.evaluate(({ dialog }, chosen) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [chosen] });
  }, path);
}
async function menu(page, label) {
  await page.getByRole('button', { name: 'Archivo', exact: true }).first().click();
  await page.getByRole('button', { name: label, exact: true }).click();
}
async function save(page, path, expected) {
  await page.locator('textarea').focus();
  await page.keyboard.press('Control+s');
  await page.getByText('Guardado', { exact: true }).waitFor();
  assert.equal(await readFile(path, 'utf8'), expected, `Content was not saved: ${path}`);
}
try {
  desktop = await launchDesktop(env, workspace);
  let page = await desktop.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.locator('textarea').waitFor();
  await chooseFolder(workspace.root);
  await page.getByLabel('Nuevo proyecto Lumi', { exact: true }).click();
  await page.getByPlaceholder('Ej: ApartamentoModerno').fill('CasaReal');
  await page.getByRole('button', { name: 'Elegir carpeta...', exact: true }).click();
  await page.getByRole('button', { name: 'Crear proyecto', exact: true }).click();
  await page.locator('#modal-new-project').waitFor({ state: 'hidden' });
  const root = join(workspace.root, 'CasaReal');
  await eventually(async () => (await metadata()).projects.some(p => p.root === root), 'Project root was not persisted');
  const editor = page.locator('textarea');
  await editor.fill('principal {\n  habitacion sala(5 4, 3) {}\n}');
  await page.getByRole('button', { name: 'Ejecutar Lumi', exact: true }).click();
  await page.getByRole('button', { name: /Diagnósticos/ }).click();
  await page.getByText(/Falta una coma después del ancho/).first().waitFor();
  await page.getByRole('button', { name: 'Ir al código (principal.lumi:2)', exact: true }).click();
  await editor.press('F1');
  const help = page.locator('#modal-documentation');
  await help.getByRole('heading', { name: 'Primeros pasos' }).waitFor();
  const copiedCode = await help.locator('pre').first().innerText();
  await help.getByRole('button', { name: 'Copiar código', exact: true }).first().click();
  await help.getByText('Código copiado', { exact: true }).waitFor();
  assert.equal(await desktop.evaluate(({ clipboard }) => clipboard.readText()), copiedCode);

  await desktop.evaluate(({ session }) => {
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
      callback({ cancel: !details.url.startsWith('http://127.0.0.1:') });
    });
  });
  await help.getByRole('searchbox', { name: 'Buscar en la ayuda' }).fill('archivo principal');
  await help.getByText('Identificar el archivo principal', { exact: true }).waitFor();
  await help.getByRole('button', { name: 'Guía del IDE', exact: true }).click();
  await help.getByText('Compilar y Ejecutar Lumi', { exact: true }).click();
  await help.getByText(/Algunas comprobaciones dependen de los valores/).waitFor();
  await help.getByRole('button', { name: 'Palabras reservadas', exact: true }).click();
  await help.getByText('Palabras reservadas y estructuras principales', { exact: true }).waitFor();
  await help.getByRole('button', { name: 'Errores frecuentes', exact: true }).click();
  await help.getByRole('heading', { name: 'Errores frecuentes' }).waitFor();
  await help.getByText('Paréntesis, corchetes y comas', { exact: true }).click();
  await help.getByText(/Un vector va entre corchetes/).waitFor();
  await page.keyboard.press('Escape');
  await help.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Ayuda', exact: true }).click();
  await page.getByRole('button', { name: 'Acerca de Lumi Studio', exact: true }).click();
  const about = page.getByRole('dialog', { name: 'Acerca de Lumi Studio' });
  await about.getByText(/Lenguaje Unificado de Modelado de Interiores/).waitFor();
  assert.equal(await about.getByText('Errores frecuentes').count(), 0);
  const evidence = new URL('../test-results/', import.meta.url);
  await mkdir(evidence, { recursive: true });
  await about.screenshot({ path: fileURLToPath(new URL('acerca-de-lumi.png', evidence)) });
  await desktop.evaluate(({ shell }) => {
    globalThis.lumiAuditLinks = [];
    shell.openExternal = async (url) => { globalThis.lumiAuditLinks.push(url); };
  });
  const links = about.getByRole('link');
  const destinations = await links.evaluateAll(elements => elements.map(element => element.href));
  assert.equal(destinations.length, 4);
  for (const link of await links.all()) await link.click();
  await eventually(async () => (await desktop.evaluate(() => globalThis.lumiAuditLinks)).length === 4, 'About links did not reach the external browser');
  assert.deepEqual(await desktop.evaluate(() => globalThis.lumiAuditLinks), destinations);
  await page.keyboard.press('Escape');
  await about.waitFor({ state: 'hidden' });

  await editor.fill('funcion entero suma(ent a) { retornar a>> }');
  await page.getByRole('button', { name: 'Ejecutar Lumi', exact: true }).click();
  await page.getByText(/Escribí el tipo y el nombre, por ejemplo: entero cantidad/).waitFor();
  await editor.fill('principal { mostrar("CORREGIDO")>> }');
  await page.locator('#tab-salida-btn').click();
  await page.getByRole('button', { name: 'Ejecutar Lumi', exact: true }).click();
  await page.getByText('CORREGIDO', { exact: true }).waitFor();
  console.log('Malformed Lumi shows source location and a repair hint; F1 help and recovery verified.');
  const principal = 'importar "modulo.lumi" usar dividir>>\nprincipal { mostrar(dividir())>> }';
  await page.locator('textarea').fill(principal);
  await save(page, join(root, 'principal.lumi'), principal);
  await page.getByLabel('Nuevo archivo .lumi', { exact: true }).click();
  await page.getByPlaceholder(/mobiliario_comedor/).fill('modulo');
  await page.getByRole('button', { name: /Crear y abrir/i }).click();
  await page.locator('#modal-new-file').waitFor({ state: 'hidden' });
  const module = 'funcion decimal dividir() {\n  retornar 4 / 0>>\n}\n';
  await page.locator('textarea').fill(module);
  await save(page, join(root, 'modulo.lumi'), module);
  let record = (await metadata()).projects.find(p => p.root === root);
  const mainId = record.fileIds['principal.lumi'];
  const moduleId = record.fileIds['modulo.lumi'];
  assert.equal(record.entryPath, 'principal.lumi');
  assert.equal(record.activePath, 'modulo.lumi');
  const backendCheck = await page.evaluate(input => window.lumiDesktop.execute(input), {
    entryFile: 'principal.lumi', files: { 'principal.lumi': principal, 'modulo.lumi': module },
  });
  assert.equal(backendCheck.ok, true, JSON.stringify(backendCheck));
  assert.ok(backendCheck.response.result.diagnostics.some(d => d.code === 'RUN_DIVISION_BY_ZERO'), JSON.stringify(backendCheck));
  await page.getByRole('button', { name: 'Ejecutar Lumi', exact: true }).click();
  await page.getByRole('button', { name: /Diagnósticos/ }).click();
  await page.getByText('RUN_DIVISION_BY_ZERO', { exact: true }).waitFor();
  const location = page.getByText(/^modulo\.lumi:2:\d+$/, { exact: true });
  await location.waitFor();
  const column = Number((await location.textContent()).split(':')[2]);
  await page.getByTestId(`tab-${mainId}`).click();
  await eventually(async () => await page.getByTestId(`tab-${mainId}`).getAttribute('data-active-tab') === 'true', 'Main tab did not activate');
  await location.dblclick();
  await eventually(async () => await page.getByTestId(`tab-${moduleId}`).getAttribute('data-active-tab') === 'true', 'Diagnostic did not open its source file');
  assert.equal(await page.locator('textarea').evaluate(el => el.selectionStart), module.indexOf('\n') + 1 + column - 1);
  console.log('Real Python runs the project entry with the auxiliary tab active; cross-file diagnostic line and column verified.');

  const row = page.getByTestId(`explorer-file-${moduleId}`);
  await row.hover(); await row.getByTitle('Opciones de archivo', { exact: true }).click();
  await page.getByRole('button', { name: 'Establecer como principal', exact: true }).click();
  await eventually(async () => (await metadata()).projects.find(p => p.root === root).entryPath === 'modulo.lumi', 'Main file choice was not saved');
  await page.locator('textarea').fill(`${module}-- borrador`);
  await page.getByTestId(`tab-${moduleId}`).hover();
  await page.getByLabel('Cerrar pestaña modulo.lumi', { exact: true }).click();
  await page.getByText('Cambios sin guardar', { exact: true }).waitFor();
  await page.locator('#modal-unsaved-changes').getByRole('button', { name: 'Cancelar', exact: true }).click();
  assert.equal(await page.locator('textarea').inputValue(), `${module}-- borrador`);
  await page.getByTestId(`tab-${moduleId}`).hover();
  await page.getByLabel('Cerrar pestaña modulo.lumi', { exact: true }).click();
  await page.locator('#modal-unsaved-changes').getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByTestId(`tab-${moduleId}`).waitFor({ state: 'hidden' });
  assert.equal(await readFile(join(root, 'modulo.lumi'), 'utf8'), `${module}-- borrador`);
  await row.click();
  await eventually(async () => await page.getByTestId(`tab-${moduleId}`).getAttribute('data-active-tab') === 'true', 'Module tab did not reopen');
  await row.hover(); await row.getByTitle('Opciones de archivo', { exact: true }).click();
  await page.getByRole('button', { name: 'Renombrar...', exact: true }).click();
  await page.locator('#modal-rename-file input').fill('renombrado');
  await page.getByRole('button', { name: 'Guardar nombre', exact: true }).click();
  await page.locator('#modal-rename-file').waitFor({ state: 'hidden' });
  assert.equal(await readFile(join(root, 'renombrado.lumi'), 'utf8'), `${module}-- borrador`);
  assert.equal(await readFile(join(root, 'principal.lumi'), 'utf8'), principal);
  record = (await metadata()).projects.find(p => p.root === root);
  assert.equal(record.fileIds['renombrado.lumi'], moduleId);
  assert.equal(record.entryPath, 'renombrado.lumi');
  await desktop.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, join(root, 'copia.lumi'));
  await menu(page, 'Guardar archivo como...');
  await eventually(async () => await stat(join(root, 'copia.lumi')).then(() => true, () => false), 'Save as did not create a real file');
  await menu(page, 'Renombrar proyecto...');
  await page.getByLabel('Nuevo nombre del proyecto').fill('CasaRenombrada');
  await page.getByRole('button', { name: 'Renombrar', exact: true }).click();
  await page.getByLabel('Nuevo nombre del proyecto').waitFor({ state: 'hidden' });
  const renamedRoot = join(workspace.root, 'CasaRenombrada');
  assert.equal(await readFile(join(renamedRoot, 'principal.lumi'), 'utf8'), principal);
  console.log('Creation, writes, protected tabs, entry selection, file/project rename and save-as verified on disk.');
  await desktop.close(); desktop = undefined;
  desktop = await launchDesktop(env, workspace);
  page = await desktop.firstWindow();
  await page.locator('textarea').waitFor();
  await page.getByTestId(`tab-${moduleId}`).waitFor();
  assert.equal((await metadata()).projects.find(p => p.root === renamedRoot).entryPath, 'renombrado.lumi');
  assert.equal(await page.locator('textarea').inputValue(), `${module}-- borrador`);

  await page.locator('textarea').fill('mostrar("NO_GUARDADO")>>');
  await desktop.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 0; });
  await page.getByLabel('Cerrar ventana', { exact: true }).click();
  await setTimeout(200);
  assert.equal(page.isClosed(), false);
  assert.equal(await page.locator('textarea').inputValue(), 'mostrar("NO_GUARDADO")>>');
  assert.equal((await page.evaluate(() => window.lumiDesktop.availability())).available, true);
  await save(page, join(renamedRoot, 'copia.lumi'), 'mostrar("NO_GUARDADO")>>');
  await page.locator('textarea').fill('mostrar("BORRADOR_ENTRE_PROYECTOS")>>');

  const existing = join(workspace.root, 'ProyectoExterno');
  await mkdir(existing); await writeFile(join(existing, 'otro.lumi'), 'mostrar("EXTERNO")>>');
  await chooseFolder(existing);
  await page.keyboard.press('Control+o');
  await page.getByRole('button', { name: 'Abrir carpeta del disco...', exact: true }).click();
  await page.locator('#modal-open-project').waitFor({ state: 'hidden' });
  await eventually(async () => await page.locator('textarea').inputValue() === 'mostrar("EXTERNO")>>', 'External project tab did not open');
  assert.equal((await metadata()).projects.find(p => p.root === existing).entryPath, undefined);
  await page.keyboard.press('Control+o');
  record = (await metadata()).projects.find(p => p.root === renamedRoot);
  await page.getByTestId(`open-project-${record.id}`).getByRole('button', { name: 'Abrir', exact: true }).click();
  await page.locator('#modal-open-project').waitFor({ state: 'hidden' });
  await eventually(async () => await page.locator('textarea').inputValue() === 'mostrar("BORRADOR_ENTRE_PROYECTOS")>>', 'Draft was lost while switching projects');
  await save(page, join(renamedRoot, 'copia.lumi'), 'mostrar("BORRADOR_ENTRE_PROYECTOS")>>');
  const copyId = (await metadata()).projects.find(p => p.root === renamedRoot).fileIds['copia.lumi'];
  const copyRow = page.getByTestId(`explorer-file-${copyId}`);
  await copyRow.hover(); await copyRow.getByTitle('Opciones de archivo', { exact: true }).click();
  await page.getByRole('button', { name: 'Eliminar archivo', exact: true }).click();
  await page.getByRole('button', { name: 'Mover a la papelera', exact: true }).click();
  await page.locator('#modal-confirm-delete').waitFor({ state: 'hidden' });
  await assert.rejects(stat(join(renamedRoot, 'copia.lumi')), { code: 'ENOENT' });
  await desktop.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false }); });
  await page.keyboard.press('Control+o');
  const externalId = (await metadata()).projects.find(p => p.root === existing).id;
  const projectRow = page.getByTestId(`open-project-${externalId}`);
  await projectRow.hover(); await projectRow.getByTitle('Eliminar proyecto', { exact: true }).click();
  await eventually(async () => await stat(existing).then(() => false, error => error.code === 'ENOENT'), 'Native project trash operation failed');
  assert.deepEqual(errors, []);
  console.log('Reopen, main/tab persistence, native close cancellation, cross-project drafts, external folders and native file/project trash verified.');
} finally {
  if (desktop) {
    await desktop.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 1; }).catch(() => undefined);
    await desktop.close();
  }
  vite.processHandle.kill();
  await workspace.dispose();
}
