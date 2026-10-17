import { describe, it, expect } from 'vitest';
import { MockCompilerService } from '../../../services/compiler/MockCompilerService';
import { createMockProject, createMockFile } from '../../fixtures/testFixtures';

describe('MockCompilerService', () => {
  const compiler = new MockCompilerService();

  it('debe compilar exitosamente un programa válido y generar ScenePlan', async () => {
    const validContent = `principal {
  habitacion sala(6.0, 5.0, 2.8) {
    piso material "madera">>
    puerta en norte {
      ancho = 0.90>>
      alto = 2.10>>
      posicion = 1.0>>
    }
    colocar mesa en [0.0, 0.0, 0.0]>>
  }
  visualizar3D(sala)>>
}`;

    const project = createMockProject({
      files: [createMockFile({ content: validContent, isEntry: true })],
    });

    const result = await compiler.compile(project);

    expect(result.success).toBe(true);
    expect(result.status).toBe('completed');
    expect(result.scenePlan).not.toBeNull();
    expect(result.scenePlan?.rooms.length).toBe(1);
    expect(result.scenePlan?.rooms[0].objects.length).toBe(1);
    expect(result.diagnostics.some((d) => d.blocking)).toBe(false);
  });

  it('debe bloquear la compilación ante error sintáctico (ej: falta de ">>")', async () => {
    const syntaxErrorContent = `principal {
  habitacion sala(5.0, 4.0, 2.7) {
    colocar mesa en [0.0, 0.0, 0.0]
  }
  visualizar3D(sala)>>
}`;

    const project = createMockProject({
      files: [createMockFile({ content: syntaxErrorContent, isEntry: true })],
    });

    const result = await compiler.compile(project);

    expect(result.success).toBe(false);
    expect(result.status).toBe('blocked');
    expect(result.scenePlan).toBeNull();
    expect(result.diagnostics.length).toBeGreaterThan(0);
    const syntaxDiag = result.diagnostics.find((d) => d.category === 'sintactico' && d.blocking);
    expect(syntaxDiag).toBeDefined();
    expect(syntaxDiag?.code).toBe('LUMI-S103');
    expect(syntaxDiag?.blocking).toBe(true);
  });

  it('debe bloquear la compilación ante llaves desbalanceadas', async () => {
    const unclosedBraceContent = `principal {
  habitacion sala(5.0, 4.0, 2.7) {
    colocar mesa en [0.0, 0.0, 0.0]>>
  visualizar3D(sala)>>
`;

    const project = createMockProject({
      files: [createMockFile({ content: unclosedBraceContent, isEntry: true })],
    });

    const result = await compiler.compile(project);

    expect(result.success).toBe(false);
    expect(result.status).toBe('blocked');
    expect(result.scenePlan).toBeNull();
    const braceDiag = result.diagnostics.find((d) => d.code === 'LUMI-S102');
    expect(braceDiag).toBeDefined();
    expect(braceDiag?.blocking).toBe(true);
  });

  it('debe detectar objeto fuera de límites con LUMI-W301, sin bloquear la generación de la escena 3D', async () => {
    // Habitación de 4.0 de ancho (límites X entre -2.0 y +2.0), mueble colocado en X = 3.5
    const outOfBoundsContent = `principal {
  habitacion sala(4.0, 4.0, 2.7) {
    colocar mesa en [3.5, 0.0, 0.0]>>
  }
  visualizar3D(sala)>>
}`;

    const project = createMockProject({
      files: [createMockFile({ content: outOfBoundsContent, isEntry: true })],
    });

    const result = await compiler.compile(project);

    expect(result.success).toBe(true);
    expect(result.status).toBe('completed_with_spatial_issues');
    expect(result.scenePlan).not.toBeNull();

    const oobDiag = result.diagnostics.find((d) => d.code === 'LUMI-W301');
    expect(oobDiag).toBeDefined();
    expect(oobDiag?.category).toBe('espacial');
    expect(oobDiag?.severity).toBe('error');
    expect(oobDiag?.blocking).toBe(false);

    // El objeto se conserva en la escena con la bandera isOutOfBounds
    const room = result.scenePlan?.rooms[0];
    expect(room?.objects.length).toBe(1);
    expect(room?.objects[0].isOutOfBounds).toBe(true);
    expect(room?.objects[0].hasError).toBe(true);
  });

  it('debe detectar colisiones entre objetos con LUMI-W302 (warning no bloqueante)', async () => {
    // Dos objetos colocados exactamente en la misma posición [0.0, 0.0, 0.0]
    const collisionContent = `principal {
  habitacion sala(6.0, 6.0, 2.7) {
    colocar mesa en [0.0, 0.0, 0.0]>>
    colocar sofa en [0.0, 0.0, 0.0]>>
  }
  visualizar3D(sala)>>
}`;

    const project = createMockProject({
      files: [createMockFile({ content: collisionContent, isEntry: true })],
    });

    const result = await compiler.compile(project);

    expect(result.success).toBe(true);
    expect(result.status).toBe('completed_with_spatial_issues');
    expect(result.scenePlan).not.toBeNull();

    const colDiag = result.diagnostics.find((d) => d.code === 'LUMI-W302');
    expect(colDiag).toBeDefined();
    expect(colDiag?.category).toBe('espacial');
    expect(colDiag?.severity).toBe('warning');
    expect(colDiag?.blocking).toBe(false);

    const room = result.scenePlan?.rooms[0];
    expect(room?.objects.every((o) => o.hasCollision)).toBe(true);
  });

  it('debe detectar obstrucción de puerta con LUMI-W303 (warning no bloqueante)', async () => {
    // Puerta en muro norte (Z = -2.5 en sala de largo 5.0), objeto colocado pegado a la puerta en Z = -2.4, X = 0.5
    const doorBlockContent = `principal {
  habitacion sala(5.0, 5.0, 2.7) {
    puerta en norte {
      ancho = 0.90>>
      alto = 2.10>>
      posicion = 0.5>>
    }
    colocar armario en [0.5, 0.0, -2.3]>>
  }
  visualizar3D(sala)>>
}`;

    const project = createMockProject({
      files: [createMockFile({ content: doorBlockContent, isEntry: true })],
    });

    const result = await compiler.compile(project);

    expect(result.success).toBe(true);
    expect(result.scenePlan).not.toBeNull();

    const doorDiag = result.diagnostics.find((d) => d.code === 'LUMI-W303');
    expect(doorDiag).toBeDefined();
    expect(doorDiag?.category).toBe('espacial');
    expect(doorDiag?.blocking).toBe(false);
  });

  it('debe bloquear la compilación ante dimensiones de habitación inválidas (<= 0m)', async () => {
    const invalidDimContent = `principal {
  habitacion sala(-5.0, 4.0, 2.7) {
    colocar mesa en [0.0, 0.0, 0.0]>>
  }
  visualizar3D(sala)>>
}`;

    const project = createMockProject({
      files: [createMockFile({ content: invalidDimContent, isEntry: true })],
    });

    const result = await compiler.compile(project);

    expect(result.success).toBe(false);
    expect(result.status).toBe('blocked');
    expect(result.scenePlan).toBeNull();

    const dimDiag = result.diagnostics.find((d) => d.code === 'LUMI-S201');
    expect(dimDiag).toBeDefined();
    expect(dimDiag?.blocking).toBe(true);
  });

  it('debe bloquear la compilación ante importación de módulo inexistente', async () => {
    const importErrorContent = `importar "modulo_fantasma.lumi">>
principal {
  habitacion sala(5.0, 4.0, 2.7) {
  }
  visualizar3D(sala)>>
}`;

    const project = createMockProject({
      files: [createMockFile({ content: importErrorContent, isEntry: true })],
    });

    const result = await compiler.compile(project);

    expect(result.success).toBe(false);
    expect(result.status).toBe('blocked');
    expect(result.scenePlan).toBeNull();

    const importDiag = result.diagnostics.find((d) => d.code === 'LUMI-E401');
    expect(importDiag).toBeDefined();
    expect(importDiag?.blocking).toBe(true);
  });
});
