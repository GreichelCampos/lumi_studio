import { Buffer } from 'node:buffer';
import type { BackendInput } from '../renderer/src/services/integration/desktopBridge';
import { WorkerError } from './backendError';

export function validateInput(raw: unknown): BackendInput {
  const fail = (): never => { throw new WorkerError('INVALID_IPC_INPUT', 'Solicitud de proyecto inválida o excesiva.'); };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail();
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).sort().join(',') !== 'entryFile,files') return fail();
  if (typeof value.entryFile !== 'string' || !value.entryFile || value.entryFile.includes('\0')) return fail();
  if (!value.files || typeof value.files !== 'object' || Array.isArray(value.files)) return fail();
  const entries = Object.entries(value.files);
  if (entries.length < 1 || entries.length > 128) return fail();
  const files: Record<string, string> = Object.create(null);
  for (const [name, content] of entries) {
    if (!name || name.includes('\0') || Buffer.byteLength(name) > 1024
      || typeof content !== 'string' || Buffer.byteLength(content) > 262_144) return fail();
    files[name] = content;
  }
  if (!Object.hasOwn(files, value.entryFile)) return fail();
  const input = { entryFile: value.entryFile, files };
  // Leave room for the protocol envelope and its UUID.
  if (Buffer.byteLength(JSON.stringify(input)) > 1_048_000) return fail();
  return input;
}
