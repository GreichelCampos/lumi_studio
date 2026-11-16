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

const DEBUG_EVENT_TYPES = new Set([
  'start', 'declaration', 'assignment', 'condition', 'loop', 'room_create',
  'place_object', 'move_object', 'rotate_object', 'spatial_warning',
  'spatial_error', 'end',
]);

function sceneEntityIds(scene: Record<string, unknown>, roomId: string): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(scene.rooms)) return ids;
  const room = scene.rooms.find(item => isRecord(item) && item.id === roomId);
  if (!isRecord(room)) return ids;
  for (const key of ['objects', 'doors', 'windows']) {
    const items = room[key];
    if (Array.isArray(items)) for (const item of items) {
      if (isRecord(item) && isText(item.id)) ids.add(item.id);
    }
  }
  if (isRecord(room.walls)) for (const wall of Object.values(room.walls)) {
    if (isRecord(wall) && isText(wall.id)) ids.add(wall.id);
  }
  return ids;
}

function debugStepErrors(raw: unknown, expectedIndex: number): string[] {
  const errors: string[] = [];
  const required = [
    'id', 'stepIndex', 'eventType', 'description', 'sourceRef', 'lineNumber',
    'codeLine', 'actionDescription', 'sceneSnapshot',
  ];
  if (!isRecord(raw) || !hasKeys(raw, required,
    ['roomId', 'activeObjectId', 'spatialState', 'assistantMessage'])) {
    return ['Paso de depuraciÃ³n con campos incorrectos.'];
  }
  if (!isText(raw.id)) errors.push('DebugStep.id debe ser texto no vacÃ­o.');
  if (!Number.isSafeInteger(raw.stepIndex) || raw.stepIndex !== expectedIndex) {
    errors.push('Los Ã­ndices de depuraciÃ³n deben ser consecutivos desde cero.');
  }
  if (typeof raw.eventType !== 'string' || !DEBUG_EVENT_TYPES.has(raw.eventType)) {
    errors.push('DebugStep.eventType no estÃ¡ permitido.');
  }
  if (!isText(raw.description) || !isText(raw.actionDescription)) {
    errors.push('Las descripciones del paso son obligatorias.');
  }
  if (typeof raw.codeLine !== 'string') errors.push('DebugStep.codeLine debe ser texto.');
  if (!isRecord(raw.sourceRef)
    || !hasKeys(raw.sourceRef, ['file', 'line', 'column'])
    || !isText(raw.sourceRef.file)
    || !isPositiveInteger(raw.sourceRef.line)
    || !isPositiveInteger(raw.sourceRef.column)) {
    errors.push('DebugStep.sourceRef no es una ubicaciÃ³n vÃ¡lida.');
  } else if (raw.lineNumber !== raw.sourceRef.line) {
    errors.push('DebugStep.lineNumber debe coincidir con sourceRef.line.');
  }
  if (raw.roomId !== undefined && !isText(raw.roomId)) errors.push('roomId invÃ¡lido.');
  if (raw.activeObjectId !== undefined && !isText(raw.activeObjectId)) {
    errors.push('activeObjectId invÃ¡lido.');
  }
  if (raw.spatialState !== undefined && !isRecord(raw.spatialState)) {
    errors.push('spatialState invÃ¡lido.');
  }
  if (raw.assistantMessage !== undefined && !isText(raw.assistantMessage)) {
    errors.push('assistantMessage invÃ¡lido.');
  }
  if (!isRecord(raw.sceneSnapshot)) {
    errors.push('DebugStep.sceneSnapshot es obligatorio.');
  } else {
    const snapshot = raw.sceneSnapshot;
    errors.push(...validateScenePayload({
      capabilities: { scenePlan: true }, scenePlan: snapshot,
    }, 'completed'));
    if (isText(raw.roomId)) {
      const rooms = snapshot.rooms;
      const roomExists = Array.isArray(rooms)
        && rooms.some(room => isRecord(room) && room.id === raw.roomId);
      if (!roomExists) errors.push('DebugStep.roomId no existe en sceneSnapshot.');
      if (isText(raw.activeObjectId)
        && !sceneEntityIds(snapshot, raw.roomId).has(raw.activeObjectId)) {
        errors.push('DebugStep.activeObjectId no existe en la habitaciÃ³n activa.');
      }
    } else if (isText(raw.activeObjectId)) {
      const rooms = snapshot.rooms;
      const objectExists = Array.isArray(rooms) && rooms.some(room => (
        isRecord(room) && isText(room.id)
        && sceneEntityIds(snapshot, room.id).has(raw.activeObjectId as string)
      ));
      if (!objectExists) {
        errors.push('DebugStep.activeObjectId no existe en sceneSnapshot.');
      }
    }
  }
  return errors;
}

function validUnavailableReason(value: unknown): boolean {
  return typeof value === 'string' && (
    ['execution_failed', 'execution_not_attempted', 'step_limit_exceeded',
      'response_size_exceeded', 'trace_empty', 'trace_incomplete'].includes(value)
    || /^source_unavailable:.+:[1-9][0-9]*$/.test(value)
  );
}

function debugTraceErrors(
  envelope: Record<string, unknown>, result: Record<string, unknown>,
): string[] {
  const errors: string[] = [];
  if (!isRecord(result.capabilities)) return errors;
  const enabled = result.capabilities.debugTrace;
  const hasSteps = Object.hasOwn(result, 'debugSteps');
  const hasReason = Object.hasOwn(result, 'debugTraceUnavailableReason');
  if (enabled === true) {
    if (envelope.operation !== 'execute' || envelope.status !== 'completed'
      || result.executionAttempted !== true) {
      errors.push('Solo F6 exitoso puede publicar trazas.');
    }
    if (!Array.isArray(result.debugSteps) || result.debugSteps.length === 0) {
      errors.push('debugTrace=true requiere debugSteps no vacÃ­o.');
    } else {
      const ids = new Set<string>();
      result.debugSteps.forEach((step, index) => {
        errors.push(...debugStepErrors(step, index));
        if (isRecord(step) && isText(step.id)) {
          if (ids.has(step.id)) errors.push('Los IDs de pasos deben ser Ãºnicos.');
          ids.add(step.id);
        }
      });
    }
    if (hasReason) {
      errors.push('Una traza disponible no admite razÃ³n de indisponibilidad.');
    }
  } else {
    if (hasSteps) errors.push('debugTrace=false no admite debugSteps.');
    if (hasReason && !validUnavailableReason(result.debugTraceUnavailableReason)) {
      errors.push('RazÃ³n de indisponibilidad de traza invÃ¡lida.');
    }
  }
  return errors;
}

function validResult(raw: unknown): raw is Record<string, unknown> {
  if (!isRecord(raw) || !hasKeys(raw, [
    'entryFile', 'analysisStatus', 'stage', 'output', 'diagnostics',
    'limitations', 'executionAttempted', 'capabilities',
  ], [
    'lexicalError', 'scenePlan', 'preferredRoomId', 'debugSteps', 'debugTraceUnavailableReason',
  ])) return false;
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
    && (!Object.hasOwn(raw, 'preferredRoomId') || isText(raw.preferredRoomId))
    && isRecord(caps) && hasKeys(caps, ['scenePlan', 'debugTrace', 'interactiveInput', 'cancellation'])
    && typeof caps.scenePlan === 'boolean'
    && typeof caps.debugTrace === 'boolean'
    && typeof caps.interactiveInput === 'boolean' && caps.cancellation === false;
}

function coherentResult(envelope: Record<string, unknown>, result: Record<string, unknown>): boolean {
  const diagnostics = result.diagnostics;
  const output = result.output;
  const limitations = result.limitations;
  if (!Array.isArray(diagnostics) || !Array.isArray(output) || !Array.isArray(limitations)) return false;
  if (Object.hasOwn(result, 'preferredRoomId')) {
    if (envelope.operation !== 'execute' || envelope.status !== 'completed'
      || !Object.hasOwn(result, 'scenePlan') || !isRecord(result.scenePlan)
      || !Array.isArray(result.scenePlan.rooms)
      || !result.scenePlan.rooms.some((room: unknown) => isRecord(room) && room.id === result.preferredRoomId)) {
      return false;
    }
  }
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
      errors.push(...debugTraceErrors(raw, raw.result));
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
