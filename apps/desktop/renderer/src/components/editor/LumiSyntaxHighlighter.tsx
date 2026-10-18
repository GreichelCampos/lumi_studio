import React from 'react';
import {
  tokenizeLumiLine,
  LumiSyntaxToken,
} from '../../services/editor/lumiSyntaxTokenizer';

export interface LumiSyntaxHighlighterProps {
  lineText: string;
}

/**
 * Genera el elemento React correspondiente a un token léxico específico de Lumi.
 * Conserva estrictamente las clases CSS y variables de tema existentes.
 */
export const renderTokenSpan = (token: LumiSyntaxToken, index: number): React.ReactNode => {
  const key = `${token.startIndex}-${index}`;

  switch (token.type) {
    case 'comment':
      return (
        <span
          key={key}
          style={{ color: 'var(--ide-syntax-comment, #6d8276)' }}
          className="italic"
        >
          {token.text}
        </span>
      );

    case 'invalid-comment':
      return (
        <span
          key={key}
          className="text-amber-500/80 italic underline decoration-wavy"
          title={token.title || 'Use -- para comentarios'}
        >
          {token.text}
        </span>
      );

    case 'string':
      return (
        <span
          key={key}
          style={{ color: 'var(--ide-syntax-string, #fde68a)' }}
          className="font-medium"
        >
          {token.text}
        </span>
      );

    case 'vector':
      return (
        <span
          key={key}
          style={{ color: 'var(--ide-syntax-type, #a7d7b5)' }}
          className="font-mono"
        >
          {token.text}
        </span>
      );

    case 'operator-flow':
      return (
        <span
          key={key}
          style={{ color: 'var(--ide-syntax-keyword, #569cd6)' }}
          className="font-bold"
        >
          {token.text}
        </span>
      );

    case 'null':
      return (
        <span
          key={key}
          style={{ color: 'var(--ide-syntax-null, #fbbf24)' }}
          className="font-bold tracking-wide"
        >
          {token.text}
        </span>
      );

    case 'keyword':
      return (
        <span
          key={key}
          style={{ color: 'var(--ide-syntax-keyword, #569cd6)' }}
          className="font-semibold"
        >
          {token.text}
        </span>
      );

    case 'type':
      return (
        <span
          key={key}
          style={{ color: 'var(--ide-syntax-type, #4ec9b0)' }}
          className="font-medium"
        >
          {token.text}
        </span>
      );

    case 'boolean':
      return (
        <span
          key={key}
          style={{ color: 'var(--ide-syntax-boolean, #f43f5e)' }}
          className="font-semibold"
        >
          {token.text}
        </span>
      );

    case 'number':
      return (
        <span
          key={key}
          style={{ color: 'var(--ide-syntax-number, #b5cea8)' }}
          className="font-medium"
        >
          {token.text}
        </span>
      );

    case 'property':
      return (
        <span
          key={key}
          style={{ color: 'var(--ide-syntax-type, #4ec9b0)' }}
        >
          {token.text}
        </span>
      );

    case 'identifier':
      return (
        <span
          key={key}
          style={{ color: 'var(--ide-syntax-identifier, #dcdfe4)' }}
        >
          {token.text}
        </span>
      );

    case 'plain':
    default:
      return token.text;
  }
};

/**
 * Resalta sintácticamente una única línea de código Lumi.
 * Si la línea está vacía, devuelve un espacio no divisible para preservar el alto de la línea en el editor.
 */
export const renderHighlightedLine = (lineText: string): React.ReactNode => {
  if (!lineText) {
    return <span>&nbsp;</span>;
  }

  if (lineText.trim().startsWith('--')) {
    return (
      <span style={{ color: 'var(--ide-syntax-comment, #6d8276)' }} className="italic">
        {lineText}
      </span>
    );
  }

  const tokens = tokenizeLumiLine(lineText);
  return (
    <>
      {tokens.map((token, index) => renderTokenSpan(token, index))}
    </>
  );
};

/**
 * Componente visual de React para renderizar una línea con resaltado sintáctico de Lumi.
 */
export const LumiSyntaxHighlighter: React.FC<LumiSyntaxHighlighterProps> = ({ lineText }) => {
  return <>{renderHighlightedLine(lineText)}</>;
};
