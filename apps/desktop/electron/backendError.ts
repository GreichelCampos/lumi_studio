import type { BackendError } from '../renderer/src/services/integration/desktopBridge';

export class WorkerError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

export function backendError(error: unknown): BackendError {
  return error instanceof WorkerError ? { code: error.code, message: error.message }
    : { code: 'BACKEND_ERROR', message: error instanceof Error ? error.message : 'Fallo técnico del backend.' };
}
