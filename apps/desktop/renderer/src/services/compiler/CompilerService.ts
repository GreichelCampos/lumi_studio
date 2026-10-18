import { LumiProject, CompileResult } from '../../types';

export interface CompileOptions {
  activeFileId?: string;
  delayMs?: number;
}

export interface CompilerService {
  readonly mode?: 'python' | 'demo';
  compile(project: LumiProject, options?: CompileOptions | string): Promise<CompileResult>;
  execute?(project: LumiProject): Promise<CompileResult>;
}

export type { CompileResult, CompilationResult } from '../../types';
export * from './contracts';
