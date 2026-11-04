import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import casa from '../fixtures/python/casaEjemplo.real.json';
import pendiente from '../fixtures/python/architecturePending.real.json';
import { validateProtocolResponse } from '../../services/integration/protocol/responseValidator';
import { adaptBackendResult } from '../../services/integration/resultAdapter';
import { LumicFileService } from '../../services/storage/LumicFileService';
import { validateLumicStructure } from '../../services/compiler/contracts/lumicStructure';
import { RoomFactory } from '../../components/viewport/factories/RoomFactory';
import { FurnitureFactory } from '../../components/viewport/factories/FurnitureFactory';
import { ThreeResourceDisposer } from '../../components/viewport/resources/ThreeResourceDisposer';
import { createMockProject } from '../fixtures/testFixtures';

// Captured from real Python execution; these tests replay the boundary, not the compiler.
function respuesta(index: number) {
  const validated = validateProtocolResponse(casa.responses[index]);
  if (validated.valid === false) throw new Error(validated.errors.join(' '));
  if (validated.value.status === 'error') throw new Error(validated.value.error.message);
  return validated.value;
}

describe('captured real Python CasaEjemplo and pending architecture boundary', () => {
  it('keeps incomplete analysis distinct from successful execution', () => {
    const analysis = respuesta(0); const execution = respuesta(1);
    expect(analysis.status).toBe('incomplete');
    expect(analysis.result.limitations).toEqual(['spatial_semantics_unavailable']);
    expect(analysis.result.scenePlan).toBeUndefined();
    expect(execution.status).toBe('completed');
    expect(execution.result.analysisStatus).toBe('incomplete');
    expect(execution.result.diagnostics).toEqual([]);
    expect(execution.result.output).toEqual(['Area de sala:', '30.0']);
  });

  it('preserves the actual producer IDs, source references, dimensions and transformations', () => {
    const response = respuesta(1);
    const result = adaptBackendResult(response, createMockProject(), 0);
    expect(result.scenePlan).toEqual(response.result.scenePlan);
    const rooms = result.scenePlan!.rooms;
    expect(rooms.map(room => room.dimensions)).toEqual([[6, 5, 3], [4, 3, 2.6]]);
    const mesa = rooms[0].objects[0];
    expect(mesa.id).toBe('element:principal.lumi:19:9:mesa_centro');
    expect(mesa.sourceRef).toEqual({ file: 'principal.lumi', line: 19, column: 9 });
    expect(mesa.position).toEqual([1.5, 0, 0.5]);
    expect(mesa.rotation).toEqual([0, 90, 0]);
    expect(mesa.dimensions).toEqual([1.2, 0.5, 0.8]);
    // Runtime operation provenance is richer than the DTO's declaration sourceRef.
    expect(casa.runtimeScenePlan.rooms[0].elements[1].position?.source.file).toBe('muebles.lumi');
  });

  it('builds real room and furniture geometry without mutating the received scene', () => {
    const scene = respuesta(1).result.scenePlan!;
    const before = JSON.stringify(scene);
    for (const room of scene.rooms) {
      const root = RoomFactory.createRoomStructure(room, { isWireframe: false, showDimensions: false, showReferenceAxes: false }).group;
      try {
        for (const item of room.objects) root.add(FurnitureFactory.createFurnitureMesh(item, false, false));
        expect(new THREE.Box3().setFromObject(root).isEmpty()).toBe(false);
        expect(room.doors).toEqual([]); expect(room.windows).toEqual([]);
        expect(Object.values(room.walls).every(wall => wall.id === undefined)).toBe(true);
      } finally { ThreeResourceDisposer.disposeHierarchy(root); }
    }
    expect(JSON.stringify(scene)).toBe(before);
  });

  it('exports the historical real scene as .lumic 1.1.0 and validates its JSON round trip', () => {
    const result = adaptBackendResult(respuesta(1), createMockProject(), 0);
    const exported = LumicFileService.validateForExport(result, createMockProject());
    expect(exported.canExport).toBe(true);
    expect(exported.artifact?.schemaVersion).toBe('1.1.0');
    const reloaded = validateLumicStructure(JSON.parse(JSON.stringify(exported.artifact)), 'artifact');
    expect(reloaded.errors).toEqual([]);
    expect(reloaded.data?.scenePlan).toEqual(result.scenePlan);
  });

  it('accepts authentic pending-backend diagnostics without fabricating a renderable architecture scene', () => {
    const validation = validateProtocolResponse(pendiente.response);
    expect(validation.valid).toBe(true);
    expect(pendiente.response.status).toBe('failed');
    expect(pendiente.response.result.diagnostics).toHaveLength(10);
    expect(pendiente.response.result.diagnostics.every(item => item.code === 'SPA_INVALID_PROPERTY')).toBe(true);
    expect(pendiente.response.result).not.toHaveProperty('scenePlan');
    const window = pendiente.interpreterSceneBeforePublication.rooms[0].elements[2];
    expect(window.properties.find(property => property.name === 'elevacion')?.value).toBe(0.9);
    expect(window.source.file).toBe('sonda-arquitectonica.lumi');
  });

  it('keeps the real serialization failure for legacy architecture distinct from language diagnostics', () => {
    expect(validateProtocolResponse(pendiente.legacyResponse).valid).toBe(true);
    expect(pendiente.legacyResponse.status).toBe('error');
    expect(pendiente.legacyResponse.error.code).toBe('SERIALIZATION_ERROR');
    expect(pendiente.legacyResponse.error.kind).toBe('infrastructure');
  });
});
