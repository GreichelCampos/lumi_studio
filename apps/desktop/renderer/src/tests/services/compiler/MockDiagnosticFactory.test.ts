import { describe, it, expect } from 'vitest';
import { MockDiagnosticFactory } from '../../../services/compiler/MockDiagnosticFactory';

describe('MockDiagnosticFactory', () => {
  it('debe construir diagnóstico de proyecto no encontrado LUMI-E001', () => {
    const diag = MockDiagnosticFactory.noProject('comp-1');
    expect(diag.code).toBe('LUMI-E001');
    expect(diag.severity).toBe('error');
    expect(diag.blocking).toBe(true);
    expect(diag.category).toBe('importacion');
  });

  it('debe construir diagnóstico de símbolo ilegal con el código real', () => {
    const diag = MockDiagnosticFactory.illegalSymbol('comp-2', 'principal.lumi', 4, 10);
    expect(diag.code).toBe('LEX_INVALID_CHARACTER');
    expect(diag.line).toBe(4);
    expect(diag.column).toBe(10);
    expect(diag.file).toBe('principal.lumi');
    expect(diag.category).toBe('lexico');
    expect(diag.blocking).toBe(true);
  });

  it('debe usar el código real para una cadena sin cerrar', () => {
    const diag = MockDiagnosticFactory.unclosedString('comp-3', 'modulo.lumi', 7, 5);
    expect(diag).toMatchObject({ code: 'LEX_UNTERMINATED_STRING', category: 'lexico',
      severity: 'error', blocking: true, file: 'modulo.lumi', line: 7, column: 5 });
  });

  it('debe construir diagnóstico de advertencia de comentario obsoleto LUMI-S101', () => {
    const diag = MockDiagnosticFactory.legacyComment('comp-3', 'modulo.lumi', 7);
    expect(diag.code).toBe('LUMI-S101');
    expect(diag.severity).toBe('warning');
    expect(diag.blocking).toBe(false);
    expect(diag.category).toBe('sintactico');
  });
});
