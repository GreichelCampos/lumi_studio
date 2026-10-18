export function localRendererUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('El renderer debe ser el servidor Vite local en 127.0.0.1.');
  }
  return url;
}

export function trustedFrame(url: string, expected: URL): boolean {
  try {
    const candidate = new URL(url);
    return candidate.protocol === expected.protocol && candidate.hostname === expected.hostname
      && candidate.port === expected.port && !candidate.username && !candidate.password
      && candidate.pathname === expected.pathname;
  } catch { return false; }
}

export function contentSecurityPolicy(url: URL, nonce: string): string {
  if (url.protocol === 'lumi-app:') return [
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
    "font-src 'self'", "img-src 'self' data: blob:", "connect-src 'self'",
    "object-src 'none'", "base-uri 'none'", "frame-src 'none'", "form-action 'none'",
  ].join('; ');
  if (!/^[A-Za-z0-9+/=]+$/.test(nonce)) throw new Error('Nonce CSP ausente o inválido.');
  return [
    "default-src 'self'", `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data: blob:",
    `connect-src 'self' ws://127.0.0.1:${url.port}`, "object-src 'none'",
    "base-uri 'none'", "frame-src 'none'", "form-action 'none'",
  ].join('; ');
}
