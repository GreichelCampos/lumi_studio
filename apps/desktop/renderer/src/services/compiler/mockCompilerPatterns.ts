/**
 * Regular expressions and token patterns for Lumi simulated mock compilation.
 */
export const LUMI_PATTERNS = {
  comment: /^--/,
  legacyComment: /^\/\//,
  importStmt: /^importar\s+"([^"]+)"/,
  varDecl: /^(entero|decimal|texto|booleano|vector|lista)\s+([a-zA-Z0-9_]+)\s*=\s*(.+?)(?:>>|;)?$/,
  roomDecl: /^habitacion\s+([a-zA-Z0-9_]+)\s*\(\s*([^,)]+)\s*,\s*([^,)]+)\s*,\s*([^)]+)\s*\)/,
  floorMat: /^piso\s+material\s+([^>;]+)/,
  wallColor: /^pared\s+(norte|sur|este|oeste)\s+color\s+([^>;]+)/,
  doorBlock: /^puerta\s+en\s+(norte|sur|este|oeste)/,
  windowBlock: /^ventana\s+en\s+(norte|sur|este|oeste)/,
  placeObj: /^colocar\s+([a-zA-Z0-9_]+)\s+en\s+\[\s*([^,\]]+)\s*,\s*([^,\]]+)\s*,\s*([^\]]+)\s*\]/,
  printStmt: /^mostrar\s*\(\s*(.+?)\s*\)/,
  visualize3D: /^visualizar3D/,
  divByZero: /\/(\s*)0(?:\.0+)?(?:\b|>>)/,
};
