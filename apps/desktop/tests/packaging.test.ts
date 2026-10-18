import { describe, expect, it, vi } from 'vitest';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { contentSecurityPolicy, trustedFrame } from '../electron/security';

vi.mock('electron', () => ({ net: {}, protocol: {} }));
import { rendererAsset, PACKAGED_RENDERER_URL } from '../electron/packagedRenderer';

describe('packaged boundaries', () => {
  it('authorizes only the application page, not another custom origin', () => {
    expect(trustedFrame('lumi-app://ide/index.html', PACKAGED_RENDERER_URL)).toBe(true);
    expect(trustedFrame('lumi-app://attacker/index.html', PACKAGED_RENDERER_URL)).toBe(false);
    expect(trustedFrame('lumi-app://ide/other.html', PACKAGED_RENDERER_URL)).toBe(false);
    expect(trustedFrame('file:///index.html', PACKAGED_RENDERER_URL)).toBe(false);
    expect(contentSecurityPolicy(PACKAGED_RENDERER_URL, '')).toContain("script-src 'self'");
    expect(contentSecurityPolicy(PACKAGED_RENDERER_URL, '')).not.toContain('unsafe-eval');
  });
  it('restricts assets to the packaged renderer', () => {
    const root = resolve('renderer/dist');
    expect(rendererAsset(root, 'lumi-app://ide/assets/main.js')).toBe(resolve(root, 'assets/main.js'));
    for (const path of ['lumi-app://evil/index.html', 'lumi-app://ide/%2e%2e%2fsecret',
      'lumi-app://ide/%5csecret', 'lumi-app://ide/C:/secret', 'https://ide/index.html']) {
      expect(rendererAsset(root, path)).toBeNull();
    }
  });
  it('keeps user data and includes only release resources', () => {
    const config = JSON.parse(readFileSync('electron-builder.json', 'utf8'));
    expect(config.appId).toBe('org.lumi.estudio');
    expect(config.nsis.perMachine).toBe(false);
    expect(config.nsis.deleteAppDataOnUninstall).toBe(false);
    expect(config.files).toContain('!node_modules/**/*');
    expect(config.extraResources.map((item: { to: string }) => item.to)).toContain('lumi/python');
    const runtime = JSON.parse(readFileSync('packaging/python-runtime.json', 'utf8'));
    expect(runtime.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(runtime.url).toBe(`https://www.python.org/ftp/python/${runtime.version}/python-${runtime.version}-embed-amd64.zip`);
  });
});
