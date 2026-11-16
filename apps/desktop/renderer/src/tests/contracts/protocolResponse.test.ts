import { describe, expect, it } from 'vitest';
import { parseProtocolResponse, validateProtocolResponse } from '../../services/integration/protocol/responseValidator';
import { MAX_RESPONSE_BYTES } from '../../services/integration/protocol/types';
import type { CoreDiagnostic, ResultResponse } from '../../services/integration/protocol/types';
import { createMockDebugSteps, createMockRoom, createMockScenePlan } from '../fixtures/testFixtures';

function response(): ResultResponse {
  return {
    protocolVersion: '1.0.0', requestId: 'test-1', operation: 'execute', status: 'completed',
    result: {
      entryFile: 'principal.lumi', analysisStatus: 'completed', stage: 'semantic',
      output: ['¡Hola, habitación 🏠!'], diagnostics: [], limitations: [],
      executionAttempted: true,
      capabilities: { scenePlan: false, debugTrace: false, interactiveInput: false, cancellation: false },
    },
  };
}

const diagnostic: CoreDiagnostic = {
  category: 'RUNTIME', code: 'RUN_DIVISION_BY_ZERO', file: 'principal.lumi',
  line: 2, column: 9, description: 'No se puede dividir entre cero.',
};

describe('Python integration protocol responses', () => {
  it('preserves typed output and Unicode', () => {
    const raw = response();
    const validated = parseProtocolResponse(JSON.stringify(raw));
    expect(validated).toEqual({ valid: true, value: raw });
  });

  it('accepts analysis without execution', () => {
    const raw = response();
    raw.operation = 'analyze';
    raw.result.output = [];
    raw.result.executionAttempted = false;
    expect(validateProtocolResponse(raw).valid).toBe(true);
  });

  it('accepts authentic diagnostics with optional suggestions', () => {
    const raw = response();
    raw.status = 'failed';
    raw.result.diagnostics = [{ ...diagnostic, suggestion: 'Corrija el divisor.' }];
    expect(validateProtocolResponse(raw).valid).toBe(true);
    raw.result.diagnostics = [diagnostic];
    expect(validateProtocolResponse(raw).valid).toBe(true);
  });

  it('accepts lexical failure without synthetic diagnostic locations', () => {
    const raw = response();
    raw.status = 'blocked';
    raw.result.analysisStatus = 'failed';
    raw.result.stage = 'lexical';
    raw.result.lexicalError = "principal.lumi:1:1: carácter inválido '@'";
    raw.result.output = [];
    raw.result.executionAttempted = false;
    expect(validateProtocolResponse(raw).valid).toBe(true);
  });

  it('represents incomplete analysis honestly', () => {
    const raw = response();
    raw.operation = 'analyze';
    raw.status = 'incomplete';
    raw.result.analysisStatus = 'incomplete';
    raw.result.limitations = ['spatial_semantics_unavailable'];
    raw.result.executionAttempted = false;
    raw.result.output = [];
    expect(validateProtocolResponse(raw).valid).toBe(true);
    raw.status = 'completed';
    expect(validateProtocolResponse(raw).valid).toBe(false);
  });

  it('accepts a validated runtime scene while analysis remains incomplete', () => {
    const raw = response();
    raw.result.analysisStatus = 'incomplete';
    raw.result.limitations = ['spatial_semantics_unavailable'];
    raw.result.capabilities.scenePlan = true;
    raw.result.scenePlan = createMockScenePlan({ rooms: [createMockRoom()] });
    expect(validateProtocolResponse(raw).valid).toBe(true);
  });

  it('accepts a complete F6 trace with consecutive validated snapshots', () => {
    const raw = response();
    raw.result.capabilities.debugTrace = true;
    raw.result.debugSteps = createMockDebugSteps();

    expect(validateProtocolResponse(raw).valid).toBe(true);
  });

  it('rejects contradictory, malformed, or non-consecutive traces', () => {
    const withoutSteps = response();
    withoutSteps.result.capabilities.debugTrace = true;
    expect(validateProtocolResponse(withoutSteps).valid).toBe(false);

    const disabledWithSteps = response();
    disabledWithSteps.result.debugSteps = createMockDebugSteps();
    expect(validateProtocolResponse(disabledWithSteps).valid).toBe(false);

    const wrongIndex = response();
    wrongIndex.result.capabilities.debugTrace = true;
    wrongIndex.result.debugSteps = createMockDebugSteps();
    wrongIndex.result.debugSteps[1].stepIndex = 7;
    expect(validateProtocolResponse(wrongIndex).valid).toBe(false);

    const unknownObject = response();
    unknownObject.result.capabilities.debugTrace = true;
    unknownObject.result.debugSteps = createMockDebugSteps();
    unknownObject.result.debugSteps[1].activeObjectId = 'missing-object';
    expect(validateProtocolResponse(unknownObject).valid).toBe(false);

    const invalidSnapshot = response();
    invalidSnapshot.result.capabilities.debugTrace = true;
    invalidSnapshot.result.debugSteps = createMockDebugSteps();
    invalidSnapshot.result.debugSteps[0].sceneSnapshot.rooms[0].dimensions[0] = 0;
    expect(validateProtocolResponse(invalidSnapshot).valid).toBe(false);
  });

  it('accepts an explicit unavailable reason only when tracing is disabled', () => {
    const raw = response();
    raw.result.debugTraceUnavailableReason = 'step_limit_exceeded';
    expect(validateProtocolResponse(raw).valid).toBe(true);
    raw.result.debugTraceUnavailableReason = 'invented_reason';
    expect(validateProtocolResponse(raw).valid).toBe(false);
  });

  it('rejects malformed scenes and scenes attached to failed operations', () => {
    const raw = response();
    raw.result.capabilities.scenePlan = true;
    raw.result.scenePlan = createMockScenePlan({ rooms: [createMockRoom()] });
    raw.result.scenePlan.rooms[0].dimensions[0] = 0;
    expect(validateProtocolResponse(raw).valid).toBe(false);
    raw.result.scenePlan = createMockScenePlan({ rooms: [createMockRoom()] });
    raw.status = 'failed';
    raw.result.diagnostics = [{ ...diagnostic }];
    expect(validateProtocolResponse(raw).valid).toBe(false);
  });

  it.each(['protocol', 'infrastructure'] as const)('accepts %s errors separately from diagnostics', (kind) => {
    const raw = {
      protocolVersion: '1.0.0', requestId: null, operation: null, status: 'error',
      error: { kind, code: kind === 'protocol' ? 'MALFORMED_JSON' : 'INTERNAL_ERROR', message: 'Error.' },
    };
    expect(validateProtocolResponse(raw).valid).toBe(true);
  });

  it.each([
    ['protocolVersion', '2.0.0'], ['requestId', null], ['requestId', ''],
    ['requestId', 'é'.repeat(65)], ['operation', 'cancel'], ['status', 'success'],
    ['status', ['completed']], ['result', null], ['result', []],
  ])('rejects invalid envelope field %s', (key, value) => {
    expect(validateProtocolResponse({ ...response(), [key as string]: value }).valid).toBe(false);
  });

  it.each([
    ['output', [1]], ['output', null], ['executionAttempted', 'true'],
    ['analysisStatus', 'success'], ['stage', ['semantic']], ['entryFile', ''],
    ['diagnostics', null], ['limitations', ['fake']], ['lexicalError', null],
    ['lexicalError', undefined], ['capabilities', { scenePlan: true }],
  ])('rejects invalid result field %s', (key, value) => {
    const raw = response();
    expect(validateProtocolResponse({ ...raw, result: { ...raw.result, [key as string]: value } }).valid).toBe(false);
  });

  it.each([
    ['category', 'ejecucion'], ['category', ['RUNTIME']], ['line', 0], ['column', 1.5],
    ['line', Number.POSITIVE_INFINITY], ['line', Number.MAX_SAFE_INTEGER + 1],
    ['suggestion', null], ['file', ''], ['code', ''], ['description', ''],
    ['severity', 'error'],
  ])('rejects malformed or invented diagnostic field %s', (key, value) => {
    const raw = response();
    raw.status = 'failed';
    const malformed = { ...diagnostic, [key as string]: value };
    expect(validateProtocolResponse({ ...raw, result: { ...raw.result, diagnostics: [malformed] } }).valid).toBe(false);
  });

  it('rejects unknown fields and claims of nonexistent scenes/traces', () => {
    const raw = response();
    expect(validateProtocolResponse({ ...raw, debugSteps: [] }).valid).toBe(false);
    expect(validateProtocolResponse({ ...raw, result: { ...raw.result, scenePlan: {} } }).valid).toBe(false);
    expect(validateProtocolResponse({ ...raw, error: {} }).valid).toBe(false);
  });

  it('rejects contradictory execution states', () => {
    const raw = response();
    raw.result.executionAttempted = false;
    expect(validateProtocolResponse(raw).valid).toBe(false);
    raw.result.executionAttempted = true;
    raw.status = 'failed';
    expect(validateProtocolResponse(raw).valid).toBe(false);
  });

  it.each([null, [], 42, 'result'])('rejects non-object responses', (raw) => {
    expect(validateProtocolResponse(raw).valid).toBe(false);
  });

  it('rejects invalid JSON and excessive response size', () => {
    expect(parseProtocolResponse('{broken').valid).toBe(false);
    expect(parseProtocolResponse('a'.repeat(MAX_RESPONSE_BYTES + 1)).valid).toBe(false);
  });

  it('rejects unknown error codes, kinds and fields', () => {
    const raw = { protocolVersion: '1.0.0', requestId: 'test', operation: 'execute', status: 'error' };
    for (const error of [
      { kind: 'syntax', code: 'INTERNAL_ERROR', message: 'error' },
      { kind: 'protocol', code: 'INTERNAL_ERROR', message: 'error' },
      { kind: 'infrastructure', code: 'INTERNAL_ERROR', message: 'error', line: 1 },
    ]) {
      expect(validateProtocolResponse({ ...raw, error }).valid).toBe(false);
    }
  });
});
