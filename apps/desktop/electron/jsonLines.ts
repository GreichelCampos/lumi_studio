import { MAX_RESPONSE_BYTES } from '../renderer/src/services/integration/protocol/types';
import { WorkerError } from './backendError';

export class JsonLines {
  private pending = Buffer.alloc(0);

  push(chunk: Buffer): string[] {
    this.pending = Buffer.concat([this.pending, chunk]);
    const lines: string[] = [];
    let end: number;
    while ((end = this.pending.indexOf(10)) >= 0) {
      if (end + 1 > MAX_RESPONSE_BYTES) throw new WorkerError('INVALID_RESPONSE', 'Respuesta Python excesiva.');
      const line = this.pending.subarray(0, end);
      this.pending = this.pending.subarray(end + 1);
      try { lines.push(new TextDecoder('utf-8', { fatal: true }).decode(line)); }
      catch { throw new WorkerError('INVALID_RESPONSE', 'Respuesta Python con UTF-8 inválido.'); }
    }
    if (this.pending.length > MAX_RESPONSE_BYTES) throw new WorkerError('INVALID_RESPONSE', 'Respuesta Python sin delimitador o excesiva.');
    return lines;
  }
}
