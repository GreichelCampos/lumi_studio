import type { ContractValidationError, ContractValidationResult, LumiCompiledArtifact } from '../../../types';
import { createDebugStepStructure, legacySceneStructure, sceneStructure } from './sceneStructure';
import { LUMIC_SCHEMA_VERSION } from '../../../types/domain/contracts';
import { booleanValue, compatibleVersion, finiteNumber, listOf, objectFields, oneOf, text } from './structureChecks';

function artifactStructure(extended: boolean) {
  const sceneRule = extended ? sceneStructure : legacySceneStructure;
  return objectFields({
    format: oneOf(['lumic']), schemaVersion: compatibleVersion, compiledAt: text,
    compiler: objectFields({ name: text, version: text, target: text }),
    project: objectFields({ id: text, name: text, entryFile: text, sourceFilesCount: finiteNumber }, { sourceChecksum: text }),
    scenePlan: sceneRule,
    diagnosticsSummary: objectFields({
      totalErrors: finiteNumber, totalWarnings: finiteNumber, totalSpatialIssues: finiteNumber,
      hasBlockingErrors: booleanValue,
    }),
  }, { debugSteps: listOf(createDebugStepStructure(sceneRule)), metadata: objectFields({}) });
}

export function validateLumicStructure(raw: unknown, path: string): ContractValidationResult<LumiCompiledArtifact> {
  const errors: ContractValidationError[] = [];
  const extended = raw !== null && typeof raw === 'object' && 'schemaVersion' in raw
    && raw.schemaVersion === LUMIC_SCHEMA_VERSION;
  artifactStructure(extended)(raw, path, errors);
  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? raw as LumiCompiledArtifact : null,
    errors,
    warnings: [],
  };
}
