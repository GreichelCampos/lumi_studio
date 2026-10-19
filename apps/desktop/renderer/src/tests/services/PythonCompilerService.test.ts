import { describe, expect, it, vi } from 'vitest';
import { PythonCompilerService } from '../../services/integration/PythonCompilerService';
import { projectInput } from '../../services/integration/projectInput';
import { selectCompiler } from '../../services/integration/compilerSelection';
import { MockCompilerService } from '../../services/compiler/MockCompilerService';
import type { BackendReply, DesktopBridge } from '../../services/integration/desktopBridge';
import { createMockProject, createMockRoom, createMockScenePlan } from '../fixtures/testFixtures';
import { validateCompileResult } from '../../services/compiler/contracts/contractValidator';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { ViewportEmptyState } from '../../components/viewport/ViewportEmptyState';

function reply(): BackendReply {
  return { ok: true, response: {
    protocolVersion: '1.0.0', requestId: 'real-1', operation: 'execute', status: 'completed',
    result: { entryFile: 'principal.lumi', analysisStatus: 'completed', stage: 'semantic',
      output: ['SALIDA_REAL'], diagnostics: [], limitations: [], executionAttempted: true,
      capabilities: { scenePlan: false, debugTrace: false, interactiveInput: false, cancellation: false } },
  } };
}
function project() {
  return createMockProject({ name: 'Proyecto', entryFileId: 'main', activeFileId: 'active', files: [
    { id: 'active', name: 'otro.lumi', path: 'Proyecto/otro.lumi', content: '@' },
    { id: 'main', name: 'principal.lumi', path: 'Proyecto/principal.lumi', content: 'mostrar("BORRADOR")>>', isEntry: true },
  ] });
}
function bridge(response = reply()): DesktopBridge {
  return { analyze: vi.fn().mockResolvedValue(response), execute: vi.fn().mockResolvedValue(response),
    availability: vi.fn().mockResolvedValue({ available: true, message: 'Python' }) };
}

describe('Real compiler adapter', () => {
  it('labels the unavailable spatial capability without claiming that source has no rooms', () => {
    render(createElement(ViewportEmptyState, { type: 'scene_unavailable' }));
    expect(screen.getByText('Sin ScenePlan en esta respuesta')).toBeInTheDocument();
    expect(screen.queryByText('Sin habitaciones definidas')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('uses the explicit entry, exact relative paths and supplied draft contents', async () => {
    const api = bridge();
    const result = await new PythonCompilerService(api).execute(project());
    expect(api.execute).toHaveBeenCalledWith({ entryFile: 'principal.lumi', files: {
      'otro.lumi': '@', 'principal.lumi': 'mostrar("BORRADOR")>>',
    } });
    expect(result.origin).toBe('python');
    expect(result.logs).toContain('SALIDA_REAL');
    expect(result.scenePlan).toBeNull(); expect(result.debugSteps).toEqual([]);
    expect(validateCompileResult(result).isValid).toBe(true);
  });

  it('delivers a validated backend scene to the IDE result', async () => {
    const raw = reply();
    if (!raw.ok || raw.response.status === 'error') throw new Error('fixture');
    raw.response.result.analysisStatus = 'incomplete';
    raw.response.result.limitations = ['spatial_semantics_unavailable'];
    raw.response.result.capabilities.scenePlan = true;
    raw.response.result.scenePlan = createMockScenePlan({ rooms: [
      createMockRoom({ name: 'sala' }),
    ] });

    const result = await new PythonCompilerService(bridge(raw)).execute(project());

    expect(result.success).toBe(true);
    expect(result.scenePlan?.rooms[0].name).toBe('sala');
    expect(validateCompileResult(result).isValid).toBe(true);
  });

  it('maps authentic diagnostics without inventing severity or locations', async () => {
    const raw = reply();
    if (!raw.ok || raw.response.status === 'error') throw new Error('fixture');
    raw.response.status = 'failed';
    raw.response.result.diagnostics = [{ category: 'RUNTIME', code: 'RUN_DIVISION_BY_ZERO',
      file: 'principal.lumi', line: 3, column: 9, description: 'No se puede dividir entre cero.' }];
    const result = await new PythonCompilerService(bridge(raw)).execute(project());
    expect(result.diagnostics[0]).toMatchObject({ severity: 'unspecified', category: 'ejecucion',
      code: 'RUN_DIVISION_BY_ZERO', file: 'principal.lumi', line: 3, column: 9, blocking: true });
    expect(result.diagnostics[0].targetObjectId).toBeUndefined();
    expect(validateCompileResult(result).isValid).toBe(true);
  });

  it('shows lexical text without fabricating a navigable diagnostic', async () => {
    const raw = reply();
    if (!raw.ok || raw.response.status === 'error') throw new Error('fixture');
    raw.response.status = 'blocked';
    Object.assign(raw.response.result, { analysisStatus: 'failed', stage: 'lexical',
      lexicalError: 'principal.lumi:1:1: carácter inválido', executionAttempted: false, output: [] });
    const result = await new PythonCompilerService(bridge(raw)).execute(project());
    expect(result.diagnostics).toEqual([]);
    expect(result.logs.join('\n')).toContain('sin ubicación estructurada');
    expect(result.success).toBe(false);
  });

  it('keeps incomplete analysis incomplete', async () => {
    const raw = reply();
    if (!raw.ok || raw.response.status === 'error') throw new Error('fixture');
    Object.assign(raw.response, { operation: 'analyze', status: 'incomplete' });
    Object.assign(raw.response.result, { analysisStatus: 'incomplete', output: [],
      executionAttempted: false, limitations: ['spatial_semantics_unavailable'] });
    const result = await new PythonCompilerService(bridge(raw)).compile(project());
    expect(result.status).toBe('incomplete'); expect(result.success).toBe(false);
    expect(validateCompileResult(result).isValid).toBe(true);
  });

  it('never falls back to a mock when Electron or Python fails', async () => {
    expect(selectCompiler(false)).toBeInstanceOf(MockCompilerService);
    const missing = selectCompiler(true);
    expect(missing).toBeInstanceOf(PythonCompilerService);
    await expect(missing.compile(project())).rejects.toThrow('No se utilizará el mock');
    await expect(new PythonCompilerService(bridge({ ok: false, error: {
      code: 'PYTHON_UNAVAILABLE', message: 'No hay Python',
    } })).compile(project())).rejects.toThrow('No hay Python');
  });

  it('rejects a wrong operation or malformed response', async () => {
    await expect(new PythonCompilerService(bridge()).compile(project())).rejects.toThrow('operación');
    const invalid = { ok: true, response: {} } as unknown as BackendReply;
    await expect(new PythonCompilerService(bridge(invalid)).execute(project())).rejects.toThrow('Contrato');
  });

  it('rejects ambiguous entries, traversal and duplicate paths', () => {
    const value = project(); value.entryFileId = 'missing';
    expect(() => projectInput(value)).toThrow('principal');
    const traversal = project(); traversal.files[0].path = '../otro.lumi';
    expect(() => projectInput(traversal)).toThrow('relativas');
    const duplicate = project(); duplicate.files[0].path = 'Proyecto/principal.lumi';
    expect(() => projectInput(duplicate)).toThrow('duplicadas');
  });
});
