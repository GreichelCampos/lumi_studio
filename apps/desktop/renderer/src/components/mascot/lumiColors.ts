import { LumiState } from '../../types';
import { LumiColorPreset, IdeThemeDefinition } from '../../types/settings';

/**
 * Paleta de colores para la lámpara, resplandor y acentos del personaje Lumi.
 */
export interface LumiGlowColors {
  glow: string;
  shade: string;
  shadeLight: string;
  core: string;
  rim: string;
  rimStop0: string;
  rimStop50: string;
  rimStop100: string;
  pulseClass: string;
}

/**
 * Paleta de colores del cuerpo metálico, extremidades y ojos del robot Lumi.
 */
export interface LumiBodyColors {
  stop0: string;
  stop50: string;
  stop100: string;
  stroke: string;
  footFill: string;
  armFill: string;
  chestBase: string;
  eyePupil: string;
}

/**
 * Definición inmutable de los colores semánticos protegidos de Lumi.
 * REGLA FUNDAMENTAL: Los estados de funcionamiento ('compiling', 'warning', 'error')
 * NO pueden ser alterados por el tema del IDE ni por presets decorativos.
 */
export const LUMI_SEMANTIC_PALETTES: Record<'compiling' | 'warning' | 'error', LumiGlowColors> = {
  compiling: {
    glow: 'rgba(168, 85, 247, 0.85)',
    shade: '#d8b4fe',
    shadeLight: '#f3e8ff',
    core: '#c084fc',
    rim: '#9333ea',
    rimStop0: '#a855f7',
    rimStop50: '#7e22ce',
    rimStop100: '#581c87',
    pulseClass: 'glow-lumi-purple',
  },
  warning: {
    glow: 'rgba(234, 179, 8, 0.85)',
    shade: '#fde047',
    shadeLight: '#fef9c3',
    core: '#facc15',
    rim: '#ca8a04',
    rimStop0: '#eab308',
    rimStop50: '#a16207',
    rimStop100: '#713f12',
    pulseClass: 'glow-lumi-yellow',
  },
  error: {
    glow: 'rgba(239, 68, 68, 0.9)',
    shade: '#fca5a5',
    shadeLight: '#fef2f2',
    core: '#f87171',
    rim: '#dc2626',
    rimStop0: '#ef4444',
    rimStop50: '#b91c1c',
    rimStop100: '#7f1d1d',
    pulseClass: 'glow-lumi-red',
  },
};

/**
 * Presets decorativos de color cuando el estado es 'ready' o 'success'.
 */
export const LUMI_DECORATIVE_PRESETS: Record<Exclude<LumiColorPreset, 'theme'>, LumiGlowColors> = {
  blue: {
    glow: 'rgba(0, 122, 204, 0.85)',
    shade: '#007acc',
    shadeLight: '#bae6fd',
    core: '#38bdf8',
    rim: '#0284c7',
    rimStop0: '#007acc',
    rimStop50: '#0369a1',
    rimStop100: '#075985',
    pulseClass: 'glow-lumi-blue',
  },
  purple: {
    glow: 'rgba(189, 147, 249, 0.85)',
    shade: '#bd93f9',
    shadeLight: '#f3e8ff',
    core: '#c084fc',
    rim: '#9333ea',
    rimStop0: '#bd93f9',
    rimStop50: '#9333ea',
    rimStop100: '#6b21a8',
    pulseClass: 'glow-lumi-purple',
  },
  emerald: {
    glow: 'rgba(16, 185, 129, 0.85)',
    shade: '#10b981',
    shadeLight: '#d1fae5',
    core: '#34d399',
    rim: '#059669',
    rimStop0: '#10b981',
    rimStop50: '#047857',
    rimStop100: '#064e3b',
    pulseClass: 'glow-lumi-green',
  },
  cyan: {
    glow: 'rgba(6, 182, 212, 0.85)',
    shade: '#06b6d4',
    shadeLight: '#cffafe',
    core: '#22d3ee',
    rim: '#0891b2',
    rimStop0: '#06b6d4',
    rimStop50: '#0e7490',
    rimStop100: '#155e75',
    pulseClass: 'glow-lumi-cyan',
  },
  rose: {
    glow: 'rgba(244, 63, 94, 0.85)',
    shade: '#f43f5e',
    shadeLight: '#ffe4e6',
    core: '#fb7185',
    rim: '#e11d48',
    rimStop0: '#f43f5e',
    rimStop50: '#be123c',
    rimStop100: '#881337',
    pulseClass: 'glow-lumi-red',
  },
  gold: {
    glow: 'rgba(245, 158, 11, 0.85)',
    shade: '#f59e0b',
    shadeLight: '#fef3c7',
    core: '#fde68a',
    rim: '#d97706',
    rimStop0: '#f59e0b',
    rimStop50: '#b45309',
    rimStop100: '#78350f',
    pulseClass: 'glow-lumi-yellow',
  },
};

/**
 * Paleta por defecto para temas del IDE en estado base ('ready'/'success')
 */
export const LUMI_DEFAULT_EMERALD_PALETTE: LumiGlowColors = {
  glow: 'rgba(16, 185, 129, 0.85)',
  shade: '#10b981',
  shadeLight: '#d1fae5',
  core: '#34d399',
  rim: '#059669',
  rimStop0: '#10b981',
  rimStop50: '#047857',
  rimStop100: '#064e3b',
  pulseClass: 'glow-lumi-green',
};

/**
 * Resuelve la paleta de brillo y lámpara base vinculada al tema seleccionado
 */
export function getThemeBaseColors(themeId: string = 'lumi-emerald'): LumiGlowColors {
  switch (themeId) {
    case 'vs-dark':
      return {
        glow: 'rgba(0, 122, 204, 0.85)',
        shade: '#007acc',
        shadeLight: '#bae6fd',
        core: '#38bdf8',
        rim: '#0284c7',
        rimStop0: '#007acc',
        rimStop50: '#0369a1',
        rimStop100: '#075985',
        pulseClass: 'glow-lumi-blue',
      };
    case 'vs-light':
      return {
        glow: 'rgba(9, 105, 218, 0.75)',
        shade: '#0969da',
        shadeLight: '#ddf4ff',
        core: '#0969da',
        rim: '#044289',
        rimStop0: '#0969da',
        rimStop50: '#0550ae',
        rimStop100: '#043673',
        pulseClass: 'glow-lumi-blue',
      };
    case 'monokai-pro':
      return {
        glow: 'rgba(255, 216, 102, 0.85)',
        shade: '#ffd866',
        shadeLight: '#fff2cc',
        core: '#ffd866',
        rim: '#e5b842',
        rimStop0: '#ffd866',
        rimStop50: '#cca633',
        rimStop100: '#806619',
        pulseClass: 'glow-lumi-yellow',
      };
    case 'dracula':
      return {
        glow: 'rgba(189, 147, 249, 0.85)',
        shade: '#bd93f9',
        shadeLight: '#f3e8ff',
        core: '#bd93f9',
        rim: '#8257e5',
        rimStop0: '#bd93f9',
        rimStop50: '#7e22ce',
        rimStop100: '#581c87',
        pulseClass: 'glow-lumi-purple',
      };
    case 'one-dark-pro':
      return {
        glow: 'rgba(97, 175, 239, 0.85)',
        shade: '#61afef',
        shadeLight: '#dbeafe',
        core: '#61afef',
        rim: '#3b82f6',
        rimStop0: '#61afef',
        rimStop50: '#2563eb',
        rimStop100: '#1d4ed8',
        pulseClass: 'glow-lumi-blue',
      };
    case 'tokyo-night':
      return {
        glow: 'rgba(122, 162, 247, 0.85)',
        shade: '#7aa2f7',
        shadeLight: '#e0e7ff',
        core: '#7aa2f7',
        rim: '#4f46e5',
        rimStop0: '#7aa2f7',
        rimStop50: '#4f46e5',
        rimStop100: '#3730a3',
        pulseClass: 'glow-lumi-blue',
      };
    case 'solarized-dark':
      return {
        glow: 'rgba(42, 161, 152, 0.85)',
        shade: '#2aa198',
        shadeLight: '#ccfbf1',
        core: '#2aa198',
        rim: '#0f766e',
        rimStop0: '#2aa198',
        rimStop50: '#0f766e',
        rimStop100: '#115e59',
        pulseClass: 'glow-lumi-cyan',
      };
    case 'lumi-emerald':
    default:
      return LUMI_DEFAULT_EMERALD_PALETTE;
  }
}

/**
 * Calcula los colores de la pantalla/resplandor asegurando la protección
 * absoluta de los estados semánticos (compiling, warning, error).
 */
export function getLumiGlowColors(
  state: LumiState | string = 'ready',
  activePreset: LumiColorPreset = 'theme',
  currentTheme?: IdeThemeDefinition
): LumiGlowColors {
  // 1. REGLA FUNDAMENTAL: Estados semánticos protegidos
  if (state === 'compiling' || state === 'warning' || state === 'error') {
    return LUMI_SEMANTIC_PALETTES[state];
  }

  // 2. Presets decorativos de usuario (para estados normales ready / success)
  if (activePreset !== 'theme' && activePreset in LUMI_DECORATIVE_PRESETS) {
    return LUMI_DECORATIVE_PRESETS[activePreset as keyof typeof LUMI_DECORATIVE_PRESETS];
  }

  // 3. Tema del IDE sincronizado para estados normales
  const themeId = currentTheme?.id || 'lumi-emerald';
  return getThemeBaseColors(themeId);
}

/**
 * Calcula los colores del chasis/cuerpo metálico del robot.
 */
export function getLumiBodyColors(
  activePreset: LumiColorPreset = 'theme',
  currentTheme?: IdeThemeDefinition
): LumiBodyColors {
  const isLightMode = currentTheme?.category === 'light';

  if (isLightMode) {
    return {
      stop0: '#f8fafc',
      stop50: '#e2e8f0',
      stop100: '#cbd5e1',
      stroke: activePreset === 'blue' || (activePreset === 'theme' && currentTheme?.id === 'vs-light') ? '#0969da' : '#94a3b8',
      footFill: '#e2e8f0',
      armFill: '#e2e8f0',
      chestBase: '#ffffff',
      eyePupil: '#0f172a',
    };
  }

  // Overrides específicos según preset decorativo en dark mode
  if (activePreset === 'blue') {
    return {
      stop0: '#253347',
      stop50: '#182232',
      stop100: '#0f172a',
      stroke: '#0284c7',
      footFill: '#1e293b',
      armFill: '#1e293b',
      chestBase: '#0f172a',
      eyePupil: '#0f172a',
    };
  }
  if (activePreset === 'purple') {
    return {
      stop0: '#3b1d54',
      stop50: '#261038',
      stop100: '#170624',
      stroke: '#9333ea',
      footFill: '#2e1065',
      armFill: '#2e1065',
      chestBase: '#190b28',
      eyePupil: '#0f172a',
    };
  }
  if (activePreset === 'rose') {
    return {
      stop0: '#4c1122',
      stop50: '#330714',
      stop100: '#1f040b',
      stroke: '#e11d48',
      footFill: '#3f0713',
      armFill: '#3f0713',
      chestBase: '#25020a',
      eyePupil: '#0f172a',
    };
  }
  if (activePreset === 'cyan') {
    return {
      stop0: '#12384a',
      stop50: '#082736',
      stop100: '#031722',
      stroke: '#0891b2',
      footFill: '#0a2e3f',
      armFill: '#0a2e3f',
      chestBase: '#02141f',
      eyePupil: '#0f172a',
    };
  }
  if (activePreset === 'gold') {
    return {
      stop0: '#383222',
      stop50: '#262113',
      stop100: '#171309',
      stroke: '#d97706',
      footFill: '#262113',
      armFill: '#262113',
      chestBase: '#141006',
      eyePupil: '#0f172a',
    };
  }
  if (activePreset === 'emerald') {
    return {
      stop0: '#1a422f',
      stop50: '#082016',
      stop100: '#02110c',
      stroke: '#059669',
      footFill: '#082016',
      armFill: '#082016',
      chestBase: '#02110c',
      eyePupil: '#0f172a',
    };
  }

  // Estilos de cuerpo derivados del tema del IDE
  const themeId = currentTheme?.id || 'lumi-emerald';
  switch (themeId) {
    case 'vs-dark':
      return {
        stop0: '#333333',
        stop50: '#252526',
        stop100: '#181818',
        stroke: '#007acc',
        footFill: '#252526',
        armFill: '#252526',
        chestBase: '#181818',
        eyePupil: '#0f172a',
      };
    case 'dracula':
      return {
        stop0: '#44475a',
        stop50: '#282a36',
        stop100: '#191a21',
        stroke: '#bd93f9',
        footFill: '#282a36',
        armFill: '#282a36',
        chestBase: '#191a21',
        eyePupil: '#0f172a',
      };
    case 'monokai-pro':
      return {
        stop0: '#403e41',
        stop50: '#2d2a2e',
        stop100: '#1e1c1f',
        stroke: '#ffd866',
        footFill: '#2d2a2e',
        armFill: '#2d2a2e',
        chestBase: '#1e1c1f',
        eyePupil: '#0f172a',
      };
    case 'one-dark-pro':
      return {
        stop0: '#353b45',
        stop50: '#282c34',
        stop100: '#1b1d23',
        stroke: '#61afef',
        footFill: '#282c34',
        armFill: '#282c34',
        chestBase: '#1b1d23',
        eyePupil: '#0f172a',
      };
    case 'tokyo-night':
      return {
        stop0: '#292e42',
        stop50: '#1a1b26',
        stop100: '#13141c',
        stroke: '#7aa2f7',
        footFill: '#1a1b26',
        armFill: '#1a1b26',
        chestBase: '#13141c',
        eyePupil: '#0f172a',
      };
    case 'solarized-dark':
      return {
        stop0: '#073642',
        stop50: '#002b36',
        stop100: '#001e26',
        stroke: '#2aa198',
        footFill: '#002b36',
        armFill: '#002b36',
        chestBase: '#001e26',
        eyePupil: '#0f172a',
      };
    case 'lumi-emerald':
    default:
      return {
        stop0: '#1a422f',
        stop50: '#082016',
        stop100: '#02110c',
        stroke: '#10b981',
        footFill: '#082016',
        armFill: '#082016',
        chestBase: '#02110c',
        eyePupil: '#0f172a',
      };
  }
}
