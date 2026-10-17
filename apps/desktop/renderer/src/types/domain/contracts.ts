import { CompileResult } from './compiler';
import { DiagnosticItem } from './diagnostics';
import { ScenePlan } from './spatial';
import { DebugStep } from './debug';
import { LumiProject, LumiFile, EntryFileInfo } from './project';

/**
 * Protocolo de integración y versión de esquema actual de Estudio Lumi.
 */
export const LUMI_PROTOCOL_VERSION = '1.0.0';
export const LUMI_SUPPORTED_MAJOR_VERSIONS = [1];

/**
 * Opciones para la solicitud de compilación enviada por el IDE.
 */
export interface CompileRequestOptions {
  generateDebugSteps?: boolean;
  generateScenePlan?: boolean;
  strictSpatialChecks?: boolean;
  debugLevel?: 'none' | 'basic' | 'verbose';
  targetVersion?: string;
}

/**
 * Estructura de un archivo fuente incluido en la solicitud de compilación.
 */
export interface CompileSourceFileDTO {
  id: string;
  name: string;
  path: string;
  content: string;
  isEntry?: boolean;
}

/**
 * Solicitud de compilación que el IDE envía al servicio del compilador (Python o Mock).
 * Es 100% serializable a JSON.
 */
export interface LumiCompileRequest {
  schemaVersion: string;
  projectId: string;
  projectName: string;
  entryFileId?: string;
  activeFileId?: string;
  files: CompileSourceFileDTO[];
  options?: CompileRequestOptions;
  metadata?: Record<string, unknown>;
}

/**
 * Respuesta del compilador serializable a JSON.
 * Es compatible directamente con CompileResult del dominio.
 */
export interface LumiCompileResponse extends CompileResult {
  schemaVersion?: string;
}

/**
 * Formato de artefacto compilado (.lumic) para exportación, inspección y empaquetado.
 */
export interface LumiCompiledArtifact {
  format: 'lumic';
  schemaVersion: string;
  compiledAt: string;
  compiler: {
    name: string;
    version: string;
    target: string;
  };
  project: {
    id: string;
    name: string;
    entryFile: string;
    sourceFilesCount: number;
    sourceChecksum?: string;
  };
  scenePlan: ScenePlan;
  debugSteps?: DebugStep[];
  diagnosticsSummary: {
    totalErrors: number;
    totalWarnings: number;
    totalSpatialIssues: number;
    hasBlockingErrors: boolean;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Categorías de códigos de error de validación de contrato.
 */
export type ContractValidationCode =
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_FIELD_TYPE'
  | 'INCOMPATIBLE_VERSION'
  | 'INVALID_SPATIAL_REFERENCE'
  | 'MALFORMED_JSON';

/**
 * Detalle de un error encontrado durante la validación de un contrato JSON.
 */
export interface ContractValidationError {
  path: string;
  code: ContractValidationCode;
  message: string;
  receivedValue?: unknown;
  expected?: string;
}

/**
 * Resultado genérico de validación de contrato.
 */
export interface ContractValidationResult<T> {
  isValid: boolean;
  data: T | null;
  errors: ContractValidationError[];
  warnings: string[];
}
