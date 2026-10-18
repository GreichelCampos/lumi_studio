import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { BackendInput, BackendAvailability } from '../renderer/src/services/integration/desktopBridge';
import { PROTOCOL_VERSION, type Operation, type ProtocolResponse } from '../renderer/src/services/integration/protocol/types';
import { parseProtocolResponse } from '../renderer/src/services/integration/protocol/responseValidator';
import { WorkerError } from './backendError';
import { JsonLines } from './jsonLines';
import { pythonExecutable } from './pythonConfig';
import { validateInput } from './requestValidation';

interface Pending {
  operation: Operation; timer: ReturnType<typeof setTimeout>;
  resolve(value: ProtocolResponse): void; reject(error: WorkerError): void;
}
export interface WorkerOptions {
  root: string; python?: string; timeoutMs?: number; stopTimeoutMs?: number;
  log?(message: string): void;
  createProcess?(): ChildProcessWithoutNullStreams;
}

/** One supervised process; a new explicit request may restart it after failure. */
export class PythonWorker {
  private child: ChildProcessWithoutNullStreams | null = null;
  private starting: Promise<void> | null = null;
  private stopping: Promise<void> | null = null;
  private pending = new Map<string, Pending>();
  private message = 'Python no iniciado.';
  private ready = false;
  private closing = false;

  constructor(private readonly options: WorkerOptions) {}

  availability(): BackendAvailability { return { available: this.ready, message: this.message }; }

  async start(): Promise<void> {
    if (this.closing) throw new WorkerError('WORKER_CLOSED', 'El backend se está cerrando.');
    if (this.stopping) await this.stopping;
    if (this.ready) return;
    if (this.starting) return this.starting;
    this.starting = new Promise<void>((resolve, reject) => {
      const child = this.options.createProcess?.() ?? spawn(pythonExecutable(this.options.root, this.options.python), ['-u', '-m', 'services.worker'], {
        cwd: this.options.root, stdio: 'pipe', shell: false, windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });
      this.child = child;
      const frames = new JsonLines();
      child.once('spawn', () => {
        this.ready = true; this.message = 'Proceso Python iniciado.'; resolve();
      });
      child.on('error', (error) => {
        const failure = new WorkerError('PYTHON_UNAVAILABLE', `No se pudo iniciar Python: ${error.message}`);
        this.message = failure.message; this.ready = false;
        this.rejectPending(failure); reject(failure);
      });
      child.stdout.on('data', (chunk: Buffer) => {
        try { for (const line of frames.push(chunk)) this.accept(line); }
        catch (error) {
          void this.terminate(error instanceof WorkerError ? error : new WorkerError('INVALID_RESPONSE', 'Respuesta Python inválida.'));
        }
      });
      child.stderr.on('data', (chunk: Buffer) => this.options.log?.(chunk.toString('utf-8')));
      child.stdin.on('error', () => { void this.terminate(new WorkerError('WORKER_PIPE_ERROR', 'Se cerró el canal de Python.')); });
      child.once('close', (code) => {
        if (this.child !== child) return;
        this.child = null; this.ready = false;
        const failure = new WorkerError('WORKER_EXITED', `Python terminó (código ${code ?? 'sin código'}).`);
        if (!this.stopping) this.message = failure.message;
        this.rejectPending(failure);
      });
    });
    try { await this.starting; } finally { this.starting = null; }
  }

  async request(operation: Operation, raw: BackendInput): Promise<ProtocolResponse> {
    const input = validateInput(raw);
    await this.start();
    if (this.closing) throw new WorkerError('WORKER_CLOSED', 'El backend se está cerrando.');
    if (!this.child || !this.ready) throw new WorkerError('PYTHON_UNAVAILABLE', this.message);
    if (this.pending.size >= 16) throw new WorkerError('BACKEND_BUSY', 'Hay demasiadas solicitudes pendientes.');
    const requestId = randomUUID();
    const data = JSON.stringify({ protocolVersion: PROTOCOL_VERSION, requestId, operation, ...input }) + '\n';
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        void this.terminate(new WorkerError('WORKER_TIMEOUT',
          'Se agotó el tiempo: el proceso Python fue finalizado. Una nueva solicitud lo reiniciará.'));
      }, this.options.timeoutMs ?? 10_000);
      this.pending.set(requestId, { operation, resolve, reject, timer });
      this.child!.stdin.write(data, 'utf-8', (error) => {
        if (error) void this.terminate(new WorkerError('WORKER_PIPE_ERROR', 'No se pudo enviar la solicitud a Python.'));
      });
    });
  }

  private accept(line: string): void {
    const parsed = parseProtocolResponse(line);
    if (!parsed.valid) throw new WorkerError('INVALID_RESPONSE', parsed.errors.join(' '));
    const response = parsed.value;
    const pending = response.requestId ? this.pending.get(response.requestId) : undefined;
    if (!pending || pending.operation !== response.operation) {
      throw new WorkerError('UNEXPECTED_RESPONSE', 'Python devolvió una respuesta sin solicitud asociada.');
    }
    clearTimeout(pending.timer); this.pending.delete(response.requestId!);
    pending.resolve(response);
  }

  private rejectPending(error: WorkerError): void {
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear();
  }

  private terminate(error: WorkerError, graceful = false): Promise<void> {
    if (this.stopping) return this.stopping;
    this.ready = false; this.message = error.message;
    this.rejectPending(error);
    const child = this.child;
    if (!child) return Promise.resolve();
    this.stopping = new Promise<void>((resolve) => {
      const timer = setTimeout(() => child.kill('SIGKILL'), this.options.stopTimeoutMs ?? 1000);
      child.once('close', () => { clearTimeout(timer); resolve(); });
      if (graceful) child.stdin.end(); else child.kill();
    }).finally(() => { this.stopping = null; });
    return this.stopping;
  }

  async close(): Promise<void> {
    this.closing = true;
    await this.terminate(new WorkerError('WORKER_CLOSED', 'Backend cerrado.'), true);
  }
}
