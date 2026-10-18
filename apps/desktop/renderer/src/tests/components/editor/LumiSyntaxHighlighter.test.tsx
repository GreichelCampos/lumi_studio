import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  LumiSyntaxHighlighter,
  renderHighlightedLine,
  renderTokenSpan,
} from '../../../components/editor/LumiSyntaxHighlighter';
import { LumiSyntaxToken } from '../../../services/editor/lumiSyntaxTokenizer';

describe('LumiSyntaxHighlighter (componente visual de resaltado)', () => {
  it('debe renderizar un espacio no separable cuando la línea está vacía para conservar la altura', () => {
    const { container } = render(<LumiSyntaxHighlighter lineText="" />);
    const span = container.querySelector('span');
    expect(span).not.toBeNull();
    // &nbsp; se evalúa como el caracter \u00a0
    expect(span?.textContent).toBe('\u00a0');
  });

  it('debe renderizar comentarios completos con la variable CSS --ide-syntax-comment y clase italic', () => {
    const commentText = '-- Comentario arquitectónico de sala';
    const { container } = render(<LumiSyntaxHighlighter lineText={commentText} />);
    const span = container.querySelector('span');
    expect(span).not.toBeNull();
    expect(span?.className).toContain('italic');
    expect(span?.getAttribute('style')).toContain('--ide-syntax-comment');
    expect(span?.textContent).toBe(commentText);
  });

  it('debe renderizar comentarios inválidos (//) con advertencia visual y tooltip instructivo', () => {
    const invalidComment = '// Comentario no compatible';
    const { container } = render(<LumiSyntaxHighlighter lineText={invalidComment} />);
    const span = container.querySelector('span');
    expect(span).not.toBeNull();
    expect(span?.className).toContain('text-amber-500/80');
    expect(span?.className).toContain('decoration-wavy');
    expect(span?.getAttribute('title')).toBe('Use -- para comentarios');
  });

  it('debe renderizar palabras reservadas con --ide-syntax-keyword y font-semibold', () => {
    const { container } = render(<LumiSyntaxHighlighter lineText="habitacion Sala" />);
    const keywordSpan = Array.from(container.querySelectorAll('span')).find(
      (s) => s.textContent === 'habitacion'
    );
    expect(keywordSpan).toBeDefined();
    expect(keywordSpan?.getAttribute('style')).toContain('--ide-syntax-keyword');
    expect(keywordSpan?.className).toContain('font-semibold');
  });

  it('debe renderizar cadenas de texto con --ide-syntax-string y font-medium', () => {
    const { container } = render(<LumiSyntaxHighlighter lineText='nombre = "Principal"' />);
    const stringSpan = Array.from(container.querySelectorAll('span')).find(
      (s) => s.textContent === '"Principal"'
    );
    expect(stringSpan).toBeDefined();
    expect(stringSpan?.getAttribute('style')).toContain('--ide-syntax-string');
    expect(stringSpan?.className).toContain('font-medium');
  });

  it('debe renderizar vectores con --ide-syntax-type y font-mono', () => {
    const { container } = render(<LumiSyntaxHighlighter lineText="posicion = [1, 2, 3];" />);
    const vectorSpan = Array.from(container.querySelectorAll('span')).find(
      (s) => s.textContent === '[1, 2, 3]'
    );
    expect(vectorSpan).toBeDefined();
    expect(vectorSpan?.getAttribute('style')).toContain('--ide-syntax-type');
    expect(vectorSpan?.className).toContain('font-mono');
  });

  it('debe renderizar operadores de flujo (>>) en negrita', () => {
    const { container } = render(<LumiSyntaxHighlighter lineText="funcion fn() >> entero" />);
    const flowSpan = Array.from(container.querySelectorAll('span')).find(
      (s) => s.textContent === '>>'
    );
    expect(flowSpan).toBeDefined();
    expect(flowSpan?.getAttribute('style')).toContain('--ide-syntax-keyword');
    expect(flowSpan?.className).toContain('font-bold');
  });

  it('debe renderizar nulo con --ide-syntax-null en negrita y tracking-wide', () => {
    const { container } = render(<LumiSyntaxHighlighter lineText="valor = nulo;" />);
    const nullSpan = Array.from(container.querySelectorAll('span')).find(
      (s) => s.textContent === 'nulo'
    );
    expect(nullSpan).toBeDefined();
    expect(nullSpan?.getAttribute('style')).toContain('--ide-syntax-null');
    expect(nullSpan?.className).toContain('font-bold');
    expect(nullSpan?.className).toContain('tracking-wide');
  });

  it('debe renderizar valores booleanos con --ide-syntax-boolean', () => {
    const { container } = render(<LumiSyntaxHighlighter lineText="activo = verdadero;" />);
    const boolSpan = Array.from(container.querySelectorAll('span')).find(
      (s) => s.textContent === 'verdadero'
    );
    expect(boolSpan).toBeDefined();
    expect(boolSpan?.getAttribute('style')).toContain('--ide-syntax-boolean');
  });

  it('debe renderizar números con --ide-syntax-number', () => {
    const { container } = render(<LumiSyntaxHighlighter lineText="radio = 15.5;" />);
    const numSpan = Array.from(container.querySelectorAll('span')).find(
      (s) => s.textContent === '15.5'
    );
    expect(numSpan).toBeDefined();
    expect(numSpan?.getAttribute('style')).toContain('--ide-syntax-number');
  });

  it('debe representar caracteres especiales de forma segura sin romper el DOM ni modificar el texto', () => {
    const specialText = 'x < 10 && y > 20 || str == "A & B < C >";';
    const { container } = render(<LumiSyntaxHighlighter lineText={specialText} />);
    // El texto visible debe coincidir exactamente sin desensamblarse ni ejecutar scripts
    expect(container.textContent).toBe(specialText);
  });

  it('renderTokenSpan maneja de forma segura tokens desconocidos o lisos', () => {
    const token: LumiSyntaxToken = {
      text: '   ',
      type: 'plain',
      startIndex: 0,
      endIndex: 3,
    };
    const node = renderTokenSpan(token, 0);
    expect(node).toBe('   ');
  });
});
