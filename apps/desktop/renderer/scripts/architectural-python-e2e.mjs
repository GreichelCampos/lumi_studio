import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const renderer = fileURLToPath(new URL('../', import.meta.url));
const [producerArg, pythonArg, chromeArg] = process.argv.slice(2);
if (!producerArg || !pythonArg || !chromeArg) throw new Error('Usage: node scripts/architectural-python-e2e.mjs <producer-worktree> <python.exe> <chrome.exe>');
const producer = resolve(producerArg);
const capture = JSON.parse(readFileSync(join(renderer, 'src/tests/fixtures/python/grei296fd57.real.json'), 'utf8'));
const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: producer, encoding: 'utf8', windowsHide: true });
assert.equal(revision.status, 0); assert.equal(revision.stdout.trim(), capture.producerCommit);
const requests = capture.cases.flatMap(item => ['analyze', 'execute'].map(operation => ({
  protocolVersion: '1.0.0', requestId: `${item.name}-${operation}`, operation, entryFile: item.file, files: { [item.file]: item.source },
})));
const worker = spawnSync(resolve(pythonArg), ['-m', 'services.worker'], {
  cwd: producer, input: requests.map(item => JSON.stringify(item)).join('\n') + '\n', encoding: 'utf8',
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, windowsHide: true, timeout: 60000, maxBuffer: 16 * 1024 * 1024,
});
assert.equal(worker.status, 0, worker.stderr); assert.equal(worker.stderr, '');
const responses = worker.stdout.trim().split(/\r?\n/).map(line => JSON.parse(line));
assert.equal(responses.length, requests.length);
const liveCases = capture.cases.map((item, index) => {
  const live = responses.slice(index * 2, index * 2 + 2);
  assert.deepEqual(live, item.responses, `Producer drift: ${item.name}`);
  return { ...item, responses: live };
});
const target = mkdtempSync(join(tmpdir(), 'lumi-5bb3-e2e-'));
const require = createRequire(import.meta.url);
require('esbuild').buildSync({ entryPoints: [join(renderer, 'scripts/architectural-python-webgl-probe.ts')],
  bundle: true, platform: 'browser', outfile: join(target, 'probe.js') });
writeFileSync(join(target, 'live-responses.json'), JSON.stringify(responses, null, 2));
writeFileSync(join(target, 'probe.html'), `<html><body><script>globalThis.lumiPythonCases=${JSON.stringify(liveCases).replace(/</g, '\\u003c')}</script><script src="probe.js"></script></body></html>`);
const chrome = spawnSync(resolve(chromeArg), ['--headless', '--no-first-run', '--disable-extensions',
  `--user-data-dir=${join(target, 'profile')}`, '--dump-dom', '--timeout=25000',
  `file:///${join(target, 'probe.html').replaceAll('\\', '/')}`], {
  encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 8 * 1024 * 1024,
});
assert.equal(chrome.status, 0, chrome.stderr);
writeFileSync(join(target, 'browser.html'), chrome.stdout);
const pre = chrome.stdout.match(/<pre>(.*?)<\/pre>/s);
assert.ok(pre, 'Missing browser result');
const rows = JSON.parse(pre[1].replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&'));
assert.ok(rows.every(row => !row.error), JSON.stringify(rows)); assert.equal(rows.length, capture.cases.length);
console.log(JSON.stringify({ producer: capture.producerCommit, requests: responses.length,
  cases: rows.length, rendered: rows.filter(row => row.rendered).length,
  selectionStates: rows.reduce((sum, row) => sum + (row.selections ?? 0), 0), results: rows, evidenceDirectory: target }, null, 2));
