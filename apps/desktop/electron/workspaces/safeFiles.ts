import * as fs from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { createWriteGuard } from './writeGuard';

export const MAX_PROJECT_FILES = 128;
export const MAX_SOURCE_BYTES = 262144;

export function safeName(value: string): string {
  if (!value || value.length > 180 || /[<>:"/\\|?*\x00-\x1f]/.test(value)
    || /[. ]$/.test(value) || value === '.' || value === '..'
    || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)) {
    throw new Error('Nombre de archivo o carpeta no válido.');
  }
  return value;
}

export function sourcePath(value: string): string {
  if (typeof value !== 'string' || value.length > 1024 || isAbsolute(value)
    || value.includes('\\') || !/\.lumi$/i.test(value)) throw new Error('Ruta .lumi no válida.');
  value.split('/').forEach(safeName);
  return value;
}

export async function inside(root: string, path: string, allowMissing = false): Promise<string> {
  sourcePath(path);
  const canonicalRoot = await fs.realpath(root);
  if (resolve(root).toLowerCase() !== canonicalRoot.toLowerCase()) throw new Error('La carpeta del proyecto cambió de ubicación.');
  const target = resolve(root, path);
  const rel = relative(root, target);
  if (rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) throw new Error('Ruta fuera del proyecto.');
  let current = root;
  const parts = path.split('/');
  for (let index = 0; index < parts.length; index++) {
    current = join(current, parts[index]);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink() || (index < parts.length - 1 && !stat.isDirectory())
        || (index === parts.length - 1 && !stat.isFile())) throw new Error('No se permiten enlaces ni rutas especiales.');
    } catch (error) {
      if (allowMissing && index === parts.length - 1 && isMissing(error)) return target;
      throw error;
    }
  }
  return target;
}

export function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export async function readSources(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = Object.create(null);
  let visited = 0;
  async function visit(folder: string, prefix: string): Promise<void> {
    if (++visited > 2048 || prefix.split('/').length > 32) throw new Error('La carpeta contiene demasiados directorios. Abra una carpeta de proyecto más específica.');
    if ((await fs.lstat(folder)).isSymbolicLink() || await fs.realpath(folder) !== folder) throw new Error('No se permiten enlaces en el proyecto.');
    for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const key = `${prefix}${entry.name}`;
      if (entry.isDirectory()) await visit(join(folder, entry.name), `${key}/`);
      else if (entry.isFile() && /\.lumi$/i.test(entry.name)) {
        if (Object.keys(result).length >= MAX_PROJECT_FILES) throw new Error('El proyecto supera 128 archivos .lumi.');
        const path = await inside(root, key);
        if ((await fs.stat(path)).size > MAX_SOURCE_BYTES) throw new Error(`Archivo demasiado grande: ${key}`);
        result[key] = await fs.readFile(path, 'utf8');
      }
    }
  }
  await visit(root, '');
  return result;
}

const REPLACE_DELAYS_MS = [25, 50, 100, 200, 400];

async function replaceFile(temp: string, path: string, validate: () => Promise<void>): Promise<void> {
  for (let attempt = 0;; attempt++) {
    await validate();
    try { await fs.rename(temp, path); return; }
    catch (error) {
      if (process.platform !== 'win32' || attempt >= REPLACE_DELAYS_MS.length
        || !(error instanceof Error) || !('code' in error)
        || !['EPERM', 'EACCES', 'EBUSY'].includes(String(error.code))) throw error;
      const target = await fs.lstat(path).catch(statError => { if (!isMissing(statError)) throw error; return null; });
      if (target && (target.mode & 0o222) === 0) throw error;
      await setTimeout(REPLACE_DELAYS_MS[attempt]);
    }
  }
}

export async function atomicWrite(path: string, content: string, validate?: () => Promise<void>): Promise<void> {
  await validate?.();
  const guard = await createWriteGuard(path);
  const temp = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
  let handle;
  let identity: { dev: bigint; ino: bigint } | undefined;
  let failed = false;
  let failure: unknown;
  try {
    handle = await fs.open(temp, 'wx');
    identity = await handle.stat({ bigint: true });
    await handle.writeFile(content, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await replaceFile(temp, path, async () => { await guard.validate(); await validate?.(); });
  } catch (error) {
    failed = true;
    failure = error;
    throw error;
  } finally {
    let cleanupError: unknown;
    try { await handle?.close(); } catch (error) { cleanupError = error; }
    try {
      if (identity) {
        try { await guard.validateDirectory(); }
        catch (error) { throw new Error(`No se pudo limpiar el temporal porque cambió su carpeta: ${temp}`, { cause: error }); }
        const current = await fs.lstat(temp, { bigint: true }).catch(error => { if (!isMissing(error)) throw error; return null; });
        if (current) {
          if (current.dev !== identity.dev || current.ino !== identity.ino || current.isSymbolicLink()) {
            throw new Error('El temporal cambió de identidad; no se eliminará un archivo ajeno.');
          }
          await fs.unlink(temp);
        }
      }
    } catch (error) { if (!isMissing(error)) cleanupError ??= error; }
    if (failed && cleanupError && failure instanceof Error && failure.cause === undefined) failure.cause = cleanupError;
    if (!failed && cleanupError) throw cleanupError;
  }
}
