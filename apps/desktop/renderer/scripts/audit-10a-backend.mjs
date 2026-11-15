import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const output = resolve(root, 'docs/audits/phase10a');
mkdirSync(join(output, 'programs'), { recursive: true });
const cases = [];
function add(id, category, source, expected = {}, extra = {}) {
  cases.push({ id, category, files: { 'principal.lumi': source, ...extra }, expected });
}
add('types-expressions', 'language', 'principal { entero n = 3>> decimal d = 1.5>> texto nombre = "Lumi">> booleano activo = verdadero>> mostrar(n + 2)>> mostrar(d * 2)>> mostrar(nombre)>> mostrar(activo)>> }', { output: ['5', '3.0', 'Lumi', 'verdadero'] });
add('condition-loops', 'language', 'principal { entero total = 0>> hacer entero i = 0; i < 3; i = i + 1 { total = total + i>> } mientras total < 5 { total = total + 1>> } si total == 5 { mostrar("cinco")>> } sino { mostrar("otro")>> } }', { output: ['cinco'] });
add('functions-imports', 'language', 'importar "calculos.lumi" usar area>> principal { mostrar(area(6,5))>> }', { output: ['30'] }, { 'calculos.lumi': 'funcion decimal area(decimal ancho, decimal largo) { retornar ancho * largo>> }' });
add('leer', 'input', 'principal { texto nombre = leer("Nombre:")>> mostrar(nombre)>> }');
add('lexical-error', 'error', 'principal { @ }');
add('syntax-error', 'error', 'principal { entero numero = >> }');
add('semantic-error', 'error', 'principal { entero numero = "texto">> }');
add('runtime-error', 'error', 'principal { entero divisor = 0>> mostrar(10 / divisor)>> }');
add('furniture-material-rotation', 'scene', 'principal { habitacion sala(6,5,3) { piso base { color "#d6b98c">> material "madera">> } mesa centro { color "#ff2200">> material "acero">> } silla lateral { color "#2255ff">> } colocar centro [0,0,0]>> rotar centro [0,45,0]>> colocar lateral [-2,0,-1]>> } }', { rooms: [{ name: 'sala', dimensions: [6,5,3], objects: [{ name: 'centro', position: [0,0,0], rotation: [0,45,0], color: '#ff2200', material: 'acero' }, { name: 'lateral', position: [-2,0,-1] }] }] });
add('unplaced-furniture', 'scene', 'principal { habitacion sala(5,5,3) { mesa declarada {} silla colocada {} colocar colocada [0,0,0]>> } }', { placed: 1, unplaced: 1 });
add('multiple-rooms', 'scene', 'principal { habitacion pequena(0.1,0.1,0.1) {} habitacion sala(5,4,3) { mesa centro {} colocar centro [0,0,0]>> } habitacion grande(1000,1000,1000) {} }', { roomCount: 3 });
add('four-declared-walls', 'architecture', 'principal { habitacion sala(6,5,3) { pared frente { orientacion "norte">> color "#aa2222">> } pared atras { orientacion "sur">> } pared derecha { orientacion "este">> } pared izquierda { orientacion "oeste">> } } }');
add('declared-door', 'architecture', 'principal { habitacion sala(6,5,3) { puerta entrada { orientacion "norte">> ancho 1>> alto 2>> desplazamiento 0>> } } }');
add('declared-window', 'architecture', 'principal { habitacion sala(6,5,3) { ventana luz { orientacion "este">> ancho 1>> alto 1>> desplazamiento 1>> elevacion 0>> } } }');
add('legacy-declared-wall', 'architecture', 'principal { habitacion sala(6,5,3) { pared frente { color "#aa2222">> } } }');
for (const scale of ['0.000000001','0.000001','0.01','0.1','1','5','100','1000','10000','1000000']) {
  for (const object of [false,true]) add(`size-${scale}-${object ? 'object' : 'empty'}`, 'dimensions', `principal { habitacion sala(${scale},${scale},${scale}) { ${object ? 'mesa centro {} colocar centro [0,0,0]>> rotar centro [0,35,0]>>' : ''} } }`, { dimensions: [Number(scale),Number(scale),Number(scale)], object });
}
for (const scale of ['0','-1']) add(`invalid-size-${scale}`, 'dimensions', `principal { habitacion sala(${scale},5,3) {} }`);
for (const [id, dims] of [['flat',[10000,0.01,0.01]],['tall',[0.01,0.01,10000]],['long',[0.1,1000,3]]]) {
  add(`disproportion-${id}`, 'dimensions', `principal { habitacion sala(${dims.join(',')}) {} }`, { dimensions: dims });
}
for (const item of cases) {
  const directory = join(output, 'programs', item.id); mkdirSync(directory, { recursive: true });
  for (const [name, source] of Object.entries(item.files)) writeFileSync(join(directory, name), source + '\n');
}
writeFileSync(join(output, 'cases.json'), JSON.stringify(cases, null, 2) + '\n');
const python = String.raw`
import json,sys,dataclasses,contextlib,io
from services.compiler_service import CompilerService
from services.execution_service import ExecutionService
from services.protocol.dispatcher import RequestDispatcher
cases=json.load(sys.stdin); rows=[]
for item in cases:
    compilation=CompilerService().compile_project(item['files'],entry_file='principal.lumi')
    try:
        execution=ExecutionService().execute(compilation)
        runtime={'status':execution.status.value,'output':list(execution.output),'diagnostics':[dataclasses.asdict(x) for x in execution.diagnostics], 'scene':dataclasses.asdict(execution.scene_plan) if execution.scene_plan else None}
    except Exception as error:
        runtime={'exceptionType':type(error).__name__,'message':str(error)}
    dispatcher=RequestDispatcher(log=io.StringIO())
    responses=[dispatcher.dispatch({'protocolVersion':'1.0.0','requestId':item['id']+'-'+operation,'operation':operation,'entryFile':'principal.lumi','files':item['files']}) for operation in ['analyze','execute']]
    rows.append({'id':item['id'],'compilationStatus':compilation.status.value,'stage':compilation.stage.value,'runtime':runtime,'responses':responses})
json.dump(rows,sys.stdout,ensure_ascii=True,allow_nan=False)
`;
const run = spawnSync(join(root, '.venv/Scripts/python.exe'), ['-c', python], {
  cwd: root, input: JSON.stringify(cases), encoding: 'utf8', windowsHide: true,
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, timeout: 60000, maxBuffer: 12 * 1024 * 1024,
});
if (run.status !== 0) throw new Error(run.stderr || String(run.error));
const rows = JSON.parse(run.stdout);
writeFileSync(join(output, 'python-results.json'), JSON.stringify(rows, null, 2) + '\n');
const requests=cases.flatMap(item=>['analyze','execute'].map(operation=>({protocolVersion:'1.0.0',requestId:item.id+'-'+operation,operation,entryFile:'principal.lumi',files:item.files})));
const worker=spawnSync(join(root,'.venv/Scripts/python.exe'),['-m','services.worker'],{
  cwd:root,input:requests.map(item=>JSON.stringify(item)).join('\n')+'\n',encoding:'utf8',windowsHide:true,
  env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},timeout:60000,maxBuffer:12*1024*1024,
});
if(worker.status!==0) throw new Error(worker.stderr || String(worker.error));
const replies=worker.stdout.trim().split(/\r?\n/).map(line=>JSON.parse(line));
assert.deepEqual(replies,rows.flatMap(row=>row.responses));
writeFileSync(join(output,'worker-results.json'),JSON.stringify({responses:replies,matchDispatcher:true,stderrReportedInputUnavailable:worker.stderr.includes('InputUnavailableError')},null,2)+'\n');
console.log(JSON.stringify({ cases: rows.length, statuses: rows.reduce((counts, row) => {
  const status = row.responses[1].status; counts[status] = (counts[status] ?? 0) + 1; return counts;
}, {}) }));
