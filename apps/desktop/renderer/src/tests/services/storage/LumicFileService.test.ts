import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LumicFileService } from '../../../services/storage/LumicFileService';
import {
  FIXTURE_COMPILATION_SUCCESS,
  FIXTURE_COMPILATION_BLOCKING,
  FIXTURE_COMPILATION_MULTI_STEP,
  FIXTURE_LUMIC_ARTIFACT,
  CONTRACT_FIXTURES_JSON,
} from '../../../data/contracts';
import { createMockProject } from '../../fixtures/testFixtures';
import { CompileResult } from '../../../types';

describe('LumicFileService (.lumic Export and Import)', () => {
  const mockProject = createMockProject({ name: 'Departamento Moderno' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Exportación (.lumic)', () => {
    it('valida exitosamente la exportación de una compilación válida con ScenePlan', () => {
      const res = LumicFileService.validateForExport(FIXTURE_COMPILATION_SUCCESS, mockProject);
      expect(res.canExport).toBe(true);
      expect(res.artifact).toBeDefined();
      expect(res.artifact?.format).toBe('lumic');
      expect(res.artifact?.schemaVersion).toBe('1.0.0');
      expect(res.artifact?.project.name).toBe('Departamento Moderno');
      expect(res.artifact?.scenePlan.rooms).toHaveLength(1);
    });

    it('impide la exportación si no existe un resultado de compilación previo', () => {
      const res = LumicFileService.validateForExport(null, mockProject);
      expect(res.canExport).toBe(false);
      expect(res.error).toContain('No hay ningún resultado disponible');
      expect(res.error).toContain('Compilar solo analiza');
    });

    it('impide la exportación si la compilación contiene errores bloqueantes', () => {
      const res = LumicFileService.validateForExport(FIXTURE_COMPILATION_BLOCKING, mockProject);
      expect(res.canExport).toBe(false);
      expect(res.error).toContain('resultado fallido o incompleto');
    });

    it('impide la exportación si la compilación no contiene habitaciones en el ScenePlan', () => {
      const compileSinHabitaciones: CompileResult = {
        ...FIXTURE_COMPILATION_SUCCESS,
        scenePlan: {
          version: '1.0.0',
          rooms: [],
        },
      };

      const res = LumicFileService.validateForExport(compileSinHabitaciones, mockProject);
      expect(res.canExport).toBe(false);
      expect(res.error).toContain('habitaciones ni elementos espaciales');
    });

    it('ejecuta exportLumic generando el nombre de archivo higienizado y el JSON serializado', () => {
      const spyDownload = vi.spyOn(LumicFileService, 'downloadInBrowser').mockReturnValue(true);

      const res = LumicFileService.exportLumic(FIXTURE_COMPILATION_SUCCESS, mockProject);
      expect(res.success).toBe(true);
      expect(res.fileName).toBe('departamento_moderno.lumic');
      expect(res.rawJson).toContain('"format": "lumic"');
      expect(spyDownload).toHaveBeenCalledWith(res.rawJson, 'departamento_moderno.lumic');
    });

    it('reports a failed download without claiming a successful export', () => {
      vi.spyOn(LumicFileService, 'downloadInBrowser').mockReturnValue(false);
      const res = LumicFileService.exportLumic(FIXTURE_COMPILATION_SUCCESS, mockProject);
      expect(res.success).toBe(false);
      expect(res.error).toContain('No se pudo iniciar la descarga');
      expect(res.fileName).toBeUndefined();
    });

    it('exports and reimports a successful Python scene without changing its data', () => {
      const result: CompileResult = {
        ...FIXTURE_COMPILATION_SUCCESS, origin: 'python', operation: 'execute', debugSteps: [],
      };
      vi.spyOn(LumicFileService, 'downloadInBrowser').mockReturnValue(true);
      const exported = LumicFileService.exportLumic(result, mockProject);
      expect(exported.success).toBe(true);
      const imported = LumicFileService.parseAndValidateContent(exported.rawJson!);
      expect(imported.success).toBe(true);
      expect(imported.artifact?.scenePlan).toEqual(result.scenePlan);
      expect(imported.artifact?.debugSteps).toEqual([]);
    });

    it('explains that a successful analysis without a scene cannot be exported', () => {
      const res = LumicFileService.validateForExport({
        ...FIXTURE_COMPILATION_SUCCESS, origin: 'python', operation: 'analyze', scenePlan: null,
      }, mockProject);
      expect(res.canExport).toBe(false);
      expect(res.error).toContain('Compilar solo analiza');
      expect(res.error).toContain('ejecuta un programa');
    });
  });

  describe('Importación (.lumic)', () => {
    it('importa y valida un archivo .lumic válido canónico', () => {
      const res = LumicFileService.parseAndValidateContent(CONTRACT_FIXTURES_JSON.sampleLumic);
      expect(res.success).toBe(true);
      expect(res.artifact?.format).toBe('lumic');
      expect(res.artifact?.project.name).toBe('ApartamentoMinimalista');
      expect(res.artifact?.scenePlan.rooms).toHaveLength(1);
      expect(res.artifact?.scenePlan.rooms[0].objects[0]).not.toHaveProperty('placed');
    });

    it('presenta un error comprensible cuando el archivo tiene sintaxis JSON corrupta', () => {
      const jsonCorrupto = '{ format: "lumic", "schemaVersion": ';
      const res = LumicFileService.parseAndValidateContent(jsonCorrupto);

      expect(res.success).toBe(false);
      expect(res.error).toContain('corrupto o no contiene un formato JSON válido');
      expect(res.validationErrors?.[0].code).toBe('MALFORMED_JSON');
    });

    it('presenta un error comprensible cuando la versión de esquema es incompatible (ej. v2.0.0)', () => {
      const artifactVersionIncompatible = JSON.stringify({
        ...FIXTURE_LUMIC_ARTIFACT,
        schemaVersion: '2.0.0',
      });

      const res = LumicFileService.parseAndValidateContent(artifactVersionIncompatible);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Versión incompatible');
      expect(res.validationErrors?.some((e) => e.code === 'INCOMPATIBLE_VERSION')).toBe(true);
    });

    it('presenta un error comprensible cuando faltan campos estructurales obligatorios', () => {
      const artifactSinScenePlan = JSON.stringify({
        format: 'lumic',
        schemaVersion: '1.0.0',
        compiledAt: '2026-10-12T00:00:00Z',
        compiler: { name: 'lumi', version: '1.0', target: '3d' },
        project: { id: 'p1', name: 'p1', entryFile: 'p.lumi', sourceFilesCount: 1 },
      });

      const res = LumicFileService.parseAndValidateContent(artifactSinScenePlan);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Campo obligatorio faltante');
      expect(res.validationErrors?.some((e) => e.code === 'MISSING_REQUIRED_FIELD')).toBe(true);
    });

    it('presenta un error comprensible si las dimensiones espaciales son inválidas o menores o iguales a cero', () => {
      const artifactDimensionesNegativas = JSON.stringify({
        ...FIXTURE_LUMIC_ARTIFACT,
        scenePlan: {
          version: '1.0.0',
          rooms: [
            {
              ...FIXTURE_LUMIC_ARTIFACT.scenePlan.rooms[0],
              dimensions: [-5.0, 4.0, 2.7],
            },
          ],
        },
      });

      const res = LumicFileService.parseAndValidateContent(artifactDimensionesNegativas);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Referencia espacial inválida');
      expect(res.validationErrors?.some((e) => e.code === 'INVALID_SPATIAL_REFERENCE')).toBe(true);
    });
  });

  describe('Ciclo completo: exportar → serializar → importar', () => {
    it('conserva fielmente ScenePlan, entidades y DebugSteps en el ciclo completo', () => {
      const exportRes = LumicFileService.validateForExport(FIXTURE_COMPILATION_MULTI_STEP, mockProject);
      expect(exportRes.canExport).toBe(true);

      const jsonString = JSON.stringify(exportRes.artifact, null, 2);

      const importRes = LumicFileService.parseAndValidateContent(jsonString);
      expect(importRes.success).toBe(true);

      expect(importRes.artifact?.scenePlan.rooms).toHaveLength(
        FIXTURE_COMPILATION_MULTI_STEP.scenePlan!.rooms.length
      );
      expect(importRes.artifact?.debugSteps).toHaveLength(
        FIXTURE_COMPILATION_MULTI_STEP.debugSteps.length
      );
      expect(importRes.artifact?.debugSteps?.[2].activeObjectId).toBe(
        FIXTURE_COMPILATION_MULTI_STEP.debugSteps[2].activeObjectId
      );
    });

    it('lee y valida un objeto File del navegador mediante readAndValidateFile', async () => {
      const fileBlob = new File([CONTRACT_FIXTURES_JSON.sampleLumic], 'prueba.lumic', {
        type: 'application/json',
      });

      const res = await LumicFileService.readAndValidateFile(fileBlob);
      expect(res.success).toBe(true);
      expect(res.artifact?.project.name).toBe('ApartamentoMinimalista');
    });
  });
});
