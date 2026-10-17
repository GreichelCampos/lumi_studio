import { afterEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { PythonWorker } from '../electron/pythonWorker';

const workers: PythonWorker[] = [];
afterEach(async () => { await Promise.all(workers.splice(0).map(worker => worker.close())); });

describe('Electron transport with scene response fixtures, not a Python scene producer', () => {
  it.each(['valid', 'absent', 'invalid'])('handles a %s fixture scene through the supervised process', async mode => {
    const worker = new PythonWorker({ root: resolve('../..'), createProcess: () => spawn(process.execPath,
      [resolve('tests/fixtures/scene-response-worker.fixture.mjs'), mode], {
        cwd: resolve('.'), stdio: 'pipe', windowsHide: true, shell: false,
      }) });
    workers.push(worker);
    const pending = worker.request('analyze', { entryFile: 'principal.lumi', files: { 'principal.lumi': '' } });
    if (mode === 'invalid') {
      await expect(pending).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
      return;
    }
    const reply = await pending;
    expect(reply.status).toBe('completed');
    if (reply.status === 'error') throw new Error('Unexpected fixture error');
    if (mode === 'absent') expect(reply.result.scenePlan).toBeUndefined();
    else expect(reply.result.scenePlan?.rooms[0]).toMatchObject({
      name: 'Fixture de transporte; no generado por Python', dimensions: [4, 3.5, 2.6],
    });
  });
});
