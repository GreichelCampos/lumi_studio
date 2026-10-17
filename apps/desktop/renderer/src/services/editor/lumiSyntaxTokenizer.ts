/**
 * Tokenizador léxico visual para el lenguaje Lumi.
 * 
 * Esta utilidad pura descompone texto de código Lumi en tokens coloreables
 * para el resaltado sintáctico del editor.
 * 
 * NOTA DE ARQUITECTURA:
 * Es una función PURA sin dependencias de React, DOM ni Three.js.
 * No debe confundirse con el lexer/parser del compilador ni emplearse para
 * validación semántica o diagnósticos de compilación.
 */

export type LumiSyntaxTokenType =
  | 'comment'
  | 'invalid-comment'
  | 'string'
  | 'vector'
  | 'operator-flow'
  | 'null'
  | 'keyword'
  | 'type'
  | 'boolean'
  | 'number'
  | 'property'
  | 'identifier'
  | 'plain';

export interface LumiSyntaxToken {
  text: string;
  type: LumiSyntaxTokenType;
  startIndex: number;
  endIndex: number;
  title?: string;
}

export const LUMI_SYNTAX_KEYWORDS = [
  'principal',
  'habitacion',
  'piso',
  'pared',
  'puerta',
  'ventana',
  'colocar',
  'en',
  'rotar',
  'mover',
  'si',
  'sino',
  'segun',
  'caso',
  'defecto',
  'hacer',
  'mientras',
  'repetir',
  'funcion',
  'retornar',
  'mostrar',
  'leer',
  'visualizar3D',
  'importar',
  'usar',
] as const;

export const LUMI_SYNTAX_TYPES = [
  'entero',
  'decimal',
  'texto',
  'booleano',
  'vector',
  'lista',
  'vacio',
] as const;

export const LUMI_SYNTAX_PROPERTIES = [
  'material',
  'color',
  'ancho',
  'alto',
  'largo',
  'posicion',
] as const;

export const LUMI_SYNTAX_BOOLEANS = ['verdadero', 'falso'] as const;

export const LUMI_SYNTAX_NULL = 'nulo';

const KEYWORD_REGEX = /^(principal|habitacion|piso|pared|puerta|ventana|colocar|en|rotar|mover|si|sino|segun|caso|defecto|hacer|mientras|repetir|funcion|retornar|mostrar|leer|visualizar3D|importar|usar)$/;
const TYPE_REGEX = /^(entero|decimal|texto|booleano|vector|lista|vacio)$/;
const PROPERTY_REGEX = /^(material|color|ancho|alto|largo|posicion)$/;
const NUMBER_REGEX = /^\d+(\.\d+)?$/;

/**
 * Expresión regular canónica para escaneo de tokens de una línea de código Lumi.
 * Coincide exactamente con el escáner original de CodeEditor.tsx.
 */
export const LUMI_TOKEN_REGEX_SOURCE =
  '(--[^\\n]*|\\/\\/[^\\n]*|"(?:\\\\.|[^"\\\\])*"|\\[[^\\]]+\\]|\\b(?:principal|habitacion|piso|pared|puerta|ventana|colocar|en|rotar|mover|si|sino|segun|caso|defecto|hacer|mientras|repetir|funcion|retornar|mostrar|leer|visualizar3D|importar|usar)\\b|\\b(?:entero|decimal|texto|booleano|vector|lista|vacio)\\b|\\bnulo\\b|\\b(?:verdadero|falso)\\b|\\b\\d+(?:\\.\\d+)?\\b|>>|[{}();,=+\\-*\\/]|[a-zA-Z_][a-zA-Z0-9_]*)';

/**
 * Tokeniza una única línea de texto de código Lumi en fragmentos clasificados.
 * Garantiza que la concatenación de los textos de los tokens resultantes sea exactamente igual
 * a la cadena de entrada (conservando espacios, tabulaciones y caracteres especiales).
 */
export function tokenizeLumiLine(lineText: string): LumiSyntaxToken[] {
  if (!lineText) {
    return [];
  }

  // Comentario de línea completa que empieza por '--'
  if (lineText.trim().startsWith('--')) {
    return [
      {
        text: lineText,
        type: 'comment',
        startIndex: 0,
        endIndex: lineText.length,
      },
    ];
  }

  const tokens: LumiSyntaxToken[] = [];
  const tokenRegex = new RegExp(LUMI_TOKEN_REGEX_SOURCE, 'g');

  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = tokenRegex.exec(lineText)) !== null) {
    // Texto plano intercalado antes del token (espacios, caracteres no emparejados, etc.)
    if (match.index > lastIndex) {
      tokens.push({
        text: lineText.substring(lastIndex, match.index),
        type: 'plain',
        startIndex: lastIndex,
        endIndex: match.index,
      });
    }

    const token = match[0];
    const startIndex = match.index;
    const endIndex = startIndex + token.length;

    let type: LumiSyntaxTokenType = 'identifier';
    let title: string | undefined;

    if (token.startsWith('--')) {
      type = 'comment';
    } else if (token.startsWith('//')) {
      type = 'invalid-comment';
      title = 'Use -- para comentarios';
    } else if (token.startsWith('"')) {
      type = 'string';
    } else if (token.startsWith('[')) {
      type = 'vector';
    } else if (token === '>>') {
      type = 'operator-flow';
    } else if (token === LUMI_SYNTAX_NULL) {
      type = 'null';
    } else if (KEYWORD_REGEX.test(token)) {
      type = 'keyword';
    } else if (TYPE_REGEX.test(token)) {
      type = 'type';
    } else if (token === 'verdadero' || token === 'falso') {
      type = 'boolean';
    } else if (NUMBER_REGEX.test(token)) {
      type = 'number';
    } else if (PROPERTY_REGEX.test(token)) {
      type = 'property';
    } else {
      type = 'identifier';
    }

    tokens.push({
      text: token,
      type,
      startIndex,
      endIndex,
      ...(title ? { title } : {}),
    });

    lastIndex = tokenRegex.lastIndex;
  }

  // Texto plano residual al final de la línea
  if (lastIndex < lineText.length) {
    tokens.push({
      text: lineText.substring(lastIndex),
      type: 'plain',
      startIndex: lastIndex,
      endIndex: lineText.length,
    });
  }

  return tokens;
}

/**
 * Tokeniza un bloque completo de código Lumi dividiéndolo en líneas.
 */
export function tokenizeLumiCode(code: string): LumiSyntaxToken[][] {
  if (!code) {
    return [[]];
  }
  return code.split('\n').map(tokenizeLumiLine);
}
