import { describe, it, expect } from 'vitest';
import { MockCompilerService } from '../../../services/compiler/MockCompilerService';
import { createMockProject, createMockFile } from '../../fixtures/testFixtures';

describe('CompileResult Contracts (Regla de Severidad vs Bloqueo)', () => {
  const compiler = new MockCompilerService();

  it('debe cumplir la regla estricta: severity === "error" con blocking === false permite la generación de ScenePlan 3D', async () => {
    // Código con violación física de límites (diagnóstico de severidad 'error', pero no bloqueante a nivel sintáctico/AST)
    const codeWithSpatialError = `principal {
  habitacion dormitorio(4.0, 4.0, 2.5) {
    colocar cama en [3.0, 0.0, 0.0]>>
  }
  visualizar3D(dormitorio)>>
}`;

    const project = createMockProject({
      files: [createMockFile({ content: codeWithSpatialError, isEntry: true })],
    });

    const result = await compiler.compile(project);

    const spatialErrorDiag = result.diagnostics.find(
      (d) => d.category === 'espacial' && d.severity === 'error'
    );
    expect(spatialErrorDiag).toBeDefined();
    expect(spatialErrorDiag?.severity).toBe('error');

    // 2. Verificar que blocking sea FALSE a pesar de ser 'error'
    expect(spatialErrorDiag?.blocking).toBe(false);

    // 3. Verificar que el resultado sea considerado exitoso para la escena 3D y scenePlan no sea nulo
    expect(result.success).toBe(true);
    expect(result.scenePlan).not.toBeNull();
    expect(result.status).toBe('completed_with_spatial_issues');

    // 4. El objeto problemático debe estar presente en el ScenePlan con los metadatos necesarios
    const room = result.scenePlan?.rooms[0];
    expect(room?.objects.length).toBe(1);
    expect(room?.objects[0].isOutOfBounds).toBe(true);
    expect(room?.objects[0].hasError).toBe(true);
  });

  it('debe bloquear la generación del ScenePlan solo si existe al menos un diagnóstico con blocking === true', async () => {
    const codeWithBlockingError = `principal {
  habitacion sala(5.0, 4.0, 2.7) {
    colocar mesa en [0.0, 0.0, 0.0]
  }
  visualizar3D(sala)>>
}`;

    const project = createMockProject({
      files: [createMockFile({ content: codeWithBlockingError, isEntry: true })],
    });

    const result = await compiler.compile(project);

    const blockingDiag = result.diagnostics.find((d) => d.blocking === true);
    expect(blockingDiag).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.status).toBe('blocked');
    expect(result.scenePlan).toBeNull();
  });
});
