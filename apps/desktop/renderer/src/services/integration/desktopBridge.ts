import type { ProtocolResponse } from './protocol/types';

export interface BackendInput { entryFile: string; files: Record<string, string> }
export interface BackendError { code: string; message: string }
export type BackendReply = { ok: true; response: ProtocolResponse } | { ok: false; error: BackendError };
export interface BackendAvailability { available: boolean; message: string }
export interface DesktopBridge {
  analyze(input: BackendInput): Promise<BackendReply>;
  execute(input: BackendInput): Promise<BackendReply>;
  availability(): Promise<BackendAvailability>;
}

declare global {
  interface Window { lumiDesktop?: DesktopBridge }
}
