import { DiagnosticItem } from './diagnostics';
import { ScenePlan } from './spatial';
import { EntryFileInfo } from './project';
import { DebugStep } from './debug';

export type CompileStatus =
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'incomplete'
  | 'completed_with_spatial_issues';

export interface CompileResult {
  origin?: 'python';
  operation?: 'analyze' | 'execute';
  compilationId: string;
  status: CompileStatus;
  success: boolean;
  diagnostics: DiagnosticItem[];
  scenePlan: ScenePlan | null;
  entryFileInfo: EntryFileInfo | null;
  durationMs: number;
  logs: string[];
  debugSteps: DebugStep[];
  timestamp: string;
}

export type CompilationResult = CompileResult;
export type { EntryFileInfo } from './project';
