import { net, protocol } from 'electron';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PACKAGED_RENDERER_URL = new URL('lumi-app://ide/index.html');

export function rendererAsset(root: string, raw: string): string | null {
  const url = new URL(raw);
  if (url.protocol !== 'lumi-app:' || url.hostname !== 'ide' || url.port || url.username || url.password) return null;
  let pathname: string;
  try { pathname = decodeURIComponent(url.pathname); } catch { return null; }
  if (pathname.includes('\\') || pathname.includes('\0') || pathname.includes(':')
    || pathname.split('/').some(part => part === '..' || part === '.')) return null;
  const file = resolve(root, `.${pathname}`);
  return file.startsWith(resolve(root) + sep) ? file : null;
}

export function registerPackagedRenderer(root: string, policy: string): void {
  protocol.handle('lumi-app', async request => {
    const file = rendererAsset(root, request.url);
    if (!file || request.method !== 'GET') return new Response('Recurso no permitido', { status: 403 });
    try {
      const response = await net.fetch(pathToFileURL(file).href);
      const headers = new Headers(response.headers);
      headers.set('Content-Security-Policy', policy);
      return new Response(response.body, { status: response.status, headers });
    } catch { return new Response('Recurso no disponible', { status: 404 }); }
  });
}
