import { describe, it, expect } from 'vitest';
import {
  tokenizeLumiLine,
  tokenizeLumiCode,
  LUMI_SYNTAX_KEYWORDS,
  LUMI_SYNTAX_TYPES,
  LUMI_SYNTAX_PROPERTIES,
  LUMI_SYNTAX_BOOLEANS,
  LUMI_SYNTAX_NULL,
} from '../../../services/editor/lumiSyntaxTokenizer';

describe('lumiSyntaxTokenizer (tokenizador visual puro)', () => {
  describe('Conservación estricta del texto original', () => {
    it('debe reconstruir exactamente el texto original al concatenar todos los tokens', () => {
      const codeSnippet = [
        '-- Inicializar entorno',
        'funcion calcularArea(ancho: decimal, largo: decimal) >> decimal {',
        '  retornar ancho * largo;',
        '}',
        '',
        'principal {',
        '  habitacion Sala [10, 12, 3] en [0, 0, 0];',
        '  colocar pared en [5, 0, 0];',
        '  si (verdadero) {',
        '    mostrar("Area calculada: " + calcularArea(10.5, 12.0));',
        '  } sino {',
        '    mostrar(nulo);',
        '  }',
        '}',
      ];

      for (const line of codeSnippet) {
        const tokens = tokenizeLumiLine(line);
        if (line === '') {
          expect(tokens).toEqual([]);
        } else {
          const reconstructed = tokens.map((t) => t.text).join('');
          expect(reconstructed).toBe(line);
        }
      }
    });

    it('debe devolver un arreglo vacío para líneas vacías', () => {
      expect(tokenizeLumiLine('')).toEqual([]);
    });

    it('debe conservar saltos de línea y cantidad de líneas con tokenizeLumiCode', () => {
      const source = 'principal {\n  colocar habitacion;\n}\n';
      const lines = tokenizeLumiCode(source);
      expect(lines).toHaveLength(4);
    });
  });

  describe('Comentarios', () => {
    it('debe clasificar una línea completa de comentario Lumi (--) como token de comentario', () => {
      const line = '-- Este es un comentario en Lumi';
      const tokens = tokenizeLumiLine(line);
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('comment');
      expect(tokens[0].text).toBe(line);
      expect(tokens[0].startIndex).toBe(0);
      expect(tokens[0].endIndex).toBe(line.length);
    });

    it('debe clasificar una línea de comentario con indentación como comentario', () => {
      const line = '    -- Comentario con 4 espacios de indentación';
      const tokens = tokenizeLumiLine(line);
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('comment');
      expect(tokens[0].text).toBe(line);
    });

    it('debe clasificar comentarios inline con --', () => {
      const line = 'colocar habitacion; -- comentario final';
      const tokens = tokenizeLumiLine(line);
      const commentToken = tokens.find((t) => t.type === 'comment');
      expect(commentToken).toBeDefined();
      expect(commentToken?.text).toBe('-- comentario final');
    });

    it('debe identificar comentarios no estándar con // y advertir sobre el uso de --', () => {
      const line = '// comentario estilo C no estándar';
      const tokens = tokenizeLumiLine(line);
      const invalidToken = tokens.find((t) => t.type === 'invalid-comment');
      expect(invalidToken).toBeDefined();
      expect(invalidToken?.text).toBe('// comentario estilo C no estándar');
      expect(invalidToken?.title).toBe('Use -- para comentarios');
    });
  });

  describe('Cadenas de texto', () => {
    it('debe clasificar cadenas entre comillas simples y dobles adecuadamente', () => {
      const line = 'mostrar("Hola Lumi", "Diseño 3D");';
      const tokens = tokenizeLumiLine(line);
      const stringTokens = tokens.filter((t) => t.type === 'string');
      expect(stringTokens).toHaveLength(2);
      expect(stringTokens[0].text).toBe('"Hola Lumi"');
      expect(stringTokens[1].text).toBe('"Diseño 3D"');
    });

    it('debe clasificar cadenas con secuencias de escape', () => {
      const line = 'mostrar("Texto con \\"comillas escapadas\\" y salto \\n");';
      const tokens = tokenizeLumiLine(line);
      const stringToken = tokens.find((t) => t.type === 'string');
      expect(stringToken).toBeDefined();
      expect(stringToken?.text).toBe('"Texto con \\"comillas escapadas\\" y salto \\n"');
    });
  });

  describe('Vectores y dimensiones espaciales', () => {
    it('debe clasificar vectores entre corchetes como tipo vector', () => {
      const line = 'colocar habitacion [10, 12, 3] en [0, 0, 0];';
      const tokens = tokenizeLumiLine(line);
      const vectorTokens = tokens.filter((t) => t.type === 'vector');
      expect(vectorTokens).toHaveLength(2);
      expect(vectorTokens[0].text).toBe('[10, 12, 3]');
      expect(vectorTokens[1].text).toBe('[0, 0, 0]');
    });
  });

  describe('Palabras reservadas canónicas de Lumi', () => {
    it('debe reconocer todas las palabras clave reservadas de LUMI_SYNTAX_KEYWORDS', () => {
      for (const keyword of LUMI_SYNTAX_KEYWORDS) {
        const line = `${keyword};`;
        const tokens = tokenizeLumiLine(line);
        const kwToken = tokens.find((t) => t.text === keyword);
        expect(kwToken).toBeDefined();
        expect(kwToken?.type).toBe('keyword');
      }
    });

    it('debe reconocer el operador de flujo >>', () => {
      const line = 'funcion f() >> entero';
      const tokens = tokenizeLumiLine(line);
      const flowToken = tokens.find((t) => t.text === '>>');
      expect(flowToken).toBeDefined();
      expect(flowToken?.type).toBe('operator-flow');
    });

    it('debe reconocer nulo con tipo null', () => {
      const line = `x = ${LUMI_SYNTAX_NULL};`;
      const tokens = tokenizeLumiLine(line);
      const nullToken = tokens.find((t) => t.text === 'nulo');
      expect(nullToken).toBeDefined();
      expect(nullToken?.type).toBe('null');
    });
  });

  describe('Tipos de datos y booleanos', () => {
    it('debe reconocer todos los tipos de datos en LUMI_SYNTAX_TYPES', () => {
      for (const tipo of LUMI_SYNTAX_TYPES) {
        const line = `variable: ${tipo};`;
        const tokens = tokenizeLumiLine(line);
        const typeToken = tokens.find((t) => t.text === tipo);
        expect(typeToken).toBeDefined();
        expect(typeToken?.type).toBe('type');
      }
    });

    it('debe reconocer los literales booleanos verdadero y falso', () => {
      for (const boolVal of LUMI_SYNTAX_BOOLEANS) {
        const line = `activo = ${boolVal};`;
        const tokens = tokenizeLumiLine(line);
        const boolToken = tokens.find((t) => t.text === boolVal);
        expect(boolToken).toBeDefined();
        expect(boolToken?.type).toBe('boolean');
      }
    });
  });

  describe('Propiedades y números', () => {
    it('debe reconocer todas las propiedades geométricas en LUMI_SYNTAX_PROPERTIES', () => {
      for (const prop of LUMI_SYNTAX_PROPERTIES) {
        const line = `objeto.${prop} = 5;`;
        const tokens = tokenizeLumiLine(line);
        const propToken = tokens.find((t) => t.text === prop);
        expect(propToken).toBeDefined();
        expect(propToken?.type).toBe('property');
      }
    });

    it('debe reconocer enteros y números decimales', () => {
      const line = 'x = 42; y = 3.1416; z = 0;';
      const tokens = tokenizeLumiLine(line);
      const numTokens = tokens.filter((t) => t.type === 'number');
      expect(numTokens).toHaveLength(3);
      expect(numTokens[0].text).toBe('42');
      expect(numTokens[1].text).toBe('3.1416');
      expect(numTokens[2].text).toBe('0');
    });
  });

  describe('Identificadores, delimitadores y casos límite', () => {
    it('debe clasificar identificadores regulares de usuario', () => {
      const line = 'miVariable_1 = calculoTemporal + 10;';
      const tokens = tokenizeLumiLine(line);
      const idTokens = tokens.filter((t) => t.type === 'identifier');
      expect(idTokens.some((t) => t.text === 'miVariable_1')).toBe(true);
      expect(idTokens.some((t) => t.text === 'calculoTemporal')).toBe(true);
    });

    it('debe manejar símbolos y operadores correctamente', () => {
      const line = '{ } ( ) ; , = + - * /';
      const tokens = tokenizeLumiLine(line);
      const textReconstructed = tokens.map((t) => t.text).join('');
      expect(textReconstructed).toBe(line);
    });

    it('no debe arrojar excepciones ante caracteres atípicos o vacíos', () => {
      expect(() => tokenizeLumiLine('   \t\t   ')).not.toThrow();
      expect(() => tokenizeLumiLine('@#$%^&')).not.toThrow();
      expect(() => tokenizeLumiCode('')).not.toThrow();
    });
  });
});
