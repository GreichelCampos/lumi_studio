import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { BackendInput, BackendAvailability, InputPrompt } from '../renderer/src/services/integration/desktopBridge';
import { PROTOCOL_VERSION, type Operation, type ProtocolResponse } from '../renderer/src/services/integration/protocol/types';
import { parseProtocolResponse } from '../renderer/src/services/integration/protocol/responseValidator';
import { WorkerError } from './backendError';
import { JsonLines } from './jsonLines';
import { pythonExecutable } from './pythonConfig';
import { validateInput } from './requestValidation';

interface Pending {
  operation: Operation; timer: ReturnType<typeof setTimeout>;
  onInput?: (prompt: InputPrompt | null) => void;
  inputId?: string;
  resolve(value: ProtocolResponse): void; reject(error: WorkerError): void;
}
export interface WorkerOptions {
  root: string; python?: string; timeoutMs?: number; stopTimeoutMs?: number;
  isolated?: boolean;
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
      const args = [...(this.options.isolated ? ['-I', '-B'] : []), '-u', '-m', 'services.worker'];
      const child = this.options.createProcess?.() ?? spawn(pythonExecutable(this.options.root, this.options.python), args, {
        cwd: this.options.root, stdio: 'pipe', shell: false, windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });
      this.child = child;
      const frames = new JsonLines();
      child.once('spawn', () => {
        this.ready = true; this.message = 'Proceso Python iniciado.'; resolve();
      });
      child.on('error', (error) => {
        const detail = this.options.isolated ? ' Reinstala Estudio Lumi para restaurar el runtime incluido.' : '';
        const failure = new WorkerError('PYTHON_UNAVAILABLE', `No se pudo iniciar Python: ${error.message}${detail}`);
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

  async request(
    operation: Operation, raw: BackendInput, onInput?: (prompt: InputPrompt | null) => void,
  ): Promise<ProtocolResponse> {
    const input = validateInput(raw);
    await this.start();
    if (this.closing) throw new WorkerError('WORKER_CLOSED', 'El backend se está cerrando.');
    if (!this.child || !this.ready) throw new WorkerError('PYTHON_UNAVAILABLE', this.message);
    // The next stdin frame must be the reply while Python is waiting for leer.
    if ((onInput && this.pending.size > 0) || [...this.pending.values()].some(pending => pending.onInput)
      || this.pending.size >= 16) {
      throw new WorkerError('BACKEND_BUSY', 'Espera a que termine la operación de Lumi antes de iniciar otra.');
    }
    const requestId = randomUUID();
    const data = JSON.stringify({ protocolVersion: PROTOCOL_VERSION, requestId, operation, ...input, ...(onInput ? { interactiveInput: true } : {}) }) + '\n';
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { operation, resolve, reject, timer: this.operationTimer(), onInput });
      this.child!.stdin.write(data, 'utf-8', (error) => {
        if (error) void this.terminate(new WorkerError('WORKER_PIPE_ERROR', 'No se pudo enviar la solicitud a Python.'));
      });
    });
  }

  private operationTimer(): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
      void this.terminate(new WorkerError('WORKER_TIMEOUT',
        'Se agotó el tiempo: el proceso Python fue finalizado. Una nueva solicitud lo reiniciará.'));
    }, this.options.timeoutMs ?? 10_000);
  }

  replyInput(raw: unknown): void {
    if (!raw || typeof raw !== 'object') throw new WorkerError('INVALID_INPUT_REPLY', 'Respuesta de entrada inválida.');
    const { requestId, inputId, value } = raw as Record<string, unknown>;
    if (typeof requestId !== 'string' || typeof inputId !== 'string'
      || (value !== null && (typeof value !== 'string' || value.length > 16_384))) {
      throw new WorkerError('INVALID_INPUT_REPLY', 'La respuesta debe ser texto de hasta 16.384 caracteres.');
    }
    const pending = this.pending.get(requestId);
    if (!pending?.onInput || pending.inputId !== inputId || !this.child) {
      throw new WorkerError('STALE_INPUT_REPLY', 'Esta solicitud de entrada ya terminó.');
    }
    pending.inputId = undefined;
    clearTimeout(pending.timer);
    pending.timer = this.operationTimer();
    this.child.stdin.write(JSON.stringify({ type: 'inputReply', requestId, inputId, value }) + '\n', 'utf-8', error => {
      if (error) void this.terminate(new WorkerError('WORKER_PIPE_ERROR', 'No se pudo enviar la entrada a Python.'));
    });
    pending.onInput(null);
  }

  private accept(line: string): void {
    const event: unknown = JSON.parse(line);
    if (event !== null && typeof event === 'object' && 'type' in event && event.type === 'inputRequest') {
      this.acceptInputPrompt(event as Record<string, unknown>);
      return;
    }
    const parsed = parseProtocolResponse(line);
    if (!parsed.valid) throw new WorkerError('INVALID_RESPONSE', parsed.errors.join(' '));
    const response = parsed.value;
    const pending = response.requestId ? this.pending.get(response.requestId) : undefined;
    if (!pending || pending.operation !== response.operation) {
      throw new WorkerError('UNEXPECTED_RESPONSE', 'Python devolvió una respuesta sin solicitud asociada.');
    }
    clearTimeout(pending.timer); this.pending.delete(response.requestId!);
    if (pending.inputId !== undefined) pending.onInput?.(null);
    pending.resolve(response);
  }

  private acceptInputPrompt(event: Record<string, unknown>): void {
    const { requestId, inputId, prompt } = event;
    const pending = typeof requestId === 'string' ? this.pending.get(requestId) : undefined;
    if (typeof requestId !== 'string' || typeof inputId !== 'string' || !/^[a-f0-9]{32}$/.test(inputId)
      || typeof prompt !== 'string' || prompt.length > 32_768
      || !pending?.onInput || pending.operation !== 'execute' || pending.inputId !== undefined) {
      throw new WorkerError('UNEXPECTED_RESPONSE', 'Python envió una solicitud de entrada inválida.');
    }
    clearTimeout(pending.timer);
    pending.inputId = inputId;
    pending.timer = setTimeout(() => {
      void this.terminate(new WorkerError('INPUT_TIMEOUT', 'Se agotó el tiempo para responder a leer.'));
    }, 5 * 60_000);
    pending.onInput({ requestId, inputId, prompt });
  }

  private rejectPending(error: WorkerError): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      if (pending.inputId !== undefined) pending.onInput?.(null);
      pending.reject(error);
    }
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
