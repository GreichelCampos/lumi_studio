import React from 'react';
import { LumiState } from '../../types';
import { LumiBodyColors, LumiGlowColors } from './lumiColors';
import { LumiFace } from './LumiFace';

export interface LumiRobotSvgProps {
  size: number;
  state: LumiState | string;
  uid: string;
  colors: LumiGlowColors;
  bodyColors: LumiBodyColors;
}

/**
 * Gráfico vectorial SVG de alta fidelidad que define la estructura física y luminosa del robot Lumi.
 */
export const LumiRobotSvg: React.FC<LumiRobotSvgProps> = ({
  size,
  state,
  uid,
  colors,
  bodyColors,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-all duration-500 ${colors.pulseClass}`}
    >
      <defs>
        <linearGradient
          id={`lampGrad-${state}-${uid}`}
          x1="80"
          y1="20"
          x2="80"
          y2="95"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={colors.shadeLight} stopOpacity="1" />
          <stop offset="70%" stopColor={colors.shade} stopOpacity="0.95" />
          <stop offset="100%" stopColor={colors.core} stopOpacity="0.9" />
        </linearGradient>

        <linearGradient
          id={`bodyGrad-${uid}`}
          x1="80"
          y1="90"
          x2="80"
          y2="165"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={bodyColors.stop0} />
          <stop offset="50%" stopColor={bodyColors.stop50} />
          <stop offset="100%" stopColor={bodyColors.stop100} />
        </linearGradient>

        <linearGradient
          id={`rimGrad-${state}-${uid}`}
          x1="40"
          y1="92"
          x2="120"
          y2="98"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={colors.rimStop0} />
          <stop offset="50%" stopColor={colors.rimStop50} />
          <stop offset="100%" stopColor={colors.rimStop100} />
        </linearGradient>

        <filter
          id={`coreGlow-${state}-${uid}`}
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <ellipse
        cx="80"
        cy="55"
        rx="42"
        ry="36"
        fill={colors.glow}
        opacity="0.4"
        filter={`url(#coreGlow-${state}-${uid})`}
      />

      <ellipse
        cx="56"
        cy="158"
        rx="14"
        ry="9"
        fill={bodyColors.footFill}
        stroke={bodyColors.stroke}
        strokeWidth="2"
      />
      <ellipse
        cx="56"
        cy="158"
        rx="8"
        ry="4"
        fill={colors.core}
        filter={`url(#coreGlow-${state}-${uid})`}
      />

      <ellipse
        cx="104"
        cy="158"
        rx="14"
        ry="9"
        fill={bodyColors.footFill}
        stroke={bodyColors.stroke}
        strokeWidth="2"
      />
      <ellipse
        cx="104"
        cy="158"
        rx="8"
        ry="4"
        fill={colors.core}
        filter={`url(#coreGlow-${state}-${uid})`}
      />

      <path
        d="M50 105 C40 120 42 152 60 156 C70 158 90 158 100 156 C118 152 120 120 110 105 Z"
        fill={`url(#bodyGrad-${uid})`}
        stroke={bodyColors.stroke}
        strokeWidth="2.5"
      />

      <circle
        cx="80"
        cy="130"
        r="14"
        fill={bodyColors.chestBase}
        stroke={bodyColors.stroke}
        strokeWidth="2"
      />
      <circle cx="80" cy="130" r="10" fill={colors.core} opacity="0.4" />

      <path
        d="M74 126 L70 130 L74 134 M86 126 L90 130 L86 134 M82 124 L78 136"
        stroke={colors.core}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#coreGlow-${state}-${uid})`}
      />

      <path
        d="M48 114 C36 122 36 138 48 144 C52 140 50 122 54 118 Z"
        fill={bodyColors.armFill}
        stroke={bodyColors.stroke}
        strokeWidth="1.5"
      />
      <path
        d="M112 114 C124 122 124 138 112 144 C108 140 110 122 106 118 Z"
        fill={bodyColors.armFill}
        stroke={bodyColors.stroke}
        strokeWidth="1.5"
      />

      <ellipse
        cx="80"
        cy="94"
        rx="46"
        ry="10"
        fill={`url(#rimGrad-${state}-${uid})`}
        stroke={colors.rim}
        strokeWidth="2"
      />

      <path
        d="M50 25 C62 21 98 21 110 25 C122 56 126 84 124 94 C110 99 50 99 36 94 C34 84 38 56 50 25 Z"
        fill={`url(#lampGrad-${state}-${uid})`}
        stroke={colors.shade}
        strokeWidth="2"
      />

      <ellipse
        cx="80"
        cy="25"
        rx="30"
        ry="7"
        fill={colors.shadeLight}
        stroke={colors.shade}
        strokeWidth="1.5"
      />
      <ellipse cx="80" cy="25" rx="20" ry="4" fill={colors.core} opacity="0.4" />

      <LumiFace state={state} bodyColors={bodyColors} />
    </svg>
  );
};
