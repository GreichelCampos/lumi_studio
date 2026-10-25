import { describe, it, expect } from 'vitest';
import {
  validateCompileRequest,
  validateCompileResult,
  validateScenePlan,
  validateDiagnosticItem,
  validateSpatialObject,
  validateRoomModel,
  validateDebugStep,
  validateLumicArtifact,
  parseAndValidateCompileResult,
  parseAndValidateLumicArtifact,
  createSafeFallbackCompileResult,
  createLumicArtifactFromCompileResult,
  isVersionCompatible,
} from '../../services/compiler/contracts/contractValidator';
import {
  FIXTURE_COMPILATION_SUCCESS,
  FIXTURE_COMPILATION_BLOCKING,
  FIXTURE_COMPILATION_SPATIAL_ISSUES,
  FIXTURE_COMPILATION_MULTI_STEP,
  FIXTURE_COMPILATION_MALFORMED,
  FIXTURE_LUMIC_ARTIFACT,
  CONTRACT_FIXTURES_JSON,
} from '../../data/contracts';
import { MockCompilerService } from '../../services/compiler/MockCompilerService';
import { createMockProject, createMockRoom, createMockSpatialObject } from '../fixtures/testFixtures';
import { LumiCompileRequest } from '../../types';

describe('Contract Validator (Fase de Contratos de Integración)', () => {
  describe('isVersionCompatible', () => {
    it('acepta versiones mayores soportadas (v1.x.x)', () => {
      expect(isVersionCompatible('1.0.0')).toBe(true);
      expect(isVersionCompatible('1.2.3')).toBe(true);
      expect(isVersionCompatible('1.0')).toBe(true);
    });

    it('rechaza versiones mayores incompatibles o formatos inválidos', () => {
      expect(isVersionCompatible('2.0.0')).toBe(false);
      expect(isVersionCompatible('0.9.0')).toBe(false);
      expect(isVersionCompatible('')).toBe(false);
      expect(isVersionCompatible(undefined)).toBe(false);
    });
  });

  describe('Validación con Fixtures JSON canónicos', () => {
    it('valida exitosamente el fixture de compilación exitosa con ScenePlan', () => {
      const res = validateCompileResult(FIXTURE_COMPILATION_SUCCESS);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.data?.success).toBe(true);
      expect(res.data?.scenePlan?.rooms).toHaveLength(1);
    });

    it('valida exitosamente el fixture de compilación con errores bloqueantes', () => {
      const res = validateCompileResult(FIXTURE_COMPILATION_BLOCKING);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.data?.success).toBe(false);
      expect(res.data?.status).toBe('blocked');
      expect(res.data?.diagnostics).toHaveLength(2);
      expect(res.data?.diagnostics.every((d) => d.blocking)).toBe(true);
    });

    it('valida exitosamente el fixture de compilación con incidencias espaciales', () => {
      const res = validateCompileResult(FIXTURE_COMPILATION_SPATIAL_ISSUES);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.data?.status).toBe('completed_with_spatial_issues');
      expect(res.data?.diagnostics).toHaveLength(2);
      expect(res.data?.scenePlan?.rooms[0].objects[0].hasCollision).toBe(true);
    });

    it('valida exitosamente el fixture de compilación con depurador multietapa', () => {
      const res = validateCompileResult(FIXTURE_COMPILATION_MULTI_STEP);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.data?.debugSteps).toHaveLength(3);
      expect(res.data?.debugSteps[1].eventType).toBe('room_create');
    });

    it('detecta múltiples violaciones de contrato en el fixture malformado', () => {
      const res = validateCompileResult(FIXTURE_COMPILATION_MALFORMED);
      expect(res.isValid).toBe(false);
      expect(res.errors.length).toBeGreaterThan(5);

      const errorCodes = res.errors.map((e) => e.code);
      expect(errorCodes).toContain('INCOMPATIBLE_VERSION');
      expect(errorCodes).toContain('MISSING_REQUIRED_FIELD');
      expect(errorCodes).toContain('INVALID_FIELD_TYPE');
      expect(errorCodes).toContain('INVALID_SPATIAL_REFERENCE');
    });

    it('valida exitosamente el artefacto .lumic canónico', () => {
      const res = validateLumicArtifact(FIXTURE_LUMIC_ARTIFACT);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.data?.format).toBe('lumic');
      expect(res.data?.project.name).toBe('ApartamentoMinimalista');
    });
  });

  describe('validateCompileRequest', () => {
    it('valida una solicitud de compilación bien formada', () => {
      const req: LumiCompileRequest = {
        schemaVersion: '1.0.0',
        projectId: 'proj-1',
        projectName: 'MiProyecto',
        files: [
          {
            id: 'f1',
            name: 'principal.lumi',
            path: 'principal.lumi',
            content: 'principal { }',
            isEntry: true,
          },
        ],
        options: {
          generateDebugSteps: true,
          generateScenePlan: true,
        },
      };

      const res = validateCompileRequest(req);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('rechaza solicitudes sin archivos o con versión incompatible', () => {
      const reqSinArchivos = {
        schemaVersion: '1.0.0',
        projectId: 'p1',
        projectName: 'Prueba',
        files: [],
      };
      const res1 = validateCompileRequest(reqSinArchivos);
      expect(res1.isValid).toBe(false);
      expect(res1.errors.some((e) => e.code === 'MISSING_REQUIRED_FIELD')).toBe(true);

      const reqVersionInvalida = {
        schemaVersion: '3.0.0',
        projectId: 'p1',
        projectName: 'Prueba',
        files: [{ id: '1', name: 'a.lumi', path: 'a.lumi', content: 'code' }],
      };
      const res2 = validateCompileRequest(reqVersionInvalida);
      expect(res2.isValid).toBe(false);
      expect(res2.errors.some((e) => e.code === 'INCOMPATIBLE_VERSION')).toBe(true);
    });
  });

  describe('Validación de referencias espaciales (INVALID_SPATIAL_REFERENCE)', () => {
    it('rechaza dimensiones de habitación no numéricas, menores o iguales a cero', () => {
      const habitacionInvalida = createMockRoom({
        dimensions: [0, 4.0, 2.7],
      });
      const res = validateRoomModel(habitacionInvalida);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.code === 'INVALID_SPATIAL_REFERENCE')).toBe(true);
    });

    it('rechaza dimensiones negativas de objetos espaciales', () => {
      const objInvalido = createMockSpatialObject({
        dimensions: [-2.0, 0.8, 0.9],
      });
      const res = validateSpatialObject(objInvalido);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.code === 'INVALID_SPATIAL_REFERENCE')).toBe(true);
    });

    it('rechaza orientación de pared inválida en puertas o ventanas', () => {
      const habConPuertaInvalida = createMockRoom({
        doors: [
          {
            id: 'd1',
            wall: 'noroeste' as unknown as 'norte',
            position: 0,
            width: 0.9,
            height: 2.1,
          },
        ],
      });
      const res = validateRoomModel(habConPuertaInvalida);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.code === 'INVALID_SPATIAL_REFERENCE')).toBe(true);
    });

    it('rechaza coordenadas no finitas (NaN o Infinity) en objetos', () => {
      const objNaN = createMockSpatialObject({
        position: [NaN, 0, 0],
      });
      const res = validateSpatialObject(objNaN);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.code === 'INVALID_SPATIAL_REFERENCE')).toBe(true);
    });
  });

  describe('parseAndValidateCompileResult (Resiliencia y parsing seguro)', () => {
    it('parsea y valida correctamente JSON serializado válido', () => {
      const res = parseAndValidateCompileResult(CONTRACT_FIXTURES_JSON.success);
      expect(res.isValid).toBe(true);
      expect(res.data?.compilationId).toBe('comp-succ-fixture-001');
    });

    it('captura errores de sintaxis JSON sin crashear (MALFORMED_JSON)', () => {
      const jsonInvalido = '{"compilationId": "123", status: blocked';
      const res = parseAndValidateCompileResult(jsonInvalido);
      expect(res.isValid).toBe(false);
      expect(res.errors).toHaveLength(1);
      expect(res.errors[0].code).toBe('MALFORMED_JSON');
      expect(res.errors[0].message).toContain('JSON');
    });

    it('maneja strings vacías o nulas sin lanzar excepciones', () => {
      const res = parseAndValidateCompileResult('');
      expect(res.isValid).toBe(false);
      expect(res.errors[0].code).toBe('MALFORMED_JSON');
    });
  });

  describe('createSafeFallbackCompileResult', () => {
    it('genera un CompileResult seguro que protege al IDE de crasheos ante datos corruptos', () => {
      const errores = [
        {
          path: 'scenePlan.rooms[0].dimensions',
          code: 'INVALID_SPATIAL_REFERENCE' as const,
          message: 'Dimensiones negativas',
        },
        {
          path: 'diagnostics[0].line',
          code: 'INVALID_FIELD_TYPE' as const,
          message: 'Línea no es número',
        },
      ];

      const fallback = createSafeFallbackCompileResult(null, errores, 'comp-test-fallback');

      expect(fallback.compilationId).toBe('comp-test-fallback');
      expect(fallback.status).toBe('blocked');
      expect(fallback.success).toBe(false);
      expect(fallback.diagnostics).toHaveLength(2);
      expect(fallback.diagnostics[0].code).toBe('LUMI-E802');
      expect(fallback.diagnostics[1].code).toBe('LUMI-E801');
      expect(fallback.logs.length).toBeGreaterThan(1);
      expect(fallback.scenePlan).toBeNull();
    });
  });

  describe('Empaquetado de artefacto .lumic (createLumicArtifactFromCompileResult)', () => {
    it('crea un artefacto .lumic válido a partir de un resultado de compilación exitoso', () => {
      const artifact = createLumicArtifactFromCompileResult(FIXTURE_COMPILATION_SUCCESS, {
        id: 'proj-demo',
        name: 'DemoProyecto',
        filesCount: 1,
      });

      expect(artifact).not.toBeNull();
      expect(artifact?.format).toBe('lumic');
      expect(artifact?.schemaVersion).toBe('1.1.0');
      expect(artifact?.project.name).toBe('DemoProyecto');

      const val = validateLumicArtifact(artifact);
      expect(val.isValid).toBe(true);
    });

    it('retorna null si el resultado no contiene un ScenePlan', () => {
      const artifact = createLumicArtifactFromCompileResult(FIXTURE_COMPILATION_BLOCKING, {
        id: 'p1',
        name: 'SinScenePlan',
      });
      expect(artifact).toBeNull();
    });
  });

  describe('Conformidad del servicio por defecto MockCompilerService', () => {
    it('el resultado de compilación de MockCompilerService satisface 100% los contratos formales', async () => {
      const mockCompiler = new MockCompilerService(0);
      const project = createMockProject();

      const result = await mockCompiler.compile(project);
      const validation = validateCompileResult(result);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.data?.compilationId).toBeTruthy();
      expect(validation.data?.status).toBe('completed');
      expect(validation.data?.scenePlan).not.toBeNull();
    });
  });
});
