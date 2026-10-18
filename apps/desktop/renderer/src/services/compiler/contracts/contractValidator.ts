import {
  CompileResult,
  ScenePlan,
  RoomModel,
  SpatialObject,
  DoorModel,
  WindowModel,
  DiagnosticItem,
  DebugStep,
  DiagnosticSeverity,
  DiagnosticCategory,
  DebugEventType,
  LumiCompileRequest,
  LumiCompiledArtifact,
  ContractValidationError,
  ContractValidationResult,
  LUMI_PROTOCOL_VERSION,
  LUMI_SUPPORTED_MAJOR_VERSIONS,
} from '../../../types';
import { validateLumicStructure } from './lumicStructure';

/**
 * Comprueba si una versión semántica es compatible con las versiones mayores soportadas.
 */
export function isVersionCompatible(version: string | undefined): boolean {
  if (!version || typeof version !== 'string') return false;
  const match = version.match(/^(\d+)/);
  if (!match) return false;
  const major = parseInt(match[1], 10);
  return LUMI_SUPPORTED_MAJOR_VERSIONS.includes(major);
}

/**
 * Validador de tuplas 3D numéricas de coordenadas o dimensiones.
 */
function isValid3DTuple(val: unknown): val is [number, number, number] {
  return (
    Array.isArray(val) &&
    val.length === 3 &&
    val.every((item) => typeof item === 'number' && Number.isFinite(item))
  );
}

/**
 * Valida un objeto DiagnosticItem individual.
 */
export function validateDiagnosticItem(
  raw: unknown,
  pathPrefix = 'diagnostic'
): ContractValidationResult<DiagnosticItem> {
  const errors: ContractValidationError[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return {
      isValid: false,
      data: null,
      errors: [
        {
          path: pathPrefix,
          code: 'INVALID_FIELD_TYPE',
          message: `Se esperaba un objeto para el diagnóstico en ${pathPrefix}.`,
          receivedValue: raw,
          expected: 'object',
        },
      ],
      warnings,
    };
  }

  const d = raw as Record<string, unknown>;

  if (typeof d.id !== 'string' || !d.id.trim()) {
    errors.push({
      path: `${pathPrefix}.id`,
      code: 'MISSING_REQUIRED_FIELD',
      message: 'El identificador (id) del diagnóstico es obligatorio.',
      receivedValue: d.id,
      expected: 'string',
    });
  }

  if (typeof d.code !== 'string' || !d.code.trim()) {
    errors.push({
      path: `${pathPrefix}.code`,
      code: 'MISSING_REQUIRED_FIELD',
      message: 'El código del diagnóstico (code) es obligatorio (ej. LUMI-E101).',
      receivedValue: d.code,
      expected: 'string',
    });
  }

  const validSeverities: DiagnosticSeverity[] = ['error', 'warning', 'info', 'unspecified'];
  if (!validSeverities.includes(d.severity as DiagnosticSeverity)) {
    errors.push({
      path: `${pathPrefix}.severity`,
      code: 'INVALID_FIELD_TYPE',
      message: `Severidad inválida: "${d.severity}". Se esperaba 'error' | 'warning' | 'info' | 'unspecified'.`,
      receivedValue: d.severity,
      expected: 'error | warning | info | unspecified',
    });
  }

  const validCategories: DiagnosticCategory[] = [
    'lexico',
    'sintactico',
    'semantico',
    'importacion',
    'ejecucion',
    'espacial',
  ];
  if (!validCategories.includes(d.category as DiagnosticCategory)) {
    errors.push({
      path: `${pathPrefix}.category`,
      code: 'INVALID_FIELD_TYPE',
      message: `Categoría diagnóstica inválida: "${d.category}".`,
      receivedValue: d.category,
      expected: 'lexico | sintactico | semantico | importacion | ejecucion | espacial',
    });
  }

  if (typeof d.blocking !== 'boolean') {
    errors.push({
      path: `${pathPrefix}.blocking`,
      code: 'INVALID_FIELD_TYPE',
      message: 'El campo blocking debe ser un booleano.',
      receivedValue: d.blocking,
      expected: 'boolean',
    });
  }

  if (typeof d.file !== 'string' || !d.file.trim()) {
    errors.push({
      path: `${pathPrefix}.file`,
      code: 'MISSING_REQUIRED_FIELD',
      message: 'El nombre o ruta del archivo de origen es obligatorio.',
      receivedValue: d.file,
      expected: 'string',
    });
  }

  if (typeof d.line !== 'number' || !Number.isInteger(d.line) || d.line < 1) {
    errors.push({
      path: `${pathPrefix}.line`,
      code: 'INVALID_FIELD_TYPE',
      message: 'El número de línea debe ser un entero positivo (>= 1).',
      receivedValue: d.line,
      expected: 'number >= 1',
    });
  }

  if (typeof d.column !== 'number' || !Number.isInteger(d.column) || d.column < 1) {
    errors.push({
      path: `${pathPrefix}.column`,
      code: 'INVALID_FIELD_TYPE',
      message: 'El número de columna debe ser un entero positivo (>= 1).',
      receivedValue: d.column,
      expected: 'number >= 1',
    });
  }

  if (typeof d.description !== 'string' || !d.description.trim()) {
    errors.push({
      path: `${pathPrefix}.description`,
      code: 'MISSING_REQUIRED_FIELD',
      message: 'La descripción del diagnóstico es obligatoria.',
      receivedValue: d.description,
      expected: 'string',
    });
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? (d as unknown as DiagnosticItem) : null,
    errors,
    warnings,
  };
}

/**
 * Valida un objeto espacial (SpatialObject).
 */
export function validateSpatialObject(
  raw: unknown,
  pathPrefix = 'spatialObject'
): ContractValidationResult<SpatialObject> {
  const errors: ContractValidationError[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return {
      isValid: false,
      data: null,
      errors: [
        {
          path: pathPrefix,
          code: 'INVALID_FIELD_TYPE',
          message: `Se esperaba un objeto para SpatialObject en ${pathPrefix}.`,
          receivedValue: raw,
        },
      ],
      warnings,
    };
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.id !== 'string' || !obj.id.trim()) {
    errors.push({
      path: `${pathPrefix}.id`,
      code: 'MISSING_REQUIRED_FIELD',
      message: 'El ID del objeto espacial es obligatorio.',
      receivedValue: obj.id,
      expected: 'string',
    });
  }

  if (typeof obj.type !== 'string' || !obj.type.trim()) {
    errors.push({
      path: `${pathPrefix}.type`,
      code: 'MISSING_REQUIRED_FIELD',
      message: 'El tipo del objeto espacial es obligatorio (ej. "sofa", "mesa").',
      receivedValue: obj.type,
      expected: 'string',
    });
  }

  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    errors.push({
      path: `${pathPrefix}.name`,
      code: 'MISSING_REQUIRED_FIELD',
      message: 'El nombre del objeto espacial es obligatorio.',
      receivedValue: obj.name,
      expected: 'string',
    });
  }

  // Validación de posición: [x, y, z] con números finitos
  if (!isValid3DTuple(obj.position)) {
    errors.push({
      path: `${pathPrefix}.position`,
      code: 'INVALID_SPATIAL_REFERENCE',
      message: 'La posición debe ser una tupla de 3 números finitos [x, y, z].',
      receivedValue: obj.position,
      expected: '[number, number, number]',
    });
  }

  // Validación de rotación: [rx, ry, rz]
  if (!isValid3DTuple(obj.rotation)) {
    errors.push({
      path: `${pathPrefix}.rotation`,
      code: 'INVALID_SPATIAL_REFERENCE',
      message: 'La rotación debe ser una tupla de 3 números finitos [rx, ry, rz].',
      receivedValue: obj.rotation,
      expected: '[number, number, number]',
    });
  }

  // Validación de dimensiones: [ancho, altura, profundidad] > 0
  if (!isValid3DTuple(obj.dimensions)) {
    errors.push({
      path: `${pathPrefix}.dimensions`,
      code: 'INVALID_SPATIAL_REFERENCE',
      message: 'Las dimensiones deben ser una tupla de 3 números [ancho, altura, profundidad].',
      receivedValue: obj.dimensions,
      expected: '[number, number, number]',
    });
  } else {
    const [w, h, d] = obj.dimensions;
    if (w <= 0 || h <= 0 || d <= 0) {
      errors.push({
        path: `${pathPrefix}.dimensions`,
        code: 'INVALID_SPATIAL_REFERENCE',
        message: `Las dimensiones físicas deben ser mayores a 0 (recibido: [${w}, ${h}, ${d}]).`,
        receivedValue: obj.dimensions,
        expected: 'dimensiones estrictamente positivas',
      });
    }
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? (obj as unknown as SpatialObject) : null,
    errors,
    warnings,
  };
}

/**
 * Valida un modelo de habitación (RoomModel).
 */
export function validateRoomModel(
  raw: unknown,
  pathPrefix = 'room'
): ContractValidationResult<RoomModel> {
  const errors: ContractValidationError[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return {
      isValid: false,
      data: null,
      errors: [
        {
          path: pathPrefix,
          code: 'INVALID_FIELD_TYPE',
          message: `Se esperaba un objeto para RoomModel en ${pathPrefix}.`,
          receivedValue: raw,
        },
      ],
      warnings,
    };
  }

  const room = raw as Record<string, unknown>;

  if (typeof room.id !== 'string' || !room.id.trim()) {
    errors.push({
      path: `${pathPrefix}.id`,
      code: 'MISSING_REQUIRED_FIELD',
      message: 'El ID de la habitación es obligatorio.',
      receivedValue: room.id,
      expected: 'string',
    });
  }

  if (typeof room.name !== 'string' || !room.name.trim()) {
    errors.push({
      path: `${pathPrefix}.name`,
      code: 'MISSING_REQUIRED_FIELD',
      message: 'El nombre de la habitación es obligatorio.',
      receivedValue: room.name,
      expected: 'string',
    });
  }

  // Dimensiones: [ancho (X), largo (Z), altura (Y)] > 0
  if (!isValid3DTuple(room.dimensions)) {
    errors.push({
      path: `${pathPrefix}.dimensions`,
      code: 'INVALID_SPATIAL_REFERENCE',
      message: 'Las dimensiones de la habitación deben ser [ancho, largo, altura] numéricas.',
      receivedValue: room.dimensions,
      expected: '[number, number, number]',
    });
  } else {
    const [w, l, h] = room.dimensions;
    if (w <= 0 || l <= 0 || h <= 0) {
      errors.push({
        path: `${pathPrefix}.dimensions`,
        code: 'INVALID_SPATIAL_REFERENCE',
        message: `Las dimensiones de la habitación deben ser estrictamente positivas (recibido: [${w}, ${l}, ${h}]).`,
        receivedValue: room.dimensions,
        expected: 'dimensiones positivas > 0',
      });
    }
  }

  if (!room.floor || typeof room.floor !== 'object') {
    errors.push({
      path: `${pathPrefix}.floor`,
      code: 'MISSING_REQUIRED_FIELD',
      message: 'La configuración del piso (floor) es obligatoria.',
      receivedValue: room.floor,
      expected: 'FloorModel object',
    });
  } else {
    const floor = room.floor as Record<string, unknown>;
    if (typeof floor.material !== 'string') {
      errors.push({
        path: `${pathPrefix}.floor.material`,
        code: 'MISSING_REQUIRED_FIELD',
        message: 'El material del piso es obligatorio.',
        receivedValue: floor.material,
      });
    }
  }

  const validWallOrientations = ['norte', 'sur', 'este', 'oeste'];
  if (!room.walls || typeof room.walls !== 'object') {
    errors.push({
      path: `${pathPrefix}.walls`,
      code: 'MISSING_REQUIRED_FIELD',
      message: 'La configuración de paredes (walls) es obligatoria (north, south, east, west).',
      receivedValue: room.walls,
    });
  } else {
    const walls = room.walls as Record<string, unknown>;
    const wallKeys = ['north', 'south', 'east', 'west'];
    for (const key of wallKeys) {
      if (!walls[key] || typeof walls[key] !== 'object') {
        errors.push({
          path: `${pathPrefix}.walls.${key}`,
          code: 'MISSING_REQUIRED_FIELD',
          message: `Falta la configuración de pared ${key}.`,
          receivedValue: walls[key],
        });
      }
    }
  }

  if (!Array.isArray(room.doors)) {
    errors.push({
      path: `${pathPrefix}.doors`,
      code: 'INVALID_FIELD_TYPE',
      message: 'doors debe ser un arreglo de puertas.',
      receivedValue: room.doors,
      expected: 'DoorModel[]',
    });
  } else {
    room.doors.forEach((door, idx) => {
      const d = door as Record<string, unknown>;
      if (!validWallOrientations.includes(String(d?.wall))) {
        errors.push({
          path: `${pathPrefix}.doors[${idx}].wall`,
          code: 'INVALID_SPATIAL_REFERENCE',
          message: `La pared de la puerta debe ser norte, sur, este u oeste (recibido: "${d?.wall}").`,
          receivedValue: d?.wall,
        });
      }
      if (typeof d?.width !== 'number' || d.width <= 0) {
        errors.push({
          path: `${pathPrefix}.doors[${idx}].width`,
          code: 'INVALID_SPATIAL_REFERENCE',
          message: 'El ancho de la puerta debe ser positivo.',
          receivedValue: d?.width,
        });
      }
      if (typeof d?.height !== 'number' || d.height <= 0) {
        errors.push({
          path: `${pathPrefix}.doors[${idx}].height`,
          code: 'INVALID_SPATIAL_REFERENCE',
          message: 'La altura de la puerta debe ser positiva.',
          receivedValue: d?.height,
        });
      }
    });
  }

  if (!Array.isArray(room.windows)) {
    errors.push({
      path: `${pathPrefix}.windows`,
      code: 'INVALID_FIELD_TYPE',
      message: 'windows debe ser un arreglo de ventanas.',
      receivedValue: room.windows,
      expected: 'WindowModel[]',
    });
  } else {
    room.windows.forEach((win, idx) => {
      const w = win as Record<string, unknown>;
      if (!validWallOrientations.includes(String(w?.wall))) {
        errors.push({
          path: `${pathPrefix}.windows[${idx}].wall`,
          code: 'INVALID_SPATIAL_REFERENCE',
          message: `La pared de la ventana debe ser norte, sur, este u oeste (recibido: "${w?.wall}").`,
          receivedValue: w?.wall,
        });
      }
      if (typeof w?.width !== 'number' || w.width <= 0) {
        errors.push({
          path: `${pathPrefix}.windows[${idx}].width`,
          code: 'INVALID_SPATIAL_REFERENCE',
          message: 'El ancho de la ventana debe ser positivo.',
          receivedValue: w?.width,
        });
      }
      if (typeof w?.height !== 'number' || w.height <= 0) {
        errors.push({
          path: `${pathPrefix}.windows[${idx}].height`,
          code: 'INVALID_SPATIAL_REFERENCE',
          message: 'La altura de la ventana debe ser positiva.',
          receivedValue: w?.height,
        });
      }
    });
  }

  if (!Array.isArray(room.objects)) {
    errors.push({
      path: `${pathPrefix}.objects`,
      code: 'INVALID_FIELD_TYPE',
      message: 'objects debe ser un arreglo de objetos espaciales.',
      receivedValue: room.objects,
      expected: 'SpatialObject[]',
    });
  } else {
    room.objects.forEach((obj, idx) => {
      const objRes = validateSpatialObject(obj, `${pathPrefix}.objects[${idx}]`);
      errors.push(...objRes.errors);
      warnings.push(...objRes.warnings);
    });
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? (room as unknown as RoomModel) : null,
    errors,
    warnings,
  };
}

/**
 * Valida un ScenePlan completo.
 */
export function validateScenePlan(
  raw: unknown,
  pathPrefix = 'scenePlan'
): ContractValidationResult<ScenePlan> {
  const errors: ContractValidationError[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return {
      isValid: false,
      data: null,
      errors: [
        {
          path: pathPrefix,
          code: 'INVALID_FIELD_TYPE',
          message: `Se esperaba un objeto para ScenePlan en ${pathPrefix}.`,
          receivedValue: raw,
        },
      ],
      warnings,
    };
  }

  const sp = raw as Record<string, unknown>;

  if (typeof sp.version !== 'string' || !sp.version.trim()) {
    errors.push({
      path: `${pathPrefix}.version`,
      code: 'MISSING_REQUIRED_FIELD',
      message: 'La versión del ScenePlan es obligatoria.',
      receivedValue: sp.version,
      expected: 'string semver (ej: 1.0.0)',
    });
  } else if (!isVersionCompatible(sp.version)) {
    errors.push({
      path: `${pathPrefix}.version`,
      code: 'INCOMPATIBLE_VERSION',
      message: `Versión de ScenePlan "${sp.version}" incompatible con las versiones soportadas (v1.x).`,
      receivedValue: sp.version,
      expected: '1.x.x',
    });
  }

  if (!Array.isArray(sp.rooms)) {
    errors.push({
      path: `${pathPrefix}.rooms`,
      code: 'INVALID_FIELD_TYPE',
      message: 'rooms debe ser un arreglo de habitaciones.',
      receivedValue: sp.rooms,
      expected: 'RoomModel[]',
    });
  } else {
    sp.rooms.forEach((room, idx) => {
      const roomRes = validateRoomModel(room, `${pathPrefix}.rooms[${idx}]`);
      errors.push(...roomRes.errors);
      warnings.push(...roomRes.warnings);
    });
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? (sp as unknown as ScenePlan) : null,
    errors,
    warnings,
  };
}

/**
 * Valida un paso de depuración DebugStep.
 */
export function validateDebugStep(
  raw: unknown,
  pathPrefix = 'debugStep'
): ContractValidationResult<DebugStep> {
  const errors: ContractValidationError[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return {
      isValid: false,
      data: null,
      errors: [
        {
          path: pathPrefix,
          code: 'INVALID_FIELD_TYPE',
          message: `Se esperaba un objeto para DebugStep en ${pathPrefix}.`,
          receivedValue: raw,
        },
      ],
      warnings,
    };
  }

  const s = raw as Record<string, unknown>;

  if (typeof s.id !== 'string' || !s.id.trim()) {
    errors.push({
      path: `${pathPrefix}.id`,
      code: 'MISSING_REQUIRED_FIELD',
      message: 'El identificador id del paso es obligatorio.',
      receivedValue: s.id,
      expected: 'string',
    });
  }

  if (typeof s.stepIndex !== 'number' || s.stepIndex < 0) {
    errors.push({
      path: `${pathPrefix}.stepIndex`,
      code: 'INVALID_FIELD_TYPE',
      message: 'stepIndex debe ser un número entero >= 0.',
      receivedValue: s.stepIndex,
      expected: 'number >= 0',
    });
  }

  const validEventTypes: DebugEventType[] = [
    'start',
    'declaration',
    'assignment',
    'condition',
    'loop',
    'room_create',
    'place_object',
    'move_object',
    'rotate_object',
    'spatial_warning',
    'spatial_error',
    'end',
  ];
  if (!validEventTypes.includes(s.eventType as DebugEventType)) {
    errors.push({
      path: `${pathPrefix}.eventType`,
      code: 'INVALID_FIELD_TYPE',
      message: `Tipo de evento de depuración no reconocido: "${s.eventType}".`,
      receivedValue: s.eventType,
      expected: validEventTypes.join(' | '),
    });
  }

  if (typeof s.description !== 'string' || !s.description.trim()) {
    errors.push({
      path: `${pathPrefix}.description`,
      code: 'MISSING_REQUIRED_FIELD',
      message: 'La descripción del paso es obligatoria.',
      receivedValue: s.description,
      expected: 'string',
    });
  }

  if (!s.sourceRef || typeof s.sourceRef !== 'object') {
    errors.push({
      path: `${pathPrefix}.sourceRef`,
      code: 'MISSING_REQUIRED_FIELD',
      message: 'La referencia al código fuente (sourceRef) es obligatoria.',
      receivedValue: s.sourceRef,
      expected: '{ file: string, line: number, column?: number }',
    });
  } else {
    const sRef = s.sourceRef as Record<string, unknown>;
    if (typeof sRef.file !== 'string' || !sRef.file.trim()) {
      errors.push({
        path: `${pathPrefix}.sourceRef.file`,
        code: 'MISSING_REQUIRED_FIELD',
        message: 'sourceRef.file es obligatorio.',
        receivedValue: sRef.file,
      });
    }
    if (typeof sRef.line !== 'number' || sRef.line < 1) {
      errors.push({
        path: `${pathPrefix}.sourceRef.line`,
        code: 'INVALID_FIELD_TYPE',
        message: 'sourceRef.line debe ser un número positivo (>= 1).',
        receivedValue: sRef.line,
      });
    }
  }

  if (typeof s.codeLine !== 'string') {
    errors.push({
      path: `${pathPrefix}.codeLine`,
      code: 'MISSING_REQUIRED_FIELD',
      message: 'codeLine debe ser una cadena con la línea de código ejecutada.',
      receivedValue: s.codeLine,
    });
  }

  if (!s.sceneSnapshot || typeof s.sceneSnapshot !== 'object') {
    errors.push({
      path: `${pathPrefix}.sceneSnapshot`,
      code: 'MISSING_REQUIRED_FIELD',
      message: 'sceneSnapshot es obligatorio en cada paso del depurador.',
      receivedValue: s.sceneSnapshot,
      expected: 'ScenePlan snapshot',
    });
  } else {
    const snapRes = validateScenePlan(s.sceneSnapshot, `${pathPrefix}.sceneSnapshot`);
    errors.push(...snapRes.errors);
    warnings.push(...snapRes.warnings);
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? (s as unknown as DebugStep) : null,
    errors,
    warnings,
  };
}

/**
 * Valida un resultado completo de compilación (CompileResult).
 */
export function validateCompileResult(
  raw: unknown,
  pathPrefix = 'compileResult'
): ContractValidationResult<CompileResult> {
  const errors: ContractValidationError[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return {
      isValid: false,
      data: null,
      errors: [
        {
          path: pathPrefix,
          code: 'INVALID_FIELD_TYPE',
          message: `Se esperaba un objeto para el resultado de compilación en ${pathPrefix}.`,
          receivedValue: raw,
        },
      ],
      warnings,
    };
  }

  const res = raw as Record<string, unknown>;

  // Optional schemaVersion compatibility check if present in payload
  if (res.schemaVersion && typeof res.schemaVersion === 'string') {
    if (!isVersionCompatible(res.schemaVersion)) {
      errors.push({
        path: `${pathPrefix}.schemaVersion`,
        code: 'INCOMPATIBLE_VERSION',
        message: `Versión de esquema del resultado "${res.schemaVersion}" incompatible con versión soportada (1.x).`,
        receivedValue: res.schemaVersion,
        expected: '1.x.x',
      });
    }
  }

  if (typeof res.compilationId !== 'string' || !res.compilationId.trim()) {
    errors.push({
      path: `${pathPrefix}.compilationId`,
      code: 'MISSING_REQUIRED_FIELD',
      message: 'El identificador compilationId es obligatorio.',
      receivedValue: res.compilationId,
      expected: 'string',
    });
  }

  const validStatuses = ['blocked', 'completed', 'completed_with_spatial_issues', 'failed', 'incomplete'];
  if (!validStatuses.includes(String(res.status))) {
    errors.push({
      path: `${pathPrefix}.status`,
      code: 'INVALID_FIELD_TYPE',
      message: `Estado de compilación no reconocido: "${res.status}".`,
      receivedValue: res.status,
      expected: 'blocked | completed | completed_with_spatial_issues | failed | incomplete',
    });
  }

  if (typeof res.success !== 'boolean') {
    errors.push({
      path: `${pathPrefix}.success`,
      code: 'INVALID_FIELD_TYPE',
      message: 'success debe ser un valor booleano.',
      receivedValue: res.success,
      expected: 'boolean',
    });
  }

  if (!Array.isArray(res.diagnostics)) {
    errors.push({
      path: `${pathPrefix}.diagnostics`,
      code: 'INVALID_FIELD_TYPE',
      message: 'diagnostics debe ser un arreglo de diagnósticos.',
      receivedValue: res.diagnostics,
      expected: 'DiagnosticItem[]',
    });
  } else {
    res.diagnostics.forEach((diag, idx) => {
      const diagRes = validateDiagnosticItem(diag, `${pathPrefix}.diagnostics[${idx}]`);
      errors.push(...diagRes.errors);
      warnings.push(...diagRes.warnings);
    });
  }

  if (res.scenePlan !== null && res.scenePlan !== undefined) {
    const spRes = validateScenePlan(res.scenePlan, `${pathPrefix}.scenePlan`);
    errors.push(...spRes.errors);
    warnings.push(...spRes.warnings);
  }

  if (typeof res.durationMs !== 'number' || res.durationMs < 0 || !Number.isFinite(res.durationMs)) {
    errors.push({
      path: `${pathPrefix}.durationMs`,
      code: 'INVALID_FIELD_TYPE',
      message: 'durationMs debe ser un número finito positivo (milisegundos).',
      receivedValue: res.durationMs,
      expected: 'number >= 0',
    });
  }

  if (!Array.isArray(res.logs)) {
    errors.push({
      path: `${pathPrefix}.logs`,
      code: 'INVALID_FIELD_TYPE',
      message: 'logs debe ser un arreglo de cadenas de texto.',
      receivedValue: res.logs,
      expected: 'string[]',
    });
  }

  if (!Array.isArray(res.debugSteps)) {
    errors.push({
      path: `${pathPrefix}.debugSteps`,
      code: 'INVALID_FIELD_TYPE',
      message: 'debugSteps debe ser un arreglo de pasos de depuración.',
      receivedValue: res.debugSteps,
      expected: 'DebugStep[]',
    });
  } else {
    res.debugSteps.forEach((step, idx) => {
      const stepRes = validateDebugStep(step, `${pathPrefix}.debugSteps[${idx}]`);
      errors.push(...stepRes.errors);
      warnings.push(...stepRes.warnings);
    });
  }

  if (typeof res.timestamp !== 'string' || !res.timestamp.trim()) {
    errors.push({
      path: `${pathPrefix}.timestamp`,
      code: 'MISSING_REQUIRED_FIELD',
      message: 'El timestamp ISO es obligatorio.',
      receivedValue: res.timestamp,
      expected: 'ISO-8601 string',
    });
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? (res as unknown as CompileResult) : null,
    errors,
    warnings,
  };
}

/**
 * Valida una solicitud de compilación saliente (LumiCompileRequest).
 */
export function validateCompileRequest(
  raw: unknown,
  pathPrefix = 'compileRequest'
): ContractValidationResult<LumiCompileRequest> {
  const errors: ContractValidationError[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return {
      isValid: false,
      data: null,
      errors: [
        {
          path: pathPrefix,
          code: 'INVALID_FIELD_TYPE',
          message: `Se esperaba un objeto para LumiCompileRequest en ${pathPrefix}.`,
          receivedValue: raw,
        },
      ],
      warnings,
    };
  }

  const req = raw as Record<string, unknown>;

  if (typeof req.schemaVersion !== 'string' || !req.schemaVersion.trim()) {
    errors.push({
      path: `${pathPrefix}.schemaVersion`,
      code: 'MISSING_REQUIRED_FIELD',
      message: 'El campo schemaVersion es obligatorio en la solicitud.',
      receivedValue: req.schemaVersion,
      expected: 'string (ej: 1.0.0)',
    });
  } else if (!isVersionCompatible(req.schemaVersion)) {
    errors.push({
      path: `${pathPrefix}.schemaVersion`,
      code: 'INCOMPATIBLE_VERSION',
      message: `Versión solicitada "${req.schemaVersion}" incompatible con el protocolo actual.`,
      receivedValue: req.schemaVersion,
      expected: '1.x.x',
    });
  }

  if (typeof req.projectId !== 'string' || !req.projectId.trim()) {
    errors.push({
      path: `${pathPrefix}.projectId`,
      code: 'MISSING_REQUIRED_FIELD',
      message: 'projectId es obligatorio.',
      receivedValue: req.projectId,
      expected: 'string',
    });
  }

  if (typeof req.projectName !== 'string' || !req.projectName.trim()) {
    errors.push({
      path: `${pathPrefix}.projectName`,
      code: 'MISSING_REQUIRED_FIELD',
      message: 'projectName es obligatorio.',
      receivedValue: req.projectName,
      expected: 'string',
    });
  }

  if (!Array.isArray(req.files) || req.files.length === 0) {
    errors.push({
      path: `${pathPrefix}.files`,
      code: 'MISSING_REQUIRED_FIELD',
      message: 'El arreglo de archivos (files) debe contener al menos un archivo para compilar.',
      receivedValue: req.files,
      expected: 'CompileSourceFileDTO[] con longitud >= 1',
    });
  } else {
    req.files.forEach((f, idx) => {
      const file = f as Record<string, unknown>;
      if (typeof file?.id !== 'string') {
        errors.push({
          path: `${pathPrefix}.files[${idx}].id`,
          code: 'MISSING_REQUIRED_FIELD',
          message: 'ID de archivo obligatorio.',
          receivedValue: file?.id,
        });
      }
      if (typeof file?.name !== 'string') {
        errors.push({
          path: `${pathPrefix}.files[${idx}].name`,
          code: 'MISSING_REQUIRED_FIELD',
          message: 'Nombre de archivo obligatorio.',
          receivedValue: file?.name,
        });
      }
      if (typeof file?.content !== 'string') {
        errors.push({
          path: `${pathPrefix}.files[${idx}].content`,
          code: 'MISSING_REQUIRED_FIELD',
          message: 'Contenido de código fuente obligatorio.',
          receivedValue: file?.content,
        });
      }
    });
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? (req as unknown as LumiCompileRequest) : null,
    errors,
    warnings,
  };
}

/**
 * Valida un artefacto compilado .lumic (LumiCompiledArtifact).
 */
export function validateLumicArtifact(
  raw: unknown,
  pathPrefix = 'lumicArtifact'
): ContractValidationResult<LumiCompiledArtifact> {
  return validateLumicStructure(raw, pathPrefix);
}

/**
 * Parsea una cadena JSON y valida que sea un CompileResult conforme al contrato.
 * Es tolerante y jamás arroja excepciones no capturadas.
 */
export function parseAndValidateCompileResult(
  jsonString: string
): ContractValidationResult<CompileResult> {
  if (typeof jsonString !== 'string' || !jsonString.trim()) {
    return {
      isValid: false,
      data: null,
      errors: [
        {
          path: '',
          code: 'MALFORMED_JSON',
          message: 'La cadena JSON provista está vacía o no es una cadena válida.',
          receivedValue: jsonString,
        },
      ],
      warnings: [],
    };
  }

  try {
    const parsed = JSON.parse(jsonString);
    return validateCompileResult(parsed);
  } catch (err) {
    return {
      isValid: false,
      data: null,
      errors: [
        {
          path: '',
          code: 'MALFORMED_JSON',
          message: `Error de sintaxis JSON: ${err instanceof Error ? err.message : String(err)}`,
          receivedValue: jsonString.slice(0, 120),
        },
      ],
      warnings: [],
    };
  }
}

/**
 * Parsea y valida un artefacto .lumic desde una cadena JSON.
 */
export function parseAndValidateLumicArtifact(
  jsonString: string
): ContractValidationResult<LumiCompiledArtifact> {
  try {
    const parsed = JSON.parse(jsonString);
    return validateLumicArtifact(parsed);
  } catch (err) {
    return {
      isValid: false,
      data: null,
      errors: [
        {
          path: '',
          code: 'MALFORMED_JSON',
          message: `Error de sintaxis JSON en artefacto .lumic: ${
            err instanceof Error ? err.message : String(err)
          }`,
        },
      ],
      warnings: [],
    };
  }
}

/**
 * Genera un resultado CompileResult seguro y tolerante a fallos cuando la respuesta
 * del compilador no cumple el contrato o llega malformada.
 * Garantiza que el IDE, el editor y el visor 3D continúen operando sin crashear.
 */
export function createSafeFallbackCompileResult(
  raw: unknown,
  errors: ContractValidationError[],
  compilationId?: string
): CompileResult {
  const safeId =
    compilationId ||
    (raw && typeof raw === 'object' && 'compilationId' in (raw as Record<string, unknown>)
      ? String((raw as Record<string, unknown>).compilationId)
      : `comp-fallback-${Date.now().toString(36)}`);

  const diagnostics: DiagnosticItem[] = errors.map((err, idx) => ({
    id: `diag-contract-${idx}-${Date.now().toString(36)}`,
    code: err.code === 'INVALID_SPATIAL_REFERENCE' ? 'LUMI-E802' : 'LUMI-E801',
    severity: 'error',
    category: err.code === 'INVALID_SPATIAL_REFERENCE' ? 'espacial' : 'ejecucion',
    blocking: true,
    file: 'compilador',
    line: 1,
    column: 1,
    description: `Violación de contrato en ${err.path || 'raíz'}: ${err.message}`,
    solution:
      'Verifique que la salida producida por el compilador cumpla con el esquema JSON LUMI v1.0.0.',
  }));

  const logs: string[] = [
    `[Contrato LUMI] Se detectaron ${errors.length} violaciones de contrato en la respuesta recibida.`,
    ...errors.map((e) => ` - [${e.code}] ${e.path}: ${e.message}`),
  ];

  return {
    compilationId: safeId,
    status: 'blocked',
    success: false,
    diagnostics,
    scenePlan: null,
    entryFileInfo: null,
    durationMs: 0,
    logs,
    debugSteps: [],
    timestamp: new Date().toISOString(),
  };
}

/**
 * Serializadores a JSON con soporte para formato legible o minificado.
 */
export function serializeCompileRequest(
  request: LumiCompileRequest,
  pretty = false
): string {
  return JSON.stringify(request, null, pretty ? 2 : undefined);
}

export function serializeCompileResult(
  result: CompileResult,
  pretty = false
): string {
  return JSON.stringify(result, null, pretty ? 2 : undefined);
}

export function serializeLumicArtifact(
  artifact: LumiCompiledArtifact,
  pretty = false
): string {
  return JSON.stringify(artifact, null, pretty ? 2 : undefined);
}

/**
 * Empaqueta un CompileResult válido en un artefacto exportable .lumic.
 */
export function createLumicArtifactFromCompileResult(
  result: CompileResult,
  project: { id: string; name: string; filesCount?: number; entryFile?: string }
): LumiCompiledArtifact | null {
  if (!result.scenePlan) {
    return null;
  }

  const totalErrors = result.diagnostics.filter((d) => d.severity === 'error').length;
  const totalWarnings = result.diagnostics.filter((d) => d.severity === 'warning').length;
  const totalSpatialIssues = result.diagnostics.filter(
    (d) => d.category === 'espacial'
  ).length;

  return {
    format: 'lumic',
    schemaVersion: LUMI_PROTOCOL_VERSION,
    compiledAt: result.timestamp,
    compiler: {
      name: 'lumi-compiler',
      version: '1.0.0',
      target: 'lumi-3d-scene',
    },
    project: {
      id: project.id,
      name: project.name,
      entryFile: project.entryFile || result.entryFileInfo?.name || 'principal.lumi',
      sourceFilesCount: project.filesCount || 1,
    },
    scenePlan: result.scenePlan,
    debugSteps: result.debugSteps,
    diagnosticsSummary: {
      totalErrors,
      totalWarnings,
      totalSpatialIssues,
      hasBlockingErrors: result.diagnostics.some((d) => d.blocking),
    },
  };
}
