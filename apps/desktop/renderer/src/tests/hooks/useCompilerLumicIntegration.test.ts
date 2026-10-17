import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompiler } from '../../hooks/useCompiler';
import { FIXTURE_LUMIC_ARTIFACT } from '../../data/contracts';
import { LumiCompiledArtifact } from '../../types';

describe('useCompiler - Integración de Artefactos .lumic', () => {
  it('carga y proyecta un artefacto .lumic en el estado del compilador sin alterar proyectos fuente', () => {
    const { result } = renderHook(() => useCompiler());

    expect(result.current.scenePlan).toBeNull();
    expect(result.current.debugSteps).toHaveLength(0);

    // Cargar artefacto compilado
    act(() => {
      result.current.loadCompiledArtifact(FIXTURE_LUMIC_ARTIFACT);
    });

    // 1. Debe actualizar el ScenePlan para el visor 3D
    expect(result.current.scenePlan).not.toBeNull();
    expect(result.current.scenePlan?.rooms).toHaveLength(1);
    expect(result.current.scenePlan?.rooms[0].name).toBe('estudio');

    // 2. Debe generar un resultado de compilación sintético conforme al contrato
    expect(result.current.lastCompileResult).not.toBeNull();
    expect(result.current.lastCompileResult?.success).toBe(true);
    expect(result.current.lastCompileResult?.status).toBe('completed');
    expect(result.current.lumiState).toBe('success');

    // 3. Debe incluir logs descriptivos del artefacto
    expect(result.current.logs.some((l) => l.includes('ApartamentoMinimalista'))).toBe(true);
  });

  it('restaura pasos de depuración cuando el artefacto los contiene', () => {
    const { result } = renderHook(() => useCompiler());

    const artefactoConDebugSteps: LumiCompiledArtifact = {
      ...FIXTURE_LUMIC_ARTIFACT,
      debugSteps: [
        {
          id: 'step-1',
          stepIndex: 1,
          eventType: 'start',
          description: 'Inicio',
          sourceRef: { file: 'principal.lumi', line: 1 },
          lineNumber: 1,
          codeLine: 'principal {',
          actionDescription: 'Inicio',
          sceneSnapshot: FIXTURE_LUMIC_ARTIFACT.scenePlan,
        },
      ],
    };

    act(() => {
      result.current.loadCompiledArtifact(artefactoConDebugSteps);
    });

    expect(result.current.debugSteps).toHaveLength(1);
    expect(result.current.debugSteps[0].id).toBe('step-1');
  });
});
