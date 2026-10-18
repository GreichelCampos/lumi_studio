import type { ContractValidationError, ContractValidationResult, LumiCompiledArtifact } from '../../../types';
import { debugStepStructure, sceneStructure } from './sceneStructure';
import { booleanValue, compatibleVersion, finiteNumber, listOf, objectFields, oneOf, text } from './structureChecks';

const artifactStructure = objectFields({
  format: oneOf(['lumic']), schemaVersion: compatibleVersion, compiledAt: text,
  compiler: objectFields({ name: text, version: text, target: text }),
  project: objectFields({ id: text, name: text, entryFile: text, sourceFilesCount: finiteNumber }, { sourceChecksum: text }),
  scenePlan: sceneStructure,
  diagnosticsSummary: objectFields({
    totalErrors: finiteNumber, totalWarnings: finiteNumber, totalSpatialIssues: finiteNumber,
    hasBlockingErrors: booleanValue,
  }),
}, { debugSteps: listOf(debugStepStructure), metadata: objectFields({}) });

export function validateLumicStructure(raw: unknown, path: string): ContractValidationResult<LumiCompiledArtifact> {
  const errors: ContractValidationError[] = [];
  artifactStructure(raw, path, errors);
  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? raw as LumiCompiledArtifact : null,
    errors,
    warnings: [],
  };
}
