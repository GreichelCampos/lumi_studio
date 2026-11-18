import type { ProtocolResponse } from './protocol/types';

export interface BackendInput { entryFile: string; files: Record<string, string> }
export interface BackendError { code: string; message: string }
export type BackendReply = { ok: true; response: ProtocolResponse } | { ok: false; error: BackendError };
export interface BackendAvailability { available: boolean; message: string }
export interface InputPrompt { requestId: string; inputId: string; prompt: string }
export type InputReply = Pick<InputPrompt, 'requestId' | 'inputId'> & { value: string | null };
export type InputReplyResult = { ok: true } | { ok: false; error: BackendError };

export interface DesktopBridge {
  copyText?(text: string): Promise<void>;
  analyze(input: BackendInput): Promise<BackendReply>;
  execute(input: BackendInput, interactive?: boolean): Promise<BackendReply>;
  onInputPrompt?(listener: (prompt: InputPrompt | null) => void): () => void;
  replyInput?(reply: InputReply): Promise<InputReplyResult>;
  availability(): Promise<BackendAvailability>;
}

declare global {
  interface Window { lumiDesktop?: DesktopBridge }
}
