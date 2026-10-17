import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function pythonExecutable(root: string, configured = process.env.LUMI_PYTHON): string {
  if (configured) return configured;
  const local = join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  return existsSync(local) ? local : process.platform === 'win32' ? 'python' : 'python3';
}

export function workerTimeout(value = process.env.LUMI_PYTHON_TIMEOUT_MS): number {
  if (value === undefined) return 10_000;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 100 || number > 120_000) {
    throw new Error('LUMI_PYTHON_TIMEOUT_MS debe estar entre 100 y 120000.');
  }
  return number;
}
