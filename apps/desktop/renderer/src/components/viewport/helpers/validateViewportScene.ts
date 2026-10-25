import type { ContractValidationError } from '../../../types';
import { legacySceneStructure, sceneStructure } from '../../../services/compiler/contracts/sceneStructure';

export function validateViewportScene(value: unknown, legacyPlacement = false): string | null {
  const errors: ContractValidationError[] = [];
  (legacyPlacement ? legacySceneStructure : sceneStructure)(value, 'scenePlan', errors);
  return errors.length ? `${errors[0].path}: ${errors[0].message}` : null;
}
