import React from 'react';
import { LumiState } from '../../types';
import { LumiBodyColors } from './lumiColors';

export interface LumiFaceProps {
  state: LumiState | string;
  bodyColors: LumiBodyColors;
}

/**
 * Renderiza los ojos expresivos y la boca de Lumi según su estado emocional/diagnóstico.
 */
export const LumiFace: React.FC<LumiFaceProps> = ({ state, bodyColors }) => {
  const isError = state === 'error';
  const isWarning = state === 'warning';
  const isCompiling = state === 'compiling';

  return (
    <g className="lumi-face">
      {isError ? (
        <path
          d="M58 54 L68 64 M68 54 L58 64"
          stroke={bodyColors.eyePupil}
          strokeWidth="3"
          strokeLinecap="round"
        />
      ) : (
        <g>
          <ellipse cx="63" cy="59" rx="5" ry="7" fill={bodyColors.eyePupil} />
          <circle cx="61" cy="56" r="2.2" fill="#ffffff" />
          <circle cx="65" cy="62" r="1.1" fill="#ffffff" />
        </g>
      )}

      {isError ? (
        <path
          d="M92 54 L102 64 M102 54 L92 64"
          stroke={bodyColors.eyePupil}
          strokeWidth="3"
          strokeLinecap="round"
        />
      ) : (
        <g>
          <ellipse cx="97" cy="59" rx="5" ry="7" fill={bodyColors.eyePupil} />
          <circle cx="95" cy="56" r="2.2" fill="#ffffff" />
          <circle cx="99" cy="62" r="1.1" fill="#ffffff" />
        </g>
      )}

      {isError ? (
        <path
          d="M72 74 Q80 67 88 74"
          stroke={bodyColors.eyePupil}
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      ) : isWarning ? (
        <ellipse cx="80" cy="72" rx="3" ry="4" fill={bodyColors.eyePupil} />
      ) : isCompiling ? (
        <path
          d="M73 70 Q80 73 87 70"
          stroke={bodyColors.eyePupil}
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <path
          d="M72 68 Q80 77 88 68"
          stroke={bodyColors.eyePupil}
          strokeWidth="2.8"
          strokeLinecap="round"
          fill="none"
        />
      )}

      <ellipse cx="52" cy="69" rx="4" ry="2.5" fill="#f43f5e" opacity="0.35" />
      <ellipse cx="108" cy="69" rx="4" ry="2.5" fill="#f43f5e" opacity="0.35" />
    </g>
  );
};
