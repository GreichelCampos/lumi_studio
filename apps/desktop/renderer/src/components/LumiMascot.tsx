import React, { useId } from 'react';
import { LumiState } from '../types';
import { useOptionalIdeSettings } from '../context/IdeSettingsContext';
import { LumiColorPreset } from '../types/settings';
import {
  getLumiBodyColors,
  getLumiGlowColors,
  LumiSpeechBubble,
  LumiRobotSvg,
} from './mascot';

export interface LumiMascotProps {
  state?: LumiState;
  size?: number;
  className?: string;
  isAnimated?: boolean;
  message?: string;
  onClick?: () => void;
  showSpeechBubble?: boolean;
  colorPreset?: LumiColorPreset;
}

/**
 * Componente principal de la mascota Lumi de Estudio Lumi.
 * Integra la presentación visual SVG, gestión de colores protegidos,
 * animaciones y bocadillo de diálogo.
 */
export const LumiMascot: React.FC<LumiMascotProps> = ({
  state = 'ready',
  size = 80,
  className = '',
  isAnimated = true,
  message,
  onClick,
  showSpeechBubble = false,
  colorPreset,
}) => {
  const uid = useId().replace(/:/g, '_');
  const ideContext = useOptionalIdeSettings();
  const currentTheme = ideContext?.currentTheme;
  const activePreset: LumiColorPreset = colorPreset || ideContext?.settings?.lumiColorPreset || 'theme';

  // 1. Cálculo modular de colores de cuerpo y chasis
  const bodyColors = getLumiBodyColors(activePreset, currentTheme);

  // 2. Cálculo modular de colores de resplandor (protegiendo estados semánticos)
  const colors = getLumiGlowColors(state, activePreset, currentTheme);

  return (
    <div
      className={`relative inline-flex items-center select-none ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      title={`Lumi (${state.toUpperCase()})`}
    >
      {/* Bocadillo de diálogo a la izquierda de Lumi */}
      {showSpeechBubble && message && (
        <LumiSpeechBubble message={message} />
      )}

      {/* Gráfico vectorial animado de Lumi */}
      <div className={`relative ${isAnimated ? 'animate-lumi' : ''}`}>
        <LumiRobotSvg
          size={size}
          state={state}
          uid={uid}
          colors={colors}
          bodyColors={bodyColors}
        />
      </div>
    </div>
  );
};

export default LumiMascot;
