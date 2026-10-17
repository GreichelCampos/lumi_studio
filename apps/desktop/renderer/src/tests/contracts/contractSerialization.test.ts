import { describe, it, expect } from 'vitest';
import {
  serializeCompileRequest,
  serializeCompileResult,
  serializeLumicArtifact,
  parseAndValidateCompileResult,
  parseAndValidateLumicArtifact,
  validateCompileRequest,
} from '../../services/compiler/contracts/contractValidator';
import {
  FIXTURE_COMPILATION_SUCCESS,
  FIXTURE_COMPILATION_BLOCKING,
  FIXTURE_COMPILATION_SPATIAL_ISSUES,
  FIXTURE_COMPILATION_MULTI_STEP,
  FIXTURE_LUMIC_ARTIFACT,
} from '../../data/contracts';
import { LumiCompileRequest } from '../../types';

describe('Contract Serialization & Deserialization Tests', () => {
  it('serializa y deserializa con éxito una solicitud de compilación (roundtrip)', () => {
    const request: LumiCompileRequest = {
      schemaVersion: '1.0.0',
      projectId: 'proj-roundtrip-1',
      projectName: 'ProyectoRoundtrip',
      entryFileId: 'f-entry-1',
      activeFileId: 'f-entry-1',
      files: [
        {
          id: 'f-entry-1',
          name: 'principal.lumi',
          path: 'src/principal.lumi',
          content: 'principal {\n  habitacion sala(6.0, 4.0, 2.7) {}\n}',
          isEntry: true,
        },
      ],
      options: {
        generateDebugSteps: true,
        generateScenePlan: true,
        strictSpatialChecks: true,
        debugLevel: 'verbose',
      },
      metadata: { author: 'EquipoLumi', environment: 'ai-studio' },
    };

    const serialized = serializeCompileRequest(request, true);
    expect(typeof serialized).toBe('string');
    expect(serialized).toContain('"schemaVersion": "1.0.0"');

    const parsed = JSON.parse(serialized);
    const validation = validateCompileRequest(parsed);

    expect(validation.isValid).toBe(true);
    expect(validation.data?.projectId).toBe('proj-roundtrip-1');
    expect(validation.data?.files).toHaveLength(1);
    expect(validation.data?.options?.strictSpatialChecks).toBe(true);
  });

  it('serializa y valida en roundtrip un resultado exitoso con ScenePlan', () => {
    const serialized = serializeCompileResult(FIXTURE_COMPILATION_SUCCESS, true);
    const roundtrip = parseAndValidateCompileResult(serialized);

    expect(roundtrip.isValid).toBe(true);
    expect(roundtrip.data?.compilationId).toBe(FIXTURE_COMPILATION_SUCCESS.compilationId);
    expect(roundtrip.data?.scenePlan?.rooms[0].name).toBe('sala_principal');
    expect(roundtrip.data?.scenePlan?.rooms[0].objects).toHaveLength(2);
  });

  it('serializa y valida en roundtrip un resultado con errores bloqueantes', () => {
    const serialized = serializeCompileResult(FIXTURE_COMPILATION_BLOCKING);
    const roundtrip = parseAndValidateCompileResult(serialized);

    expect(roundtrip.isValid).toBe(true);
    expect(roundtrip.data?.success).toBe(false);
    expect(roundtrip.data?.diagnostics).toHaveLength(2);
    expect(roundtrip.data?.scenePlan).toBeNull();
  });

  it('serializa y valida en roundtrip un resultado con depuración multietapa', () => {
    const serialized = serializeCompileResult(FIXTURE_COMPILATION_MULTI_STEP);
    const roundtrip = parseAndValidateCompileResult(serialized);

    expect(roundtrip.isValid).toBe(true);
    expect(roundtrip.data?.debugSteps).toHaveLength(3);
    expect(roundtrip.data?.debugSteps[2].activeObjectId).toBe('obj-sofa-01');
  });

  it('serializa y valida en roundtrip un artefacto .lumic compilado', () => {
    const serialized = serializeLumicArtifact(FIXTURE_LUMIC_ARTIFACT, true);
    const roundtrip = parseAndValidateLumicArtifact(serialized);

    expect(roundtrip.isValid).toBe(true);
    expect(roundtrip.data?.format).toBe('lumic');
    expect(roundtrip.data?.compiler.name).toBe('lumi-compiler');
    expect(roundtrip.data?.project.entryFile).toBe('principal.lumi');
    expect(roundtrip.data?.scenePlan.rooms).toHaveLength(1);
  });
});
