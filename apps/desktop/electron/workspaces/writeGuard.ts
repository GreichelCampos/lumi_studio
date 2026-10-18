import * as fs from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export function writeConflict(): Error {
  return new Error('El archivo o su ruta cambió en disco. Reábralo antes de sobrescribirlo.');
}

async function fileState(path: string) {
  try {
    const before = await fs.lstat(path, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink()) throw writeConflict();
    const content = await fs.readFile(path);
    const after = await fs.lstat(path, { bigint: true });
    const identity = (stat: typeof before) => [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(':');
    if (identity(before) !== identity(after)) throw writeConflict();
    return { identity: identity(after), content };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function directoryState(path: string): Promise<string[]> {
  const result: string[] = [];
  for (let current = resolve(dirname(path));; current = dirname(current)) {
    const stat = await fs.lstat(current, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw writeConflict();
    result.push(`${await fs.realpath(current)}:${stat.dev}:${stat.ino}`);
    if (dirname(current) === current) return result;
  }
}

export async function createWriteGuard(path: string) {
  const directories = await directoryState(path);
  const initial = await fileState(path);
  const validateDirectory = async () => {
    const currentDirectories = await directoryState(path);
    if (JSON.stringify(currentDirectories) !== JSON.stringify(directories)) throw writeConflict();
  };
  const validate = async () => {
    await validateDirectory();
    const current = await fileState(path);
    if (initial === null ? current !== null
      : !current || initial.identity !== current.identity || !initial.content.equals(current.content)) throw writeConflict();
  };
  return { validate, validateDirectory };
}
