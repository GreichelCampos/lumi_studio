import {
  LumiProject,
  LumiFile,
  ScenePlan,
  RoomModel,
  PlacedSpatialObject,
  DoorModel,
  WindowModel,
  DiagnosticItem,
  DebugStep,
} from '../../types';

export const createMockFile = (overrides?: Partial<LumiFile>): LumiFile => ({
  id: 'file-principal-test',
  name: 'principal.lumi',
  path: 'ProyectoTest/principal.lumi',
  isEntry: true,
  content: `principal {\n  habitacion sala(5.0, 4.0, 2.7) {\n    colocar mesa en [0.0, 0.0, 0.0]>>\n  }\n  visualizar3D(sala)>>\n}`,
  ...overrides,
});

export const createMockProject = (overrides?: Partial<LumiProject>): LumiProject => {
  const defaultFile = createMockFile();
  return {
    id: 'proj-test-123',
    name: 'ProyectoTest',
    description: 'Proyecto de prueba automatizada',
    location: 'local/espacios',
    files: [defaultFile],
    activeFileId: defaultFile.id,
    entryFileId: defaultFile.id,
    openTabIds: [defaultFile.id],
    createdAt: '2026-08-24T12:00:00.000Z',
    updatedAt: '2026-08-24T12:00:00.000Z',
    ...overrides,
  };
};

export const createMockSpatialObject = (overrides?: Partial<PlacedSpatialObject>): PlacedSpatialObject => ({
  id: 'obj-mesa-1',
  name: 'mesa',
  type: 'mesa',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  dimensions: [1.2, 0.75, 0.8],
  color: 'madera',
  material: 'roble',
  sourceRef: { file: 'principal.lumi', line: 4, column: 5 },
  hasCollision: false,
  isOutOfBounds: false,
  roomId: 'sala-1',
  ...overrides,
});

export const createMockDoor = (overrides?: Partial<DoorModel>): DoorModel => ({
  id: 'door-norte-1',
  wall: 'norte',
  position: 0.5,
  width: 0.9,
  height: 2.1,
  sourceRef: { file: 'principal.lumi', line: 10, column: 5 },
  ...overrides,
});

export const createMockWindow = (overrides?: Partial<WindowModel>): WindowModel => ({
  id: 'win-sur-1',
  wall: 'sur',
  position: 0.0,
  width: 1.5,
  height: 1.2,
  sourceRef: { file: 'principal.lumi', line: 15, column: 5 },
  ...overrides,
});

export const createMockRoom = (overrides?: Partial<RoomModel>): RoomModel => ({
  id: 'sala-1',
  name: 'sala',
  dimensions: [5.0, 4.0, 2.7],
  calculatedArea: 20.0,
  calculatedVolume: 54.0,
  floor: { material: 'madera', color: '#8B5A2B' },
  walls: {
    north: { color: '#E0E0E0' },
    south: { color: '#E0E0E0' },
    east: { color: '#E0E0E0' },
    west: { color: '#E0E0E0' },
  },
  doors: [createMockDoor()],
  windows: [createMockWindow()],
  objects: [createMockSpatialObject()],
  ...overrides,
});

export const createMockScenePlan = (overrides?: Partial<ScenePlan>): ScenePlan => ({
  version: '1.0.0',
  rooms: [createMockRoom()],
  debugInfo: {
    totalEntities: 1,
    collisionCount: 0,
    warningsCount: 0,
    compiledAt: '2026-08-24T12:00:00.000Z',
  },
  ...overrides,
});

export const createMockDiagnostic = (overrides?: Partial<DiagnosticItem>): DiagnosticItem => ({
  id: 'diag-test-1',
  code: 'LUMI-S103',
  severity: 'error',
  category: 'sintactico',
  blocking: true,
  file: 'principal.lumi',
  line: 12,
  column: 4,
  description: 'Falta el terminador ">>"',
  solution: 'Agregue ">>" al final',
  ...overrides,
});

export const createMockDebugSteps = (): DebugStep[] => [
  {
    id: 'step-0',
    stepIndex: 0,
    eventType: 'room_create',
    description: 'Se declara habitacion sala con dimensiones 5.0 x 4.0 x 2.7m',
    sourceRef: { file: 'principal.lumi', line: 2, column: 3 },
    roomId: 'sala-1',
    lineNumber: 2,
    codeLine: 'habitacion sala(5.0, 4.0, 2.7) {',
    actionDescription: 'Creación de habitación sala',
    assistantMessage: 'Creando la habitación base sala.',
    sceneSnapshot: createMockScenePlan({ rooms: [createMockRoom({ objects: [] })] }),
  },
  {
    id: 'step-1',
    stepIndex: 1,
    eventType: 'place_object',
    description: 'Se ubica mesa en coordenadas [0.0, 0.0, 0.0]',
    sourceRef: { file: 'principal.lumi', line: 3, column: 5 },
    activeObjectId: 'obj-mesa-1',
    lineNumber: 3,
    codeLine: 'objeto mesa[0.0, 0.0, 0.0] >>',
    actionDescription: 'Colocación de mueble mesa',
    assistantMessage: 'Colocando mesa.',
    sceneSnapshot: createMockScenePlan(),
  },
  {
    id: 'step-2',
    stepIndex: 2,
    eventType: 'end',
    description: 'Escena completada',
    sourceRef: { file: 'principal.lumi', line: 5, column: 1 },
    lineNumber: 5,
    codeLine: '}',
    actionDescription: 'Fin de compilación',
    sceneSnapshot: createMockScenePlan(),
  },
];
