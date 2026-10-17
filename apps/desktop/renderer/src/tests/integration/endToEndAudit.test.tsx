import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompiler } from '../../hooks/useCompiler';
import { LumicFileService } from '../../services/storage/LumicFileService';
import { MockCompilerService } from '../../services/compiler/MockCompilerService';
import {
  createMockProject,
  createMockFile,
} from '../fixtures/testFixtures';
import {
  FIXTURE_COMPILATION_SUCCESS,
  FIXTURE_COMPILATION_BLOCKING,
  FIXTURE_COMPILATION_SPATIAL_ISSUES,
  FIXTURE_LUMIC_ARTIFACT,
  CONTRACT_FIXTURES_JSON,
} from '../../data/contracts';
import { LumiCompiledArtifact, CompileResult } from '../../types';

describe('Fase 7 — Auditoría funcional e integración de extremo a extremo', () => {
  let mockCompiler: MockCompilerService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCompiler = new MockCompilerService(0);
  });

  describe('Flujo A: Compilación normal completa', () => {
    it('compila código Lumi válido, genera ScenePlan 3D, pasos del depurador y registros', async () => {
      const project = createMockProject({
        files: [
          createMockFile({
            content: `principal {\n  habitacion sala(6.0, 5.0, 2.8) {\n    colocar sofa en [0.0, 0.0, -1.0]>>\n  }\n  visualizar3D(sala)>>\n}`,
          }),
        ],
      });

      const { result } = renderHook(() =>
        useCompiler({ customCompilerService: mockCompiler })
      );

      let compileRes: CompileResult | null = null;
      await act(async () => {
        compileRes = await result.current.runCompile(project);
      });

      expect(compileRes).not.toBeNull();
      expect(compileRes?.success).toBe(true);
      expect(compileRes?.status).toBe('completed');
      expect(result.current.lumiState).toBe('success');

      expect(compileRes?.scenePlan).not.toBeNull();
      expect(compileRes?.scenePlan?.rooms).toHaveLength(1);
      expect(compileRes?.scenePlan?.rooms[0].name).toBe('sala');
      expect(compileRes?.scenePlan?.rooms[0].objects).toHaveLength(1);
      expect(compileRes?.scenePlan?.rooms[0].objects[0].name).toBe('sofa');

      expect(compileRes?.debugSteps.length).toBeGreaterThan(0);
      expect(compileRes?.debugSteps.some((s) => s.eventType === 'room_create')).toBe(true);
      expect(compileRes?.debugSteps.some((s) => s.eventType === 'place_object')).toBe(true);
    });
  });

  describe('Flujo B: Errores de compilación bloqueantes', () => {
    it('bloquea la escena 3D cuando existen errores de sintaxis y no presenta una escena inválida', async () => {
      const projectConError = createMockProject({
        files: [
          createMockFile({
            // Falta terminador >> en la colocación
            content: `principal {\n  habitacion sala(5.0, 4.0, 2.7) {\n    colocar sofa en [0.0, 0.0, 0.0]\n  }\n}`,
          }),
        ],
      });

      const { result } = renderHook(() =>
        useCompiler({ customCompilerService: mockCompiler })
      );

      let compileRes: CompileResult | null = null;
      await act(async () => {
        compileRes = await result.current.runCompile(projectConError);
      });

      expect(compileRes).not.toBeNull();
      expect(compileRes?.success).toBe(false);
      expect(compileRes?.status).toBe('blocked');
      expect(result.current.lumiState).toBe('error');

      // ScenePlan debe ser NULL estricto para impedir visualización errónea
      expect(compileRes?.scenePlan).toBeNull();
      expect(result.current.scenePlan).toBeNull();

      // Los diagnósticos deben incluir referencia exacta al archivo y línea
      const blockingError = compileRes?.diagnostics.find((d) => d.blocking);
      expect(blockingError).toBeDefined();
      expect(blockingError?.line).toBe(3);
      expect(blockingError?.description).toContain('>>');
    });
  });

  describe('Flujo C: Advertencias espaciales no bloqueantes', () => {
    it('permite la visualización 3D y habilita canRun cuando solo existen incidencias espaciales', async () => {
      const projectConColision = createMockProject({
        files: [
          createMockFile({
            // Mesa y silla colocadas exactamente en la misma posición [0,0,0]
            content: `principal {\n  habitacion sala(6.0, 5.0, 2.7) {\n    colocar mesa en [0.0, 0.0, 0.0]>>\n    colocar silla en [0.0, 0.0, 0.0]>>\n  }\n}`,
          }),
        ],
      });

      const { result } = renderHook(() =>
        useCompiler({ customCompilerService: mockCompiler })
      );

      let compileRes: CompileResult | null = null;
      await act(async () => {
        compileRes = await result.current.runCompile(projectConColision);
      });

      // No debe bloquear la escena
      expect(compileRes).not.toBeNull();
      expect(compileRes?.success).toBe(true);
      expect(compileRes?.status).toBe('completed_with_spatial_issues');
      expect(result.current.scenePlan).not.toBeNull();

      // Debe marcar la entidad en colisión para el inspector
      const objects = compileRes?.scenePlan?.rooms[0].objects || [];
      expect(objects.some((o) => o.hasCollision)).toBe(true);

      // Los diagnósticos espaciales deben contener targetObjectId
      const spatialDiag = compileRes?.diagnostics.find((d) => d.category === 'espacial');
      expect(spatialDiag).toBeDefined();
      expect(spatialDiag?.blocking).toBe(false);
      expect(spatialDiag?.targetObjectId).toBeTruthy();
    });
  });

  describe('Flujo D: Artefactos .lumic y ciclo de vida', () => {
    it('exporta, importa y restaura escena 3D y depurador sin alterar el proyecto fuente original', async () => {
      const project = createMockProject({ name: 'Proyecto Fuente Original' });

      const exportRes = LumicFileService.validateForExport(
        FIXTURE_COMPILATION_SUCCESS,
        project
      );
      expect(exportRes.canExport).toBe(true);
      expect(exportRes.artifact?.project.name).toBe('Proyecto Fuente Original');

      const { result } = renderHook(() => useCompiler());

      act(() => {
        result.current.loadCompiledArtifact(exportRes.artifact!);
      });

      expect(result.current.scenePlan).not.toBeNull();
      expect(result.current.scenePlan?.rooms).toHaveLength(1);
      expect(result.current.lastCompileResult?.success).toBe(true);

      // Comprobar que los archivos del proyecto no hayan sido tocados
      expect(project.files).toHaveLength(1);
      expect(project.name).toBe('Proyecto Fuente Original');

      // 3. Recompilar posteriormente debe sobreescribir limpiamente el estado del artefacto con los fuentes
      await act(async () => {
        await result.current.runCompile(project);
      });

      // La escena activa ahora proviene de la compilación de los archivos fuente
      expect(result.current.lastCompileResult?.compilationId).not.toContain('artifact-');
    });

    it('una importación fallida por corrupción no altera el estado del compilador existente', async () => {
      const { result } = renderHook(() => useCompiler());

      act(() => {
        result.current.loadCompiledArtifact(FIXTURE_LUMIC_ARTIFACT);
      });
      const previousScene = result.current.scenePlan;

      const badImport = LumicFileService.parseAndValidateContent('{ "corrupto": true, ');
      expect(badImport.success).toBe(false);

      // El estado del ScenePlan debe permanecer inalterado
      expect(result.current.scenePlan).toBe(previousScene);
    });
  });

  describe('Flujo E: Condiciones de carrera y atajos', () => {
    it('previene condiciones de carrera descartando resultados de compilaciones obsoletas', async () => {
      // Compilador simulado con latencia artificial controlada
      let delayLento = 50;
      let delayRapido = 10;

      const slowCompiler = {
        compile: vi.fn().mockImplementation(async (proj, opts) => {
          const delay = (opts as { activeFileId?: string })?.activeFileId === 'lento' ? delayLento : delayRapido;
          await new Promise((r) => setTimeout(r, delay));
          return {
            ...FIXTURE_COMPILATION_SUCCESS,
            compilationId: `comp-${delay}`,
            logs: [`Resultado para delay ${delay}`],
          };
        }),
      };

      const { result } = renderHook(() =>
        useCompiler({ customCompilerService: slowCompiler })
      );

      const proj = createMockProject();

      // Disparar compilación 1 (lenta) y de inmediato compilación 2 (rápida)
      act(() => {
        result.current.runCompile(proj, 'lento');
      });
      await act(async () => {
        await result.current.runCompile(proj, 'rapido');
      });

      // Esperar a que la compilación lenta hipotéticamente termine
      await new Promise((r) => setTimeout(r, 60));

      // El resultado final debe ser el de la compilación más reciente (rápida), no la lenta
      expect(result.current.lastCompileResult?.compilationId).toBe('comp-10');
      expect(result.current.logs[0]).toContain('Resultado para delay 10');
    });
  });
});
