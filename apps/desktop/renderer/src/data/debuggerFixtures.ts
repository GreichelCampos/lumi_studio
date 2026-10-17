import { DebugStep, ScenePlan } from '../types';

/**
 * Empty scene plan fixture
 */
export const createEmptyScenePlan = (): ScenePlan => ({
  version: '1.0.0',
  rooms: [],
  debugInfo: {
    totalEntities: 0,
    collisionCount: 0,
    warningsCount: 0,
    compiledAt: new Date().toISOString(),
  },
});

/**
 * Fixture 1: Normal execution step sequence
 */
export const FIXTURE_NORMAL_STEPS: DebugStep[] = [
  {
    id: 'step-1',
    stepIndex: 1,
    eventType: 'start',
    description: 'Inicio del bloque principal',
    sourceRef: { file: 'principal.lumi', line: 4, column: 1 },
    lineNumber: 4,
    codeLine: 'principal {',
    actionDescription: 'Inicio del bloque principal',
    sceneSnapshot: createEmptyScenePlan(),
  },
  {
    id: 'step-2',
    stepIndex: 2,
    eventType: 'declaration',
    description: 'Declaración: decimal ancho = 5.0',
    sourceRef: { file: 'principal.lumi', line: 5, column: 3 },
    lineNumber: 5,
    codeLine: 'decimal ancho = 5.0>>',
    actionDescription: 'Declaración: decimal ancho = 5.0',
    sceneSnapshot: createEmptyScenePlan(),
  },
  {
    id: 'step-3',
    stepIndex: 3,
    eventType: 'declaration',
    description: 'Declaración: decimal largo = 4.0',
    sourceRef: { file: 'principal.lumi', line: 6, column: 3 },
    lineNumber: 6,
    codeLine: 'decimal largo = 4.0>>',
    actionDescription: 'Declaración: decimal largo = 4.0',
    sceneSnapshot: createEmptyScenePlan(),
  },
  {
    id: 'step-4',
    stepIndex: 4,
    eventType: 'room_create',
    description: 'Habitación "sala" declarada (5.0m × 4.0m × 2.7m)',
    sourceRef: { file: 'principal.lumi', line: 10, column: 3 },
    roomId: 'room-sala-1',
    lineNumber: 10,
    codeLine: 'habitacion sala(ancho, largo, 2.7) {',
    actionDescription: 'Habitación "sala" declarada (5.0m × 4.0m × 2.7m)',
    sceneSnapshot: {
      version: '1.0.0',
      rooms: [
        {
          id: 'room-sala-1',
          name: 'sala',
          dimensions: [5.0, 4.0, 2.7],
          floor: { material: 'madera' },
          walls: {
            north: { color: 'blanco' },
            south: { color: 'gris' },
            east: { color: 'blanco' },
            west: { color: 'blanco' },
          },
          doors: [],
          windows: [],
          objects: [],
          calculatedArea: 20.0,
          calculatedVolume: 54.0,
        },
      ],
    },
  },
  {
    id: 'step-5',
    stepIndex: 5,
    eventType: 'place_object',
    description: 'Colocado "sofa" en [0.0, 0.0, -1.0]',
    sourceRef: { file: 'principal.lumi', line: 20, column: 5 },
    roomId: 'room-sala-1',
    activeObjectId: 'sofa-1',
    lineNumber: 20,
    codeLine: 'colocar sofa en [0.0, 0.0, -1.0]>>',
    actionDescription: 'Colocado "sofa" en [0.0, 0.0, -1.0]',
    sceneSnapshot: {
      version: '1.0.0',
      rooms: [
        {
          id: 'room-sala-1',
          name: 'sala',
          dimensions: [5.0, 4.0, 2.7],
          floor: { material: 'madera' },
          walls: {
            north: { color: 'blanco' },
            south: { color: 'gris' },
            east: { color: 'blanco' },
            west: { color: 'blanco' },
          },
          doors: [],
          windows: [],
          objects: [
            {
              id: 'sofa-1',
              type: 'sofa',
              name: 'sofa',
              position: [0.0, 0.0, -1.0],
              rotation: [0, 0, 0],
              dimensions: [2.0, 0.85, 0.9],
              sourceRef: { file: 'principal.lumi', line: 20, column: 5 },
              roomId: 'room-sala-1',
            },
          ],
          calculatedArea: 20.0,
          calculatedVolume: 54.0,
        },
      ],
    },
  },
  {
    id: 'step-6',
    stepIndex: 6,
    eventType: 'end',
    description: 'Fin de la ejecución del bloque',
    sourceRef: { file: 'principal.lumi', line: 24, column: 1 },
    roomId: 'room-sala-1',
    lineNumber: 24,
    codeLine: '}',
    actionDescription: 'Fin de la ejecución del bloque',
    sceneSnapshot: {
      version: '1.0.0',
      rooms: [
        {
          id: 'room-sala-1',
          name: 'sala',
          dimensions: [5.0, 4.0, 2.7],
          floor: { material: 'madera' },
          walls: {
            north: { color: 'blanco' },
            south: { color: 'gris' },
            east: { color: 'blanco' },
            west: { color: 'blanco' },
          },
          doors: [],
          windows: [],
          objects: [
            {
              id: 'sofa-1',
              type: 'sofa',
              name: 'sofa',
              position: [0.0, 0.0, -1.0],
              rotation: [0, 0, 0],
              dimensions: [2.0, 0.85, 0.9],
              sourceRef: { file: 'principal.lumi', line: 20, column: 5 },
              roomId: 'room-sala-1',
            },
          ],
          calculatedArea: 20.0,
          calculatedVolume: 54.0,
        },
      ],
    },
  },
];

/**
 * Fixture 2: Multi-room switching steps
 */
export const FIXTURE_MULTI_ROOM_STEPS: DebugStep[] = [
  {
    id: 'step-mr-1',
    stepIndex: 1,
    eventType: 'room_create',
    description: 'Creación de habitación "sala"',
    sourceRef: { file: 'principal.lumi', line: 10, column: 3 },
    roomId: 'room-sala-1',
    lineNumber: 10,
    codeLine: 'habitacion sala(5.0, 4.0, 2.7) {',
    actionDescription: 'Creación de habitación "sala"',
    sceneSnapshot: {
      version: '1.0.0',
      rooms: [
        {
          id: 'room-sala-1',
          name: 'sala',
          dimensions: [5.0, 4.0, 2.7],
          floor: { material: 'madera' },
          walls: { north: { color: 'blanco' }, south: { color: 'gris' }, east: { color: 'blanco' }, west: { color: 'blanco' } },
          doors: [],
          windows: [],
          objects: [],
          calculatedArea: 20.0,
          calculatedVolume: 54.0,
        },
      ],
    },
  },
  {
    id: 'step-mr-2',
    stepIndex: 2,
    eventType: 'place_object',
    description: 'Colocado "sofa" en "sala"',
    sourceRef: { file: 'principal.lumi', line: 14, column: 5 },
    roomId: 'room-sala-1',
    activeObjectId: 'sofa-1',
    lineNumber: 14,
    codeLine: 'colocar sofa en [0.0, 0.0, 0.0]>>',
    actionDescription: 'Colocado "sofa" en "sala"',
    sceneSnapshot: {
      version: '1.0.0',
      rooms: [
        {
          id: 'room-sala-1',
          name: 'sala',
          dimensions: [5.0, 4.0, 2.7],
          floor: { material: 'madera' },
          walls: { north: { color: 'blanco' }, south: { color: 'gris' }, east: { color: 'blanco' }, west: { color: 'blanco' } },
          doors: [],
          windows: [],
          objects: [
            {
              id: 'sofa-1',
              type: 'sofa',
              name: 'sofa',
              position: [0.0, 0.0, 0.0],
              rotation: [0, 0, 0],
              dimensions: [2.0, 0.85, 0.9],
              sourceRef: { file: 'principal.lumi', line: 14, column: 5 },
              roomId: 'room-sala-1',
            },
          ],
          calculatedArea: 20.0,
          calculatedVolume: 54.0,
        },
      ],
    },
  },
  {
    id: 'step-mr-3',
    stepIndex: 3,
    eventType: 'room_create',
    description: 'Creación de habitación "dormitorio"',
    sourceRef: { file: 'principal.lumi', line: 20, column: 3 },
    roomId: 'room-dorm-2',
    lineNumber: 20,
    codeLine: 'habitacion dormitorio(4.0, 3.5, 2.7) {',
    actionDescription: 'Creación de habitación "dormitorio"',
    sceneSnapshot: {
      version: '1.0.0',
      rooms: [
        {
          id: 'room-sala-1',
          name: 'sala',
          dimensions: [5.0, 4.0, 2.7],
          floor: { material: 'madera' },
          walls: { north: { color: 'blanco' }, south: { color: 'gris' }, east: { color: 'blanco' }, west: { color: 'blanco' } },
          doors: [],
          windows: [],
          objects: [
            {
              id: 'sofa-1',
              type: 'sofa',
              name: 'sofa',
              position: [0.0, 0.0, 0.0],
              rotation: [0, 0, 0],
              dimensions: [2.0, 0.85, 0.9],
              sourceRef: { file: 'principal.lumi', line: 14, column: 5 },
              roomId: 'room-sala-1',
            },
          ],
          calculatedArea: 20.0,
          calculatedVolume: 54.0,
        },
        {
          id: 'room-dorm-2',
          name: 'dormitorio',
          dimensions: [4.0, 3.5, 2.7],
          floor: { material: 'ceramica' },
          walls: { north: { color: 'azul' }, south: { color: 'blanco' }, east: { color: 'blanco' }, west: { color: 'blanco' } },
          doors: [],
          windows: [],
          objects: [],
          calculatedArea: 14.0,
          calculatedVolume: 37.8,
        },
      ],
    },
  },
  {
    id: 'step-mr-4',
    stepIndex: 4,
    eventType: 'place_object',
    description: 'Colocado "cama" en "dormitorio"',
    sourceRef: { file: 'principal.lumi', line: 24, column: 5 },
    roomId: 'room-dorm-2',
    activeObjectId: 'cama-1',
    lineNumber: 24,
    codeLine: 'colocar cama en [0.0, 0.0, -0.5]>>',
    actionDescription: 'Colocado "cama" en "dormitorio"',
    sceneSnapshot: {
      version: '1.0.0',
      rooms: [
        {
          id: 'room-sala-1',
          name: 'sala',
          dimensions: [5.0, 4.0, 2.7],
          floor: { material: 'madera' },
          walls: { north: { color: 'blanco' }, south: { color: 'gris' }, east: { color: 'blanco' }, west: { color: 'blanco' } },
          doors: [],
          windows: [],
          objects: [
            {
              id: 'sofa-1',
              type: 'sofa',
              name: 'sofa',
              position: [0.0, 0.0, 0.0],
              rotation: [0, 0, 0],
              dimensions: [2.0, 0.85, 0.9],
              sourceRef: { file: 'principal.lumi', line: 14, column: 5 },
              roomId: 'room-sala-1',
            },
          ],
          calculatedArea: 20.0,
          calculatedVolume: 54.0,
        },
        {
          id: 'room-dorm-2',
          name: 'dormitorio',
          dimensions: [4.0, 3.5, 2.7],
          floor: { material: 'ceramica' },
          walls: { north: { color: 'azul' }, south: { color: 'blanco' }, east: { color: 'blanco' }, west: { color: 'blanco' } },
          doors: [],
          windows: [],
          objects: [
            {
              id: 'cama-1',
              type: 'cama',
              name: 'cama',
              position: [0.0, 0.0, -0.5],
              rotation: [0, 0, 0],
              dimensions: [2.0, 0.75, 1.6],
              sourceRef: { file: 'principal.lumi', line: 24, column: 5 },
              roomId: 'room-dorm-2',
            },
          ],
          calculatedArea: 14.0,
          calculatedVolume: 37.8,
        },
      ],
    },
  },
];

/**
 * Fixture 3: Spatial warning step
 */
export const FIXTURE_SPATIAL_WARNING_STEPS: DebugStep[] = [
  {
    id: 'step-warn-1',
    stepIndex: 1,
    eventType: 'place_object',
    description: 'Colocado "mesa" en [0.0, 0.0, 0.0]',
    sourceRef: { file: 'principal.lumi', line: 12, column: 3 },
    roomId: 'room-sala-1',
    activeObjectId: 'mesa-1',
    lineNumber: 12,
    codeLine: 'colocar mesa en [0.0, 0.0, 0.0]>>',
    actionDescription: 'Colocado "mesa" en [0.0, 0.0, 0.0]',
    sceneSnapshot: {
      version: '1.0.0',
      rooms: [
        {
          id: 'room-sala-1',
          name: 'sala',
          dimensions: [4.0, 4.0, 2.7],
          floor: { material: 'madera' },
          walls: { north: { color: 'blanco' }, south: { color: 'gris' }, east: { color: 'blanco' }, west: { color: 'blanco' } },
          doors: [],
          windows: [],
          objects: [
            {
              id: 'mesa-1',
              type: 'mesa',
              name: 'mesa',
              position: [0.0, 0.0, 0.0],
              rotation: [0, 0, 0],
              dimensions: [1.2, 0.5, 0.8],
              roomId: 'room-sala-1',
            },
          ],
          calculatedArea: 16.0,
          calculatedVolume: 43.2,
        },
      ],
    },
  },
  {
    id: 'step-warn-2',
    stepIndex: 2,
    eventType: 'spatial_warning',
    description: 'Superposición: "silla" colisiona con "mesa"',
    sourceRef: { file: 'principal.lumi', line: 13, column: 3 },
    roomId: 'room-sala-1',
    activeObjectId: 'silla-1',
    assistantMessage: 'Este objeto necesita revisión.',
    lineNumber: 13,
    codeLine: 'colocar silla en [0.1, 0.0, 0.1]>>',
    actionDescription: 'Superposición: "silla" colisiona con "mesa"',
    sceneSnapshot: {
      version: '1.0.0',
      rooms: [
        {
          id: 'room-sala-1',
          name: 'sala',
          dimensions: [4.0, 4.0, 2.7],
          floor: { material: 'madera' },
          walls: { north: { color: 'blanco' }, south: { color: 'gris' }, east: { color: 'blanco' }, west: { color: 'blanco' } },
          doors: [],
          windows: [],
          objects: [
            {
              id: 'mesa-1',
              type: 'mesa',
              name: 'mesa',
              position: [0.0, 0.0, 0.0],
              rotation: [0, 0, 0],
              dimensions: [1.2, 0.5, 0.8],
              hasCollision: true,
              roomId: 'room-sala-1',
            },
            {
              id: 'silla-1',
              type: 'silla',
              name: 'silla',
              position: [0.1, 0.0, 0.1],
              rotation: [0, 0, 0],
              dimensions: [0.55, 0.85, 0.55],
              hasCollision: true,
              roomId: 'room-sala-1',
            },
          ],
          calculatedArea: 16.0,
          calculatedVolume: 43.2,
        },
      ],
    },
  },
];

/**
 * Fixture 4: Spatial error step (Out of bounds)
 */
export const FIXTURE_SPATIAL_ERROR_STEPS: DebugStep[] = [
  {
    id: 'step-err-1',
    stepIndex: 1,
    eventType: 'spatial_error',
    description: 'El objeto "sofa" excede los límites físicos de la habitación',
    sourceRef: { file: 'principal.lumi', line: 15, column: 3 },
    roomId: 'room-sala-1',
    activeObjectId: 'sofa-out-1',
    assistantMessage: 'Aquí aparece el problema espacial.',
    lineNumber: 15,
    codeLine: 'colocar sofa en [3.5, 0.0, 0.0]>>',
    actionDescription: 'El objeto "sofa" excede los límites físicos de la habitación',
    sceneSnapshot: {
      version: '1.0.0',
      rooms: [
        {
          id: 'room-sala-1',
          name: 'sala',
          dimensions: [4.0, 4.0, 2.7],
          floor: { material: 'madera' },
          walls: { north: { color: 'blanco' }, south: { color: 'gris' }, east: { color: 'blanco' }, west: { color: 'blanco' } },
          doors: [],
          windows: [],
          objects: [
            {
              id: 'sofa-out-1',
              type: 'sofa',
              name: 'sofa',
              position: [3.5, 0.0, 0.0],
              rotation: [0, 0, 0],
              dimensions: [2.0, 0.85, 0.9],
              isOutOfBounds: true,
              roomId: 'room-sala-1',
            },
          ],
          calculatedArea: 16.0,
          calculatedVolume: 43.2,
        },
      ],
    },
  },
];

/**
 * Fixture 5: Pure code step with no 3D object
 */
export const FIXTURE_NON_SPATIAL_STEP: DebugStep = {
  id: 'step-var-1',
  stepIndex: 1,
  eventType: 'declaration',
  description: 'Declaración de variable: entero cantidad = 4',
  sourceRef: { file: 'principal.lumi', line: 7, column: 3 },
  lineNumber: 7,
  codeLine: 'entero cantidad = 4>>',
  actionDescription: 'Declaración de variable: entero cantidad = 4',
  sceneSnapshot: createEmptyScenePlan(),
};
