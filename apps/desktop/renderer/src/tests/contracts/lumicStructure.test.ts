import { describe, expect, it } from 'vitest';
import {
  createLumicArtifactFromCompileResult, parseAndValidateLumicArtifact,
  serializeLumicArtifact, validateLumicArtifact,
} from '../../services/compiler/contracts/contractValidator';
import {
  FIXTURE_COMPILATION_MULTI_STEP, FIXTURE_COMPILATION_SPATIAL_ISSUES,
  FIXTURE_COMPILATION_SUCCESS, FIXTURE_LUMIC_ARTIFACT,
} from '../../data/contracts';
import { MockCompilerService } from '../../services/compiler/MockCompilerService';
import { createMockProject } from '../fixtures/testFixtures';
import { changeField, completeFixture, declaredFields, readExample, resolve, schema } from './lumicSchemaFixtures';

describe('Candidate .lumic structural contract', () => {
  it.each(['valid-basic', 'valid-debug'])('accepts the published example %s', name => {
    expect(validateLumicArtifact(readExample(name)).errors).toEqual([]);
  });

  it.each(['invalid-envelope', 'invalid-dimensions', 'invalid-source-reference', 'invalid-debug'])(
    'rejects the published example %s', name => {
      const result = validateLumicArtifact(readExample(name));
      expect(result.isValid).toBe(false);
      expect(result.data).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
    },
  );

  it('accepts a document containing every field declared by the schema', () => {
    expect(validateLumicArtifact(completeFixture()).errors).toEqual([]);
  });

  it('resolves every schema definition and its required property declarations', () => {
    const visit = (input: typeof schema): void => {
      const node = resolve(input);
      for (const name of node.required ?? []) expect(node.properties).toHaveProperty(name);
      if (node.items) visit(node.items);
      for (const child of Object.values(node.properties ?? {})) visit(child);
    };
    visit(schema);
    for (const node of Object.values(schema.definitions!)) visit(node);
  });

  const fields = declaredFields();
  it.each(fields.map(field => ({ ...field, label: field.path.join('.') })))(
    'rejects null for declared field $label', ({ path }) => {
      expect(validateLumicArtifact(changeField(completeFixture(), path)).isValid).toBe(false);
    },
  );
  it.each(fields.filter(field => field.required).map(field => ({ ...field, label: field.path.join('.') })))(
    'requires declared field $label', ({ path }) => {
      expect(validateLumicArtifact(changeField(completeFixture(), path, true)).isValid).toBe(false);
    },
  );

  it.each([FIXTURE_LUMIC_ARTIFACT, ...[
    FIXTURE_COMPILATION_SUCCESS, FIXTURE_COMPILATION_SPATIAL_ISSUES, FIXTURE_COMPILATION_MULTI_STEP,
  ].map(result => createLumicArtifactFromCompileResult(result, { id: 'project', name: 'Project' }))])(
    'preserves existing valid artifacts and roundtrips', artifact => {
      expect(validateLumicArtifact(artifact).errors).toEqual([]);
      const result = parseAndValidateLumicArtifact(serializeLumicArtifact(artifact!));
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(artifact);
    },
  );

  it('accepts artifacts exported by the existing browser demo compiler', async () => {
    const result = await new MockCompilerService().compile(createMockProject());
    const artifact = createLumicArtifactFromCompileResult(result, { id: 'project', name: 'Project' });
    expect(artifact).not.toBeNull();
    expect(validateLumicArtifact(artifact).errors).toEqual([]);
  });

  it.each([null, [], true, 'artifact', 1])('rejects a non-object envelope: %j', value => {
    expect(validateLumicArtifact(value).isValid).toBe(false);
  });

  it.each([NaN, Infinity, -Infinity])('rejects non-finite geometry: %s', value => {
    const artifact = structuredClone(FIXTURE_LUMIC_ARTIFACT);
    artifact.scenePlan.rooms[0].doors = [{ id: 'door', wall: 'norte', position: value, width: 1, height: 2 }];
    const result = validateLumicArtifact(artifact, 'file');
    expect(result.isValid).toBe(false);
    expect(result.errors[0].path).toBe('file.scenePlan.rooms[0].doors[0].position');
  });

  it.each([[1, 2], [1, 2, 3, 4], [1, '2', 3], [1, 0, 1], [1, -1, 1]].map(dimensions => ({ dimensions })))(
    'rejects malformed or nonpositive dimensions $dimensions', ({ dimensions }) => {
      const artifact = readExample('valid-basic') as typeof FIXTURE_LUMIC_ARTIFACT;
      Object.assign(artifact.scenePlan.rooms[0], { dimensions });
      expect(validateLumicArtifact(artifact).isValid).toBe(false);
    },
  );

  it('rejects malformed source references and debug snapshots through the import boundary', () => {
    for (const name of ['invalid-source-reference', 'invalid-debug']) {
      expect(parseAndValidateLumicArtifact(JSON.stringify(readExample(name))).isValid).toBe(false);
    }
    const artifact = readExample('valid-debug') as typeof FIXTURE_LUMIC_ARTIFACT;
    const step = artifact.debugSteps!.find(item => item.sceneSnapshot.rooms.length > 0)!;
    step.sceneSnapshot.rooms[0].dimensions[0] = -1;
    expect(validateLumicArtifact(artifact).isValid).toBe(false);
    step.sceneSnapshot.rooms[0].dimensions[0] = 5;
    step.stepIndex = 0.5;
    expect(validateLumicArtifact(artifact).isValid).toBe(false);
  });

  it('preserves additional fields, empty imported scenes, and legacy major-version compatibility', () => {
    for (const version of ['1.0.0', '1.2.3', '1.0', '1legacy', '01.0']) {
      const artifact = structuredClone(FIXTURE_LUMIC_ARTIFACT);
      artifact.schemaVersion = version;
      artifact.scenePlan.version = version;
      artifact.scenePlan.rooms = [];
      Object.assign(artifact, { futureField: { preserved: true } });
      expect(validateLumicArtifact(artifact).errors).toEqual([]);
    }
    const artifact = structuredClone(FIXTURE_LUMIC_ARTIFACT);
    artifact.schemaVersion = '2.0.0';
    expect(validateLumicArtifact(artifact).errors[0].code).toBe('INCOMPATIBLE_VERSION');
  });

  it('leaves ID scope and reference resolution pending rather than inventing rules', () => {
    const artifact = structuredClone(FIXTURE_LUMIC_ARTIFACT);
    artifact.scenePlan.rooms.push(structuredClone(artifact.scenePlan.rooms[0]));
    artifact.scenePlan.rooms[0].objects[0].roomId = 'unresolved';
    expect(validateLumicArtifact(artifact).errors).toEqual([]);
  });
});
