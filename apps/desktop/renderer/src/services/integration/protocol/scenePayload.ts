import type { ContractValidationError } from '../../../types';
import { sceneStructure } from '../../compiler/contracts/sceneStructure.ts';
import { isRecord } from './validationHelpers.ts';

export function validateScenePayload(result: Record<string, unknown>, status: unknown): string[] {
  if (!Object.hasOwn(result, 'scenePlan') || result.scenePlan === null) return [];
  if (!isRecord(result.capabilities) || result.capabilities.scenePlan !== true) {
    return ['result.scenePlan: la escena requiere capabilities.scenePlan=true.'];
  }
  if (status !== 'completed' || result.analysisStatus !== 'completed') {
    return ['result.scenePlan: no se admite una escena en una operación fallida, bloqueada o incompleta.'];
  }
  const errors: ContractValidationError[] = [];
  sceneStructure(result.scenePlan, 'result.scenePlan', errors);
  return errors.map(error => `${error.path}: ${error.message}`);
}
