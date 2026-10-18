import type { ContractValidationCode, ContractValidationError } from '../../../types';

export type StructureRule = (value: unknown, path: string, errors: ContractValidationError[]) => void;

function reject(errors: ContractValidationError[], path: string, message: string,
  code: ContractValidationCode = 'INVALID_FIELD_TYPE'): void {
  errors.push({ path, code, message });
}

export function objectFields(required: Record<string, StructureRule>,
  optional: Record<string, StructureRule> = {}): StructureRule {
  return (value, path, errors) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      reject(errors, path, 'Se esperaba un objeto JSON.');
      return;
    }
    const record = value as Record<string, unknown>;
    for (const [key, rule] of Object.entries(required)) {
      const fieldPath = `${path}.${key}`;
      if (!Object.hasOwn(record, key) || record[key] === undefined) {
        reject(errors, fieldPath, 'Falta un campo obligatorio.', 'MISSING_REQUIRED_FIELD');
      } else {
        rule(record[key], fieldPath, errors);
      }
    }
    for (const [key, rule] of Object.entries(optional)) {
      if (Object.hasOwn(record, key) && record[key] !== undefined) rule(record[key], `${path}.${key}`, errors);
    }
  };
}

export const text: StructureRule = (value, path, errors) => {
  if (typeof value !== 'string') reject(errors, path, 'Se esperaba texto.');
};

export const nonemptyText: StructureRule = (value, path, errors) => {
  if (typeof value !== 'string' || !value.trim()) reject(errors, path, 'Se esperaba texto no vacío.');
};

export const finiteNumber: StructureRule = (value, path, errors) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) reject(errors, path, 'Se esperaba un número finito.');
};

export const positiveNumber: StructureRule = (value, path, errors) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    reject(errors, path, 'Se esperaba una dimensión finita mayor que cero.', 'INVALID_SPATIAL_REFERENCE');
  }
};

export function integerAtLeast(minimum: number): StructureRule {
  return (value, path, errors) => {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum) {
      reject(errors, path, `Se esperaba un entero mayor o igual que ${minimum}.`);
    }
  };
}

export const booleanValue: StructureRule = (value, path, errors) => {
  if (typeof value !== 'boolean') reject(errors, path, 'Se esperaba un booleano.');
};

export function oneOf(values: readonly string[], code: ContractValidationCode = 'INVALID_FIELD_TYPE'): StructureRule {
  return (value, path, errors) => {
    if (typeof value !== 'string' || !values.includes(value)) reject(errors, path, `Valor permitido: ${values.join(', ')}.`, code);
  };
}

export const compatibleVersion: StructureRule = (value, path, errors) => {
  if (typeof value !== 'string' || !/^0*1($|[^0-9])/.test(value)) {
    reject(errors, path, 'Versión incompatible con la familia 1 del formato existente.', 'INCOMPATIBLE_VERSION');
  }
};

export function listOf(rule: StructureRule): StructureRule {
  return (value, path, errors) => {
    if (!Array.isArray(value)) {
      reject(errors, path, 'Se esperaba un arreglo.');
      return;
    }
    for (let index = 0; index < value.length; index++) rule(value[index], `${path}[${index}]`, errors);
  };
}

export function tupleOf(rule: StructureRule): StructureRule {
  return (value, path, errors) => {
    if (!Array.isArray(value) || value.length !== 3) {
      reject(errors, path, 'Se esperaba una tupla de tres números.', 'INVALID_SPATIAL_REFERENCE');
      return;
    }
    for (let index = 0; index < 3; index++) rule(value[index], `${path}[${index}]`, errors);
  };
}
