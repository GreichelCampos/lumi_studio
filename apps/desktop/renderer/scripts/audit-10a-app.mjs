import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync, openSync } from 'node:fs';
import { join, resolve, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { realpath } from 'node:fs/promises';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const desktop = join(root,'apps/desktop'); const dist = join(desktop,'renderer/dist');
if (!existsSync(join(dist,'index.html'))) throw new Error('Build renderer first');
const temp = await realpath(mkdtempSync(join(tmpdir(),'lumi-10a-app-')));
const userData = join(temp,'profile'); const project = join(temp,'AuditLumi');
mkdirSync(userData); mkdirSync(project);
const cases = JSON.parse(readFileSync(join(root,'docs/audits/phase10a/cases.json'),'utf8'));
writeFileSync(join(project,'principal.lumi'), cases.find(item => item.id === 'furniture-material-rotation').files['principal.lumi']);
writeFileSync(join(userData,'workspaces.json'),JSON.stringify({ version:1,lastActive:'audit',projects:[{
  id:'audit',root:project,description:'Auditoría aislada',fileIds:{'principal.lumi':'main'},entryPath:'principal.lumi',
  activePath:'principal.lumi',tabPaths:['principal.lumi'],createdAt:'2026-11-04T00:00:00Z',
}] }));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'};
const server = createServer((request,response) => {
  const path = resolve(dist,'.'+decodeURIComponent(new URL(request.url,'http://localhost').pathname === '/' ? '/index.html' : new URL(request.url,'http://localhost').pathname));
  if (!path.startsWith(resolve(dist)+sep)) { response.writeHead(403).end(); return; }
  try { response.writeHead(200,{'Content-Type':types[extname(path)] ?? 'application/octet-stream'}); response.end(readFileSync(path)); }
  catch { response.writeHead(404).end(); }
});
server.listen(5189,'127.0.0.1',() => {
  const require = createRequire(join(desktop,'package.json'));
  const env = { ...process.env,LUMI_RENDERER_URL:'http://127.0.0.1:5189/',LUMI_CSP_NONCE:randomBytes(16).toString('base64') }; delete env.ELECTRON_RUN_AS_NODE;
  const app = spawn(require('electron'),[desktop,`--user-data-dir=${userData}`],{
    cwd:desktop,env,windowsHide:false,stdio:['ignore',openSync(join(temp,'app.log'),'a'),openSync(join(temp,'error.log'),'a')],
  });
  app.on('exit',code=>{ console.log(`Electron exit ${code}`); server.close(); });
  console.log(JSON.stringify({ pid:app.pid,profile:'temporary isolated profile',port:5189 }));
});
