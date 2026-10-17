import { ScenePlan, RoomModel, SpatialObject, DoorModel, WindowModel } from '../types';

/**
 * Fixture 1: Una habitación vacía sin objetos ni muebles
 */
export const fixtureEmptyRoom: ScenePlan = {
  version: '1.0.0',
  rooms: [
    {
      id: 'hab_estudio_vacio',
      name: 'estudio',
      dimensions: [4.0, 3.0, 2.6], // [ancho (X), largo (Z), altura (Y)]
      floor: {
        material: 'madera_roble',
        color: '#92400e',
      },
      walls: {
        north: { color: 'blanco' },
        south: { color: 'gris' },
        east: { color: 'blanco' },
        west: { color: 'gris' },
      },
      doors: [],
      windows: [],
      objects: [],
      calculatedArea: 12.0,
      calculatedVolume: 31.2,
      originOffset: [0, 0, 0],
    },
  ],
  debugInfo: {
    totalEntities: 0,
    collisionCount: 0,
    warningsCount: 0,
    compiledAt: new Date().toISOString(),
  },
};

/**
 * Fixture 2: Una sala con varios muebles (sofá, mesa, planta)
 */
export const fixtureLivingRoom: ScenePlan = {
  version: '1.0.0',
  rooms: [
    {
      id: 'hab_sala_completa',
      name: 'sala',
      dimensions: [5.0, 4.0, 2.7],
      floor: {
        material: 'parquet',
        color: '#78350f',
      },
      walls: {
        north: { color: 'blanco' },
        south: { color: 'gris' },
        east: { color: 'blanco' },
        west: { color: 'blanco' },
      },
      doors: [
        {
          id: 'puerta_sala_norte',
          wall: 'norte',
          position: 1.2,
          width: 0.9,
          height: 2.1,
          sourceRef: { file: 'principal.lumi', line: 33, column: 5 },
        },
      ],
      windows: [
        {
          id: 'ventana_sala_sur',
          wall: 'sur',
          position: -0.8,
          width: 1.6,
          height: 1.2,
          sourceRef: { file: 'principal.lumi', line: 39, column: 5 },
        },
      ],
      objects: [
        {
          id: 'sofa_1',
          name: 'sofa_principal',
          type: 'sofa',
          position: [0.0, 0.0, -0.9],
          rotation: [0, 0, 0],
          dimensions: [2.0, 0.85, 0.9],
          color: '#64748b',
          material: 'tela',
          sourceRef: { file: 'principal.lumi', line: 45, column: 5 },
        },
        {
          id: 'mesa_1',
          name: 'mesa_centro',
          type: 'mesa',
          position: [0.0, 0.0, 0.6],
          rotation: [0, 0, 0],
          dimensions: [1.2, 0.48, 0.8],
          color: '#e2e8f0',
          material: 'vidrio_metal',
          sourceRef: { file: 'principal.lumi', line: 46, column: 5 },
        },
        {
          id: 'planta_1',
          name: 'planta_decorativa',
          type: 'planta',
          position: [1.8, 0.0, 1.3],
          rotation: [0, 15, 0],
          dimensions: [0.6, 1.2, 0.6],
          color: '#22c55e',
          material: 'organico',
          sourceRef: { file: 'principal.lumi', line: 49, column: 7 },
        },
      ],
      calculatedArea: 20.0,
      calculatedVolume: 54.0,
      originOffset: [0, 0, 0],
    },
  ],
  debugInfo: {
    totalEntities: 3,
    collisionCount: 0,
    warningsCount: 0,
    compiledAt: new Date().toISOString(),
  },
};

/**
 * Fixture 3: Dos habitaciones independientes (sala_principal y comedor)
 */
export const fixtureTwoRooms: ScenePlan = {
  version: '1.0.0',
  rooms: [
    {
      id: 'hab_sala_multi',
      name: 'sala_principal',
      dimensions: [5.5, 4.2, 2.8],
      floor: {
        material: 'madera_roble',
        color: '#92400e',
      },
      walls: {
        north: { color: 'azul' },
        south: { color: 'blanco' },
        east: { color: 'blanco' },
        west: { color: 'gris' },
      },
      doors: [
        {
          id: 'puerta_sala_multi',
          wall: 'norte',
          position: 0.0,
          width: 0.9,
          height: 2.1,
          sourceRef: { file: 'principal.lumi', line: 12 },
        },
      ],
      windows: [
        {
          id: 'ventana_sala_multi',
          wall: 'sur',
          position: 0.0,
          width: 2.0,
          height: 1.4,
          sourceRef: { file: 'principal.lumi', line: 18 },
        },
      ],
      objects: [
        {
          id: 'sofa_multi_1',
          name: 'sofa_sala',
          type: 'sofa',
          position: [0.0, 0.0, -1.0],
          rotation: [0, 0, 0],
          dimensions: [2.0, 0.85, 0.9],
          color: '#334155',
          material: 'cuero',
          sourceRef: { file: 'principal.lumi', line: 24 },
        },
        {
          id: 'mesa_multi_1',
          name: 'mesa_sala',
          type: 'mesa',
          position: [0.0, 0.0, 0.5],
          rotation: [0, 0, 0],
          dimensions: [1.2, 0.48, 0.8],
          color: '#f8fafc',
          material: 'marmol',
          sourceRef: { file: 'principal.lumi', line: 25 },
        },
      ],
      calculatedArea: 23.1,
      calculatedVolume: 64.68,
      originOffset: [0, 0, 0],
    },
    {
      id: 'hab_comedor_multi',
      name: 'comedor',
      dimensions: [4.0, 3.5, 2.6],
      floor: {
        material: 'ceramica',
        color: '#cbd5e1',
      },
      walls: {
        north: { color: 'blanco' },
        south: { color: 'blanco' },
        east: { color: 'gris' },
        west: { color: 'blanco' },
      },
      doors: [
        {
          id: 'puerta_comedor_oeste',
          wall: 'oeste',
          position: 0.0,
          width: 0.85,
          height: 2.0,
          sourceRef: { file: 'habitaciones.lumi', line: 15 },
        },
      ],
      windows: [
        {
          id: 'ventana_comedor_este',
          wall: 'este',
          position: 0.5,
          width: 1.4,
          height: 1.2,
          sourceRef: { file: 'habitaciones.lumi', line: 22 },
        },
      ],
      objects: [
        {
          id: 'mesa_comedor_1',
          name: 'mesa_comedor_6p',
          type: 'mesa',
          position: [0.0, 0.0, 0.0],
          rotation: [0, 90, 0],
          dimensions: [1.6, 0.75, 0.9],
          color: '#78350f',
          material: 'madera',
          sourceRef: { file: 'habitaciones.lumi', line: 28 },
        },
        {
          id: 'silla_c1',
          name: 'silla_1',
          type: 'silla',
          position: [-0.6, 0.0, -0.6],
          rotation: [0, 0, 0],
          dimensions: [0.5, 0.85, 0.5],
          color: '#38bdf8',
          sourceRef: { file: 'habitaciones.lumi', line: 30 },
        },
        {
          id: 'silla_c2',
          name: 'silla_2',
          type: 'silla',
          position: [0.6, 0.0, -0.6],
          rotation: [0, 0, 0],
          dimensions: [0.5, 0.85, 0.5],
          color: '#38bdf8',
          sourceRef: { file: 'habitaciones.lumi', line: 31 },
        },
        {
          id: 'silla_c3',
          name: 'silla_3',
          type: 'silla',
          position: [-0.6, 0.0, 0.6],
          rotation: [0, 180, 0],
          dimensions: [0.5, 0.85, 0.5],
          color: '#38bdf8',
          sourceRef: { file: 'habitaciones.lumi', line: 32 },
        },
        {
          id: 'silla_c4',
          name: 'silla_4',
          type: 'silla',
          position: [0.6, 0.0, 0.6],
          rotation: [0, 180, 0],
          dimensions: [0.5, 0.85, 0.5],
          color: '#38bdf8',
          sourceRef: { file: 'habitaciones.lumi', line: 33 },
        },
      ],
      calculatedArea: 14.0,
      calculatedVolume: 36.4,
      originOffset: [0, 0, 0],
    },
  ],
  debugInfo: {
    totalEntities: 7,
    collisionCount: 0,
    warningsCount: 0,
    compiledAt: new Date().toISOString(),
  },
};

/**
 * Fixture 4: Un objeto con diagnóstico espacial (fuera de límites o colisión)
 */
export const fixtureSpatialErrorRoom: ScenePlan = {
  version: '1.0.0',
  rooms: [
    {
      id: 'hab_dormitorio_error',
      name: 'dormitorio',
      dimensions: [4.0, 3.5, 2.6],
      floor: {
        material: 'madera',
        color: '#92400e',
      },
      walls: {
        north: { color: 'azul' },
        south: { color: 'blanco' },
        east: { color: 'blanco' },
        west: { color: 'blanco' },
      },
      doors: [
        {
          id: 'puerta_dorm_norte',
          wall: 'norte',
          position: 1.0,
          width: 0.85,
          height: 2.1,
          sourceRef: { file: 'principal.lumi', line: 12 },
        },
      ],
      windows: [],
      objects: [
        {
          id: 'cama_error_1',
          name: 'cama_king',
          type: 'cama',
          position: [1.8, 0.0, -0.5], // Colocada muy cerca del límite este (X=2.0)
          rotation: [0, 0, 0],
          dimensions: [2.0, 0.75, 1.8],
          color: '#38bdf8',
          isOutOfBounds: true,
          sourceRef: { file: 'principal.lumi', line: 28, column: 5 },
        },
        {
          id: 'escritorio_error_1',
          name: 'escritorio_estudio',
          type: 'escritorio',
          position: [-1.2, 0.0, 0.8],
          rotation: [0, 90, 0],
          dimensions: [1.4, 0.75, 0.7],
          color: '#f1f5f9',
          sourceRef: { file: 'principal.lumi', line: 34, column: 5 },
        },
      ],
      calculatedArea: 14.0,
      calculatedVolume: 36.4,
      originOffset: [0, 0, 0],
    },
  ],
  debugInfo: {
    totalEntities: 2,
    collisionCount: 0,
    warningsCount: 1,
    compiledAt: new Date().toISOString(),
  },
};

/**
 * Fixture 5: Puerta y ventana con dimensiones y posiciones completas
 */
export const fixtureDoorsAndWindowsRoom: ScenePlan = {
  version: '1.0.0',
  rooms: [
    {
      id: 'hab_despacho_aberturas',
      name: 'despacho',
      dimensions: [4.5, 3.8, 2.7],
      floor: {
        material: 'concreto',
        color: '#64748b',
      },
      walls: {
        north: { color: 'blanco' },
        south: { color: 'gris' },
        east: { color: 'blanco' },
        west: { color: 'gris' },
      },
      doors: [
        {
          id: 'puerta_acceso_norte',
          wall: 'norte',
          position: -1.0,
          width: 0.9,
          height: 2.1,
          sourceRef: { file: 'principal.lumi', line: 15 },
        },
      ],
      windows: [
        {
          id: 'ventanal_panoramico_sur',
          wall: 'sur',
          position: 0.0,
          width: 2.4,
          height: 1.5,
          sourceRef: { file: 'principal.lumi', line: 22 },
        },
        {
          id: 'ventana_lateral_oeste',
          wall: 'oeste',
          position: 0.4,
          width: 1.2,
          height: 1.2,
          sourceRef: { file: 'principal.lumi', line: 28 },
        },
      ],
      objects: [
        {
          id: 'escritorio_despacho',
          name: 'escritorio_ejecutivo',
          type: 'escritorio',
          position: [0.0, 0.0, 0.2],
          rotation: [0, 0, 0],
          dimensions: [1.6, 0.75, 0.8],
          color: '#334155',
          material: 'nogal',
          sourceRef: { file: 'principal.lumi', line: 36 },
        },
        {
          id: 'silla_despacho',
          name: 'silla_ergonomica',
          type: 'silla',
          position: [0.0, 0.0, -0.4],
          rotation: [0, 0, 0],
          dimensions: [0.6, 0.95, 0.6],
          color: '#0284c7',
          sourceRef: { file: 'principal.lumi', line: 40 },
        },
        {
          id: 'lampara_pie',
          name: 'lampara_lectura',
          type: 'lampara',
          position: [1.6, 0.0, 0.2],
          rotation: [0, 0, 0],
          dimensions: [0.45, 1.5, 0.45],
          color: '#fef08a',
          sourceRef: { file: 'principal.lumi', line: 44 },
        },
      ],
      calculatedArea: 17.1,
      calculatedVolume: 46.17,
      originOffset: [0, 0, 0],
    },
  ],
  debugInfo: {
    totalEntities: 3,
    collisionCount: 0,
    warningsCount: 0,
    compiledAt: new Date().toISOString(),
  },
};
