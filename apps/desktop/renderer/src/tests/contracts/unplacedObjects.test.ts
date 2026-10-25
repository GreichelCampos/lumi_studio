import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import type { ContractValidationError, UnplacedSpatialObject } from '../../types';
import { LUMI_PROTOCOL_VERSION, LUMIC_SCHEMA_VERSION } from '../../types';
import { createMockSpatialObject, createMockScenePlan, createMockDebugSteps } from '../fixtures/testFixtures';
import { FIXTURE_COMPILATION_SUCCESS } from '../../data/contracts';
import { sceneStructure } from '../../services/compiler/contracts/sceneStructure';
import { validateSpatialObject, validateScenePlan, validateLumicArtifact, createLumicArtifactFromCompileResult } from '../../services/compiler/contracts/contractValidator';
import { validateScenePayload } from '../../services/integration/protocol/scenePayload';
import { LumicFileService } from '../../services/storage/LumicFileService';

const base = createMockSpatialObject();
const { position, ...properties } = base;
const unplaced: UnplacedSpatialObject = { ...properties, placed: false };
const ajv = new Ajv({ strict: false });
const schemaRoot = resolve(process.cwd(), '../../../docs/contracts/lumic');
const schemas = Object.fromEntries(['1.0.0', '1.1.0'].map(version => [version,
  ajv.compile(JSON.parse(readFileSync(resolve(schemaRoot, `v${version}/lumic.schema.json`), 'utf8'))),
]));

function artifact(object: unknown, version = '1.1.0') {
  const result = createLumicArtifactFromCompileResult(structuredClone(FIXTURE_COMPILATION_SUCCESS), { id: 'fixture', name: 'Fixture' })!;
  result.schemaVersion = version;
  Object.assign(result.scenePlan.rooms[0], { objects: [object] });
  return result;
}

describe('placement compatibility fixtures', () => {
  it('preserves the historical schema from the Phase 2 base commit', () => {
    const original = readFileSync(resolve(schemaRoot, 'v1.0.0/lumic.schema.json'), 'utf8').replace(/\r\n/g, '\n');
    expect(createHash('sha256').update(original).digest('hex')).toBe('9b258729035adb99dfd190fc3f61357a25451f4f9316c227c85393d36dca4073');
  });
  it.each([
    ['legacy placed', base, true],
    ['explicit placed', { ...base, placed: true }, true],
    ['unplaced', unplaced, true],
    ['placed without position', { ...properties, placed: true }, false],
    ['unplaced with position', { ...base, placed: false }, false],
    ['missing placement', properties, false],
    ['null position', { ...base, position: null }, false],
    ['unplaced null position', { ...unplaced, position: null }, false],
    ['invalid placed type', { ...base, placed: 'false' }, false],
    ['invalid position', { ...base, position: [1, 2] }, false],
  ])('%s agrees across validators and JSON Schema', (_name, object, valid) => {
    const input = artifact(object);
    const before = structuredClone(input);
    const errors: ContractValidationError[] = [];
    sceneStructure(input.scenePlan, 'scene', errors);
    expect(errors.length === 0).toBe(valid);
    expect(validateSpatialObject(object).isValid).toBe(valid);
    expect(validateScenePlan(input.scenePlan).isValid).toBe(valid);
    expect(validateLumicArtifact(input).isValid).toBe(valid);
    expect(schemas['1.1.0'](input)).toBe(valid);
    expect(validateScenePayload({ scenePlan: input.scenePlan, capabilities: { scenePlan: true } }, 'completed').length === 0).toBe(valid);
    expect(input).toEqual(before);
  });

  it('keeps the legacy schema and importer aligned without migrating old data', () => {
    for (const object of [base, { ...base, placed: true }, unplaced, { ...base, placed: false },
      { ...base, placed: null }, { ...base, placed: 'historical metadata' }]) {
      const input = artifact(object, '1.0.0');
      const before = JSON.stringify(input);
      expect(validateLumicArtifact(input).isValid).toBe(schemas['1.0.0'](input));
      expect(validateLumicArtifact(input).isValid).toBe(Object.hasOwn(object, 'position'));
      expect(JSON.stringify(input)).toBe(before);
    }
    const result = LumicFileService.parseAndValidateContent(JSON.stringify(artifact(base, '1.0.0')));
    expect(result.success).toBe(true);
    expect(result.artifact?.schemaVersion).toBe('1.0.0');
    expect(result.artifact?.scenePlan.rooms[0].objects[0]).not.toHaveProperty('placed');
  });

  it('does not silently rewrite historical metadata to fit a new export', () => {
    const input = artifact({ ...base, placed: false }, '1.0.0');
    const text = JSON.stringify(input);
    const imported = LumicFileService.parseAndValidateContent(text);
    expect(imported.success).toBe(true);
    expect(JSON.stringify(imported.artifact)).toBe(text);
    const exported = LumicFileService.validateForExport({
      ...FIXTURE_COMPILATION_SUCCESS, scenePlan: imported.artifact!.scenePlan,
    }, null);
    expect(exported.canExport).toBe(false);
    expect(exported.error).toContain('position');
    expect(JSON.stringify(imported.artifact)).toBe(text);
  });

  it('roundtrips unplaced objects, references and snapshots without adding positions', () => {
    const scene = createMockScenePlan();
    scene.rooms[0].objects = [base, { ...unplaced, id: 'unplaced' }];
    const step = { ...createMockDebugSteps()[0], sceneSnapshot: scene };
    const result = { ...FIXTURE_COMPILATION_SUCCESS, scenePlan: scene, debugSteps: [step] };
    const exported = LumicFileService.validateForExport(result, null);
    expect(exported.canExport).toBe(true);
    expect(exported.artifact?.schemaVersion).toBe(LUMIC_SCHEMA_VERSION);
    const restored = LumicFileService.parseAndValidateContent(JSON.stringify(exported.artifact));
    expect(restored.success).toBe(true);
    expect(restored.artifact?.scenePlan).toEqual(scene);
    expect(restored.artifact?.debugSteps).toEqual([step]);
    expect(restored.artifact?.scenePlan.rooms[0].objects[1]).not.toHaveProperty('position');
    expect(restored.artifact?.scenePlan.rooms[0].objects[1].sourceRef).toEqual(unplaced.sourceRef);
    expect(LUMI_PROTOCOL_VERSION).toBe('1.0.0');
    expect(scene.version).toBe('1.0.0');
  });

  it('applies placement rules inside snapshots and rejects incompatible containers', () => {
    const input = artifact(base);
    input.debugSteps = [{ ...createMockDebugSteps()[0], sceneSnapshot: artifact(unplaced).scenePlan }];
    expect(validateLumicArtifact(input).isValid).toBe(true);
    expect(schemas['1.1.0'](input)).toBe(true);
    input.schemaVersion = '1.0.0';
    expect(validateLumicArtifact(input).isValid).toBe(false);
    expect(schemas['1.0.0'](input)).toBe(false);
    input.schemaVersion = '2.0.0';
    expect(validateLumicArtifact(input).errors[0].code).toBe('INCOMPATIBLE_VERSION');
  });

  it.each(['valid-mixed', 'invalid-unplaced-position'])('checks the published 1.1 example %s', name => {
    const input = JSON.parse(readFileSync(resolve(schemaRoot, `v1.1.0/examples/${name}.lumic`), 'utf8'));
    const valid = name === 'valid-mixed';
    expect(validateLumicArtifact(input).isValid).toBe(valid);
    expect(schemas['1.1.0'](input)).toBe(valid);
  });
});
