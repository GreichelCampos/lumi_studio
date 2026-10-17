import { describe, it, expect } from 'vitest';
import { MockScenePlanFactory } from '../../../services/compiler/MockScenePlanFactory';
import { createMockRoom, createMockSpatialObject, createMockDiagnostic } from '../../fixtures/testFixtures';
import { DiagnosticItem } from '../../../types';

describe('MockScenePlanFactory', () => {
  it('debe generar un snapshot de escena con conteos correctos de entidades', () => {
    const room1 = createMockRoom({
      objects: [
        createMockSpatialObject({ id: 'obj-1', hasCollision: true }),
        createMockSpatialObject({ id: 'obj-2', hasCollision: false }),
      ],
    });

    const diagnostics: DiagnosticItem[] = [
      createMockDiagnostic({
        id: 'd-1',
        code: 'LUMI-W301',
        severity: 'warning',
        category: 'espacial',
        blocking: false,
        file: 'principal.lumi',
        line: 4,
        description: 'Test warning',
      }),
    ];

    const snapshot = MockScenePlanFactory.createSceneSnapshot([room1], diagnostics);

    expect(snapshot.rooms).toHaveLength(1);
    expect(snapshot.debugInfo.totalEntities).toBe(2);
    expect(snapshot.debugInfo.collisionCount).toBe(1);
    expect(snapshot.debugInfo.warningsCount).toBe(1);
  });

  it('debe detectar objetos fuera de los límites de la habitación al validar', () => {
    const room = createMockRoom({
      dimensions: [4.0, 4.0, 2.7], // Room half width is 2.0, half length is 2.0
      objects: [],
    });

    // Object placed at X=3.0, which exceeds room half width of 2.0
    const outOfBoundsObj = createMockSpatialObject({
      id: 'mesa-fuera',
      name: 'mesa',
      position: [3.0, 0.0, 0.0],
      dimensions: [1.0, 0.8, 1.0],
    });

    const diagnostics: DiagnosticItem[] = [];
    MockScenePlanFactory.validateSpatialPlacements(
      outOfBoundsObj,
      room,
      'principal.lumi',
      8,
      'comp-test',
      diagnostics
    );

    expect(outOfBoundsObj.isOutOfBounds).toBe(true);
    expect(outOfBoundsObj.hasError).toBe(true);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0].code).toBe('LUMI-W301');
  });
});
