/** Independent wire contract; intentionally different from the mock compiler DTO. */
import type { ScenePlan } from '../../../types/domain/spatial';
export const PROTOCOL_VERSION = '1.0.0' as const;
export const MAX_RESPONSE_BYTES = 4_194_304;
export type Operation = 'analyze' | 'execute';
export type AnalysisStatus = 'completed' | 'failed' | 'incomplete';
export type ProgramStatus = AnalysisStatus | 'blocked';
export type AnalysisStage = 'lexical' | 'syntactic' | 'semantic';

/** IDs are unique per worker session. File identities are exact in-memory keys. */
export interface ProtocolRequest {
  protocolVersion: typeof PROTOCOL_VERSION;
  requestId: string;
  operation: Operation;
  entryFile: string;
  files: Record<string, string>;
}

export interface CoreDiagnostic {
  category: 'LEXICAL' | 'SYNTACTIC' | 'SEMANTIC' | 'IMPORT' | 'RUNTIME' | 'SPATIAL';
  code: string;
  file: string;
  line: number;
  column: number;
  description: string;
  suggestion?: string;
}

export interface ProtocolResult {
  entryFile: string;
  analysisStatus: AnalysisStatus;
  stage: AnalysisStage;
  output: string[];
  diagnostics: CoreDiagnostic[];
  limitations: 'spatial_semantics_unavailable'[];
  lexicalError?: string;
  scenePlan?: ScenePlan;
  executionAttempted: boolean;
  capabilities: {
    scenePlan: boolean;
    debugTrace: false;
    interactiveInput: false;
    cancellation: false;
  };
}

interface ResponseEnvelope {
  protocolVersion: typeof PROTOCOL_VERSION;
  requestId: string;
  operation: Operation;
}

export interface ResultResponse extends ResponseEnvelope {
  status: ProgramStatus;
  result: ProtocolResult;
}

export const PROTOCOL_ERROR_CODES = [
  'MALFORMED_JSON', 'INVALID_UTF8', 'INVALID_REQUEST', 'UNSUPPORTED_VERSION',
  'UNKNOWN_OPERATION', 'REQUEST_TOO_LARGE', 'DUPLICATE_REQUEST_ID', 'SESSION_LIMIT_REACHED',
] as const;
export const INFRASTRUCTURE_ERROR_CODES = [
  'INPUT_UNAVAILABLE', 'INTERNAL_ERROR', 'RESPONSE_TOO_LARGE', 'SERIALIZATION_ERROR',
] as const;

export interface ErrorResponse {
  protocolVersion: typeof PROTOCOL_VERSION;
  requestId: string | null;
  operation: Operation | null;
  status: 'error';
  error: {
    kind: 'protocol';
    code: typeof PROTOCOL_ERROR_CODES[number];
    message: string;
  } | {
    kind: 'infrastructure';
    code: typeof INFRASTRUCTURE_ERROR_CODES[number];
    message: string;
  };
}

export type ProtocolResponse = ResultResponse | ErrorResponse;
export type ValidationResult<T> =
  | { valid: true; value: T }
  | { valid: false; errors: string[] };
