import { afterEach, describe, expect, it } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { resolve } from 'node:path';
import { PythonWorker } from '../electron/pythonWorker';
import { pythonExecutable } from '../electron/pythonConfig';
import { JsonLines } from '../electron/jsonLines';

const root = resolve('../..');
const input = { entryFile: 'principal.lumi', files: { 'principal.lumi': 'mostrar("PYTHON_REAL")>>' } };
const workers: PythonWorker[] = [];
afterEach(async () => { await Promise.all(workers.splice(0).map((worker) => worker.close())); });
function track(worker: PythonWorker): PythonWorker { workers.push(worker); return worker; }

describe('Python worker supervision', () => {
  it('starts the real worker, associates consecutive responses and closes it', async () => {
    const worker = track(new PythonWorker({ root }));
    await worker.start();
    expect(worker.availability().available).toBe(true);
    const first = await worker.request('analyze', input);
    const second = await worker.request('execute', input);
    expect(first.operation).toBe('analyze');
    expect(second.operation).toBe('execute');
    expect(first.requestId).not.toBe(second.requestId);
    expect(second.status).toBe('completed');
    if (second.status !== 'error') expect(second.result.output).toEqual(['PYTHON_REAL']);
    await worker.close();
    expect(worker.availability().available).toBe(false);
    await expect(worker.request('execute', input)).rejects.toMatchObject({ code: 'WORKER_CLOSED' });
  });

  it('reports an unavailable executable without fallback', async () => {
    const worker = track(new PythonWorker({ root, python: resolve('missing-python.exe') }));
    await expect(worker.request('execute', input)).rejects.toMatchObject({ code: 'PYTHON_UNAVAILABLE' });
    expect(worker.availability().available).toBe(false);
  });

  it.each([
    ['fragment', null], ['crash', 'WORKER_EXITED'], ['invalid', 'INVALID_RESPONSE'], ['wrong-id', 'UNEXPECTED_RESPONSE'],
  ])('handles a %s transport', async (mode, code) => {
    let child: ChildProcessWithoutNullStreams | undefined;
    const worker = track(new PythonWorker({ root, createProcess: () => {
      child = spawn(pythonExecutable(root), ['-u', 'tests/fixtures/transport_worker.py', mode!], {
        cwd: resolve('.'), stdio: 'pipe', windowsHide: true, shell: false,
      });
      return child;
    } }));
    if (code) await expect(worker.request('execute', input)).rejects.toMatchObject({ code });
    else {
      const response = await worker.request('execute', input);
      expect(response.status).toBe('error');
      if (response.status === 'error') expect(response.error.message).toBe('fixture 🏠');
    }
    await worker.close();
    expect(child?.exitCode !== null || child?.signalCode !== null).toBe(true);
  });

  it('terminates on timeout, rejects pending requests and allows controlled restart', async () => {
    let mode = 'hang';
    const children: ChildProcessWithoutNullStreams[] = [];
    const options = { root, timeoutMs: 150, stopTimeoutMs: 100, createProcess: () => {
      const child = spawn(pythonExecutable(root), ['-u', 'tests/fixtures/transport_worker.py', mode], {
        cwd: resolve('.'), stdio: 'pipe', windowsHide: true, shell: false,
      });
      children.push(child); return child;
    } };
    const worker = track(new PythonWorker(options));
    const results = await Promise.allSettled([worker.request('analyze', input), worker.request('execute', input)]);
    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    mode = 'fragment'; options.timeoutMs = 10_000;
    expect((await worker.request('execute', input)).status).toBe('error');
    expect(children).toHaveLength(2);
    expect(children[0].exitCode !== null || children[0].signalCode !== null).toBe(true);
  });

  it('buffers UTF-8 fragments and multiple frames with a bounded remainder', () => {
    const frames = new JsonLines();
    const bytes = Buffer.from('🏠\nsecond\n');
    expect(frames.push(bytes.subarray(0, 2))).toEqual([]);
    expect(frames.push(bytes.subarray(2))).toEqual(['🏠', 'second']);
    expect(() => frames.push(Buffer.alloc(4_194_305))).toThrow();
    expect(() => new JsonLines().push(Buffer.from([255, 10]))).toThrow();
  });
});
