export interface ValidationResult {
  isValid: boolean;
  error?: string;
  cleanValue?: string;
}

/**
 * Valida el nombre de un nuevo proyecto o renombrado de proyecto.
 */
export function validateProjectName(
  name: string,
  existingNames: string[] = []
): ValidationResult {
  const trimmed = name.trim();

  if (!trimmed) {
    return {
      isValid: false,
      error: 'El nombre del proyecto no puede estar vacío.',
    };
  }

  if (trimmed.length < 2) {
    return {
      isValid: false,
      error: 'El nombre del proyecto debe tener al menos 2 caracteres.',
    };
  }

  if (trimmed.length > 50) {
    return {
      isValid: false,
      error: 'El nombre del proyecto no puede superar los 50 caracteres.',
    };
  }

  const invalidCharsRegex = /[<>:"/\\|?*]/;
  if (invalidCharsRegex.test(trimmed)) {
    return {
      isValid: false,
      error: 'El nombre contiene caracteres inválidos (< > : " / \\ | ? *).',
    };
  }

  const isDuplicate = existingNames.some(
    (existing) => existing.trim().toLowerCase() === trimmed.toLowerCase()
  );

  if (isDuplicate) {
    return {
      isValid: false,
      error: 'Ya existe un proyecto con ese nombre.',
    };
  }

  return {
    isValid: true,
    cleanValue: trimmed,
  };
}

/**
 * Valida la ubicación o ruta lógica del proyecto.
 */
export function validateProjectLocation(location: string): ValidationResult {
  const trimmed = location.trim();

  if (!trimmed) {
    return {
      isValid: false,
      error: 'La ubicación del proyecto no puede estar vacía.',
    };
  }

  const invalidCharsRegex = /[<>"|?*]/;
  if (invalidCharsRegex.test(trimmed)) {
    return {
      isValid: false,
      error: 'La ruta contiene caracteres no permitidos (< > " | ? *).',
    };
  }

  return {
    isValid: true,
    cleanValue: trimmed,
  };
}

/**
 * Valida el nombre de un archivo .lumi.
 */
export function validateFileName(
  name: string,
  existingFileNames: string[] = [],
  originalName?: string
): ValidationResult {
  let trimmed = name.trim();

  if (!trimmed) {
    return {
      isValid: false,
      error: 'El nombre del archivo no puede estar vacío.',
    };
  }

  if (!trimmed.toLowerCase().endsWith('.lumi')) {
    trimmed = `${trimmed}.lumi`;
  }

  const baseName = trimmed.slice(0, -5);

  if (!baseName || baseName.trim().length === 0) {
    return {
      isValid: false,
      error: 'Debe especificar un nombre antes de la extensión .lumi.',
    };
  }

  const invalidCharsRegex = /[<>:"/\\|?*\s]/;
  if (invalidCharsRegex.test(baseName)) {
    return {
      isValid: false,
      error: 'El nombre no debe contener espacios ni caracteres como < > : " / \\ | ? *.',
    };
  }

  const isDuplicate = existingFileNames.some((existing) => {
    if (originalName && existing.toLowerCase() === originalName.toLowerCase()) {
      return false;
    }
    return existing.toLowerCase() === trimmed.toLowerCase();
  });

  if (isDuplicate) {
    return {
      isValid: false,
      error: `Ya existe un archivo con el nombre "${trimmed}" en este proyecto.`,
    };
  }

  return {
    isValid: true,
    cleanValue: trimmed,
  };
}

/**
 * Generador de identificadores únicos para proyectos y archivos.
 */
export function generateUniqueId(prefix: string = 'id'): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 7);
  return `${prefix}-${timestamp}-${randomPart}`;
}

export interface RoomValidationResult {
  isValid: boolean;
  errors: {
    name?: string;
    ancho?: string;
    largo?: string;
    altura?: string;
    general?: string;
  };
  generatedCode?: string;
  cleanValues?: {
    name: string;
    ancho: number;
    largo: number;
    altura: number;
  };
}

/**
 * Valida los parámetros para la creación e inserción de una nueva habitación Lumi.
 */
export function validateRoomParams(
  name: string,
  anchoStr: string | number,
  largoStr: string | number,
  alturaStr: string | number
): RoomValidationResult {
  const errors: RoomValidationResult['errors'] = {};
  const trimmedName = String(name || '').trim();

  if (!trimmedName) {
    errors.name = 'El nombre de la habitación es obligatorio.';
  } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmedName)) {
    errors.name = 'El nombre debe ser un identificador válido de Lumi (letras, números y guion bajo, sin iniciar con dígito).';
  }

  const anchoVal = typeof anchoStr === 'number' ? anchoStr : parseFloat(String(anchoStr).replace(',', '.'));
  if (isNaN(anchoVal) || String(anchoStr).trim() === '') {
    errors.ancho = 'El ancho debe ser un valor numérico.';
  } else if (anchoVal <= 0) {
    errors.ancho = 'El ancho debe ser mayor a 0 (ej: 5.0).';
  }

  const largoVal = typeof largoStr === 'number' ? largoStr : parseFloat(String(largoStr).replace(',', '.'));
  if (isNaN(largoVal) || String(largoStr).trim() === '') {
    errors.largo = 'El largo debe ser un valor numérico.';
  } else if (largoVal <= 0) {
    errors.largo = 'El largo debe ser mayor a 0 (ej: 4.0).';
  }

  const alturaVal = typeof alturaStr === 'number' ? alturaStr : parseFloat(String(alturaStr).replace(',', '.'));
  if (isNaN(alturaVal) || String(alturaStr).trim() === '') {
    errors.altura = 'La altura debe ser un valor numérico.';
  } else if (alturaVal <= 0) {
    errors.altura = 'La altura debe ser mayor a 0 (ej: 2.7).';
  }

  const isValid = Object.keys(errors).length === 0;

  if (!isValid) {
    return { isValid: false, errors };
  }

  // Formatear decimales en Lumi: 5.0 en lugar de 5
  const formatDecimal = (num: number): string => {
    return num % 1 === 0 ? num.toFixed(1) : num.toString();
  };

  const generatedCode = `habitacion ${trimmedName}(${formatDecimal(anchoVal)}, ${formatDecimal(largoVal)}, ${formatDecimal(alturaVal)}) {\n}`;

  return {
    isValid: true,
    errors: {},
    generatedCode,
    cleanValues: {
      name: trimmedName,
      ancho: anchoVal,
      largo: largoVal,
      altura: alturaVal,
    },
  };
}

