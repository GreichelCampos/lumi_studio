import {
  INFRASTRUCTURE_ERROR_CODES, MAX_RESPONSE_BYTES, PROTOCOL_ERROR_CODES, PROTOCOL_VERSION,
} from './types.ts';
import type { ProtocolResponse, ValidationResult } from './types.ts';
import { validateScenePayload } from './scenePayload.ts';
import {
  hasKeys, isOperation, isPositiveInteger, isRecord, isRequestId, isText,
} from './validationHelpers.ts';

function validDiagnostic(raw: unknown): boolean {
  if (!isRecord(raw) || !hasKeys(raw,
    ['category', 'code', 'file', 'line', 'column', 'description'], ['suggestion'])) return false;
  return typeof raw.category === 'string'
    && ['LEXICAL', 'SYNTACTIC', 'SEMANTIC', 'IMPORT', 'RUNTIME', 'SPATIAL'].includes(raw.category)
    && isText(raw.code) && isText(raw.file) && isText(raw.description)
    && isPositiveInteger(raw.line) && isPositiveInteger(raw.column)
    && (!Object.hasOwn(raw, 'suggestion') || typeof raw.suggestion === 'string');
}

function validResult(raw: unknown): raw is Record<string, unknown> {
  if (!isRecord(raw) || !hasKeys(raw, [
    'entryFile', 'analysisStatus', 'stage', 'output', 'diagnostics',
    'limitations', 'executionAttempted', 'capabilities',
  ], ['lexicalError', 'scenePlan'])) return false;
  const caps = raw.capabilities;
  return isText(raw.entryFile)
    && typeof raw.analysisStatus === 'string'
    && ['completed', 'failed', 'incomplete'].includes(raw.analysisStatus)
    && typeof raw.stage === 'string' && ['lexical', 'syntactic', 'semantic'].includes(raw.stage)
    && Array.isArray(raw.output) && raw.output.every((item: unknown) => typeof item === 'string')
    && Array.isArray(raw.diagnostics) && raw.diagnostics.every(validDiagnostic)
    && Array.isArray(raw.limitations)
    && raw.limitations.every((item: unknown) => item === 'spatial_semantics_unavailable')
    && new Set(raw.limitations).size === raw.limitations.length
    && typeof raw.executionAttempted === 'boolean'
    && (!Object.hasOwn(raw, 'lexicalError') || isText(raw.lexicalError))
    && isRecord(caps) && hasKeys(caps, ['scenePlan', 'debugTrace', 'interactiveInput', 'cancellation'])
    && typeof caps.scenePlan === 'boolean'
    && caps.debugTrace === false && caps.interactiveInput === false && caps.cancellation === false;
}

function coherentResult(envelope: Record<string, unknown>, result: Record<string, unknown>): boolean {
  const diagnostics = result.diagnostics;
  const output = result.output;
  const limitations = result.limitations;
  if (!Array.isArray(diagnostics) || !Array.isArray(output) || !Array.isArray(limitations)) return false;
  if (result.analysisStatus === 'failed') {
    if (diagnostics.length === 0 && !Object.hasOwn(result, 'lexicalError')) return false;
  } else {
    if (result.stage !== 'semantic' || Object.hasOwn(result, 'lexicalError')) return false;
    if (result.analysisStatus === 'incomplete' && limitations.length === 0) return false;
    if (result.analysisStatus === 'completed' && limitations.length !== 0) return false;
  }
  if (result.stage === 'lexical' && !Object.hasOwn(result, 'lexicalError')) return false;
  if (result.stage !== 'lexical' && Object.hasOwn(result, 'lexicalError')) return false;
  if (envelope.operation === 'analyze') {
    return envelope.status === result.analysisStatus && result.executionAttempted === false
      && output.length === 0 && (result.analysisStatus === 'failed' || diagnostics.length === 0);
  }
  if (result.analysisStatus === 'failed') {
    return envelope.status === 'blocked' && result.executionAttempted === false && output.length === 0;
  }
  return result.executionAttempted === true
    && envelope.status === (diagnostics.length > 0 ? 'failed' : 'completed');
}

function validError(raw: unknown): boolean {
  if (!isRecord(raw) || !hasKeys(raw, ['kind', 'code', 'message']) || !isText(raw.message)) return false;
  if (raw.kind === 'protocol') {
    return PROTOCOL_ERROR_CODES.some((code) => code === raw.code);
  }
  return raw.kind === 'infrastructure'
    && INFRASTRUCTURE_ERROR_CODES.some((code) => code === raw.code);
}

export function validateProtocolResponse(raw: unknown): ValidationResult<ProtocolResponse> {
  const errors: string[] = [];
  if (!isRecord(raw)) return { valid: false, errors: ['Se esperaba un objeto de respuesta.'] };
  if (raw.protocolVersion !== PROTOCOL_VERSION) errors.push('Versión del protocolo incompatible.');
  if (raw.status === 'error') {
    if (!hasKeys(raw, ['protocolVersion', 'requestId', 'operation', 'status', 'error'])) {
      errors.push('Campos de respuesta de error incorrectos.');
    }
    if (raw.requestId !== null && !isRequestId(raw.requestId)) errors.push('requestId inválido.');
    if (raw.operation !== null && !isOperation(raw.operation)) errors.push('Operación inválida.');
    if (!validError(raw.error)) errors.push('Detalle de error inválido.');
  } else {
    if (!hasKeys(raw, ['protocolVersion', 'requestId', 'operation', 'status', 'result'])) {
      errors.push('Campos de respuesta de resultado incorrectos.');
    }
    if (!isRequestId(raw.requestId)) errors.push('requestId inválido.');
    if (!isOperation(raw.operation)) errors.push('Operación inválida.');
    if (typeof raw.status !== 'string' || !['completed', 'failed', 'incomplete', 'blocked'].includes(raw.status)) {
      errors.push('Estado inválido.');
    }
    if (!validResult(raw.result)) errors.push('Resultado inválido.');
    else {
      if (!coherentResult(raw, raw.result)) errors.push('Estado y resultado contradictorios.');
      errors.push(...validateScenePayload(raw.result, raw.status));
    }
  }
  // This cast follows validation of every required/optional field and invariant.
  return errors.length > 0 ? { valid: false, errors } : { valid: true, value: raw as unknown as ProtocolResponse };
}

export function parseProtocolResponse(text: string): ValidationResult<ProtocolResponse> {
  if (new TextEncoder().encode(text).length > MAX_RESPONSE_BYTES) {
    return { valid: false, errors: ['La respuesta excede 4 MiB.'] };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { valid: false, errors: ['JSON de respuesta malformado.'] };
  }
  return validateProtocolResponse(raw);
}
