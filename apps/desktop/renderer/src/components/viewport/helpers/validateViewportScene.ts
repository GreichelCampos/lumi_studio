import type { ContractValidationError } from '../../../types';
import { sceneStructure } from '../../../services/compiler/contracts/sceneStructure';

export function validateViewportScene(value: unknown): string | null {
  const errors: ContractValidationError[] = [];
  sceneStructure(value, 'scenePlan', errors);
  return errors.length ? `${errors[0].path}: ${errors[0].message}` : null;
}
