import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, cpus, release, platform, arch } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const output = join(root,'docs/audits/phase10a'); const temp = mkdtempSync(join(tmpdir(),'lumi-10a-graphics-'));
const require = createRequire(import.meta.url);
require('esbuild').buildSync({ entryPoints:[join(root,'apps/desktop/renderer/scripts/audit-10a-webgl.ts')],bundle:true,platform:'browser',outfile:join(temp,'probe.js') });
writeFileSync(join(temp,'probe.html'),'<html><body><script src="probe.js"></script></body></html>');
const chrome = process.argv[2] ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const result = spawnSync(chrome,['--headless','--no-first-run','--disable-extensions',`--user-data-dir=${join(temp,'profile')}`,
  '--dump-dom','--timeout=45000',`file:///${join(temp,'probe.html').replaceAll('\\','/')}`],{
  encoding:'utf8',windowsHide:true,timeout:55000,maxBuffer:12*1024*1024,
});
if (result.status !== 0) throw new Error(result.stderr || String(result.error));
const pre=result.stdout.match(/<pre>(.*?)<\/pre>/s); if (!pre) throw new Error('Missing audit result');
const data=JSON.parse(pre[1].replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&'));
writeFileSync(join(output,'webgl-results.json'),JSON.stringify(data.records,null,2)+'\n');
mkdirSync(join(output,'evidence'),{recursive:true});
for(const [name,url] of Object.entries(data.images)) writeFileSync(join(output,'evidence',name+'.png'),Buffer.from(url.split(',')[1],'base64'));
writeFileSync(join(output,'environment.json'),JSON.stringify({platform:platform(),release:release(),architecture:arch(),cpu:cpus()[0]?.model,
  logicalProcessors:cpus().length,browser:data.records[0]?.environment,method:'Real Chrome WebGL; no FPS measurement or mass stress; 900x650; at most two placed objects'},null,2)+'\n');
if(data.records.some(row=>row.fatal)) throw new Error(JSON.stringify(data.records.filter(row=>row.fatal)));
console.log(JSON.stringify({records:data.records.length,images:Object.keys(data.images).length,webglErrors:data.records.filter(row=>row.glError).length}));
