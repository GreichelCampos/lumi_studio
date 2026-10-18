import { DiagnosticItem } from '../../types';

/**
 * Factory for structured mock compiler diagnostic messages.
 */
export class MockDiagnosticFactory {
  public static noProject(compilationId: string): DiagnosticItem {
    return {
      id: `diag-no-project-${compilationId}`,
      code: 'LUMI-E001',
      severity: 'error',
      category: 'importacion',
      blocking: true,
      file: 'desconocido',
      line: 1,
      column: 1,
      description: 'No existe un proyecto abierto o el espacio de trabajo no contiene archivos .lumi.',
      solution: 'Abra o cree un proyecto con al menos un archivo .lumi antes de compilar.',
    };
  }

  public static illegalSymbol(compilationId: string, file: string, line: number, column: number): DiagnosticItem {
    return {
      id: `diag-lex-${compilationId}-${line}`,
      code: 'LUMI-L001',
      severity: 'error',
      category: 'lexico',
      blocking: true,
      file,
      line,
      column,
      sourceRef: { file, line, column },
      description: 'Símbolo no reconocido en el léxico de Lumi.',
      solution: 'Elimine caracteres no soportados como "@", "$" o símbolos especiales.',
    };
  }

  public static unclosedString(compilationId: string, file: string, line: number, column: number): DiagnosticItem {
    return {
      id: `diag-str-${compilationId}-${line}`,
      code: 'LUMI-L002',
      severity: 'error',
      category: 'lexico',
      blocking: true,
      file,
      line,
      column,
      sourceRef: { file, line, column },
      description: 'Literal de texto (cadena) sin comillas de cierre.',
      solution: 'Asegúrese de cerrar la cadena con comillas dobles (").',
    };
  }

  public static legacyComment(compilationId: string, file: string, line: number): DiagnosticItem {
    return {
      id: `diag-comment-${compilationId}-${line}`,
      code: 'LUMI-S101',
      severity: 'warning',
      category: 'sintactico',
      blocking: false,
      file,
      line,
      column: 1,
      sourceRef: { file, line, column: 1 },
      description: 'Sintaxis obsoleta: Los comentarios en Lumi deben utilizar "--" en lugar de "//".',
      solution: 'Reemplace "//" por "--" al inicio de la línea.',
    };
  }

  public static unresolvedImport(compilationId: string, file: string, line: number, column: number, moduleName: string): DiagnosticItem {
    return {
      id: `diag-import-${compilationId}-${line}`,
      code: 'LUMI-E401',
      severity: 'error',
      category: 'importacion',
      blocking: true,
      file,
      line,
      column,
      sourceRef: { file, line, column },
      description: `No se puede resolver el módulo importado "${moduleName}". El archivo no existe en el proyecto actual.`,
      solution: `Verifique el nombre o cree el archivo "${moduleName}" en el explorador de proyectos.`,
    };
  }

  public static missingTerminator(compilationId: string, file: string, line: number, column: number, contextMsg: string): DiagnosticItem {
    return {
      id: `diag-semi-${compilationId}-${line}`,
      code: 'LUMI-S103',
      severity: 'error',
      category: 'sintactico',
      blocking: true,
      file,
      line,
      column,
      sourceRef: { file, line, column },
      description: `Falta el terminador de sentencia ">>" ${contextMsg}.`,
      solution: 'Agregue ">>" al final de la instrucción.',
    };
  }

  public static nullOperation(compilationId: string, file: string, line: number, column: number): DiagnosticItem {
    return {
      id: `diag-null-op-${compilationId}-${line}`,
      code: 'LUMI-E202',
      severity: 'error',
      category: 'semantico',
      blocking: true,
      file,
      line,
      column,
      sourceRef: { file, line, column },
      description: 'Intento de realizar una operación aritmética utilizando el valor "nulo".',
      solution: 'Verifique que la variable esté inicializada con un valor numérico antes de operarla.',
    };
  }

  public static divisionByZero(compilationId: string, file: string, line: number, column: number): DiagnosticItem {
    return {
      id: `diag-div-zero-${compilationId}-${line}`,
      code: 'LUMI-E501',
      severity: 'error',
      category: 'ejecucion',
      blocking: true,
      file,
      line,
      column,
      sourceRef: { file, line, column },
      description: 'División por cero detectada durante la evaluación de la expresión.',
      solution: 'Evite dividir por cero para garantizar la estabilidad del cálculo.',
    };
  }

  public static invalidRoomDimensions(compilationId: string, file: string, line: number, roomName: string, dims: [number, number, number]): DiagnosticItem {
    return {
      id: `diag-dim-${compilationId}-${line}`,
      code: 'LUMI-S201',
      severity: 'error',
      category: 'semantico',
      blocking: true,
      file,
      line,
      column: 1,
      sourceRef: { file, line, column: 1 },
      description: `Las dimensiones de la habitación '${roomName}' deben ser estrictamente positivas ([${dims[0]}, ${dims[1]}, ${dims[2]}]).`,
      solution: 'Asegúrese de que el ancho, largo y alto sean números mayores a cero.',
    };
  }

  public static outOfBounds(
    compilationId: string,
    file: string,
    line: number,
    objName: string,
    objId: string,
    roomName: string,
    roomId: string,
    pos: [number, number, number],
    roomHalfW: number,
    roomHalfL: number,
    objHalfW: number,
    objHalfD: number
  ): DiagnosticItem {
    return {
      id: `bound-${compilationId}-${objId}`,
      code: 'LUMI-W301',
      severity: 'error',
      category: 'espacial',
      blocking: false,
      file,
      line,
      column: 1,
      sourceRef: { file, line, column: 1 },
      description: `El objeto '${objName}' excede los límites físicos de '${roomName}' (Posición: [${pos[0]}, ${pos[1]}, ${pos[2]}], Límites habitación: X [±${roomHalfW.toFixed(1)}], Z [±${roomHalfL.toFixed(1)}]).`,
      solution: `Ajuste la coordenada X dentro de [${(-roomHalfW + objHalfW).toFixed(1)}, ${(roomHalfW - objHalfW).toFixed(1)}] m o Z en [${(-roomHalfL + objHalfD).toFixed(1)}, ${(roomHalfL - objHalfD).toFixed(1)}] m.`,
      targetObjectId: objId,
      objectId: objId,
      targetRoomId: roomId,
      roomId: roomId,
    };
  }

  public static collision(
    compilationId: string,
    file: string,
    line: number,
    objName: string,
    objId: string,
    otherName: string,
    otherId: string,
    roomId: string
  ): DiagnosticItem {
    return {
      id: `collision-${compilationId}-${objId}-${otherId}`,
      code: 'LUMI-W302',
      severity: 'warning',
      category: 'espacial',
      blocking: false,
      file,
      line,
      column: 1,
      sourceRef: { file, line, column: 1 },
      description: `Superposición espacial: '${objName}' colisiona o interfiere con '${otherName}'.`,
      solution: `Aumente la separación de coordenadas o reposicione '${objName}'.`,
      targetObjectId: objId,
      objectId: objId,
      targetRoomId: roomId,
      roomId: roomId,
    };
  }

  public static doorBlock(
    compilationId: string,
    file: string,
    line: number,
    objName: string,
    objId: string,
    doorId: string,
    doorWall: string,
    roomId: string
  ): DiagnosticItem {
    return {
      id: `door-block-${compilationId}-${objId}-${doorId}`,
      code: 'LUMI-W303',
      severity: 'warning',
      category: 'espacial',
      blocking: false,
      file,
      line,
      column: 1,
      sourceRef: { file, line, column: 1 },
      description: `Paso obstruido: El objeto '${objName}' bloquea el acceso de la puerta en el muro ${doorWall}.`,
      solution: `Mantenga una distancia libre de al menos 0.8m frente al acceso de la puerta.`,
      targetObjectId: objId,
      objectId: objId,
      targetRoomId: roomId,
      roomId: roomId,
    };
  }

  public static unclosedBraces(compilationId: string, file: string, line: number, count: number, char: string): DiagnosticItem {
    return {
      id: `syntax-braces-${compilationId}`,
      code: 'LUMI-S102',
      severity: 'error',
      category: 'sintactico',
      blocking: true,
      file,
      line,
      column: 1,
      sourceRef: { file, line, column: 1 },
      description: `Error sintáctico: Se encontraron ${count} llave(s) '${char}' sin su correspondiente cierre.`,
      solution: 'Verifique que cada bloque abierto con "{" concluya con su respectivo "}".',
    };
  }
}
