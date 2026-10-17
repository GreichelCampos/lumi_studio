export type IdeThemeId = 
  | 'lumi-emerald'
  | 'vs-dark'
  | 'monokai-pro'
  | 'dracula'
  | 'one-dark-pro'
  | 'tokyo-night'
  | 'solarized-dark'
  | 'vs-light';

export type GlassStyle = 'frosted' | 'subtle' | 'solid';
export type RadiusStyle = 'modern-rounded' | 'classic-vscode';
export type ActiveLineHighlight = 'glow' | 'border' | 'none';
export type AutoSaveOption = 'off' | '30s' | '60s';
export type LightingMode = 'day' | 'night' | 'studio';
export type RenderQuality = 'high' | 'balanced' | 'performance';
export type SpatialBackgroundMode = 'theme' | 'deep-dark' | 'studio-light' | 'cyber';
export type LumiColorPreset = 'theme' | 'gold' | 'blue' | 'purple' | 'emerald' | 'cyan' | 'rose';

export interface IdeThemeDefinition {
  id: IdeThemeId;
  name: string;
  category: 'dark' | 'light';
  description: string;
  previewColors: {
    bg: string;
    panel: string;
    accent: string;
    accentText: string;
    text: string;
    keyword: string;
  };
  spatialColors: {
    bg: string;
    gridCenter: string;
    gridLines: string;
  };
  cssVars: Record<string, string>;
}

export interface IdeSettings {
  theme: IdeThemeId;
  glassStyle: GlassStyle;
  radiusStyle: RadiusStyle;
  
  fontSize: number; // 12, 13, 14, 16, 18
  fontFamily: 'Fira Code' | 'JetBrains Mono' | 'Source Code Pro' | 'Consolas' | 'monospace';
  lineNumbers: boolean;
  wordWrap: boolean;
  tabSize: 2 | 4;
  activeLineHighlight: ActiveLineHighlight;
  autoSave: AutoSaveOption;

  showGrid: boolean;
  showAxes: boolean;
  showDimensions: boolean;
  lightingMode: LightingMode;
  renderQuality: RenderQuality;
  spatialBackground: SpatialBackgroundMode;

  showMascot: boolean;
  lumiColorPreset: LumiColorPreset;
  autoCompileOnType: boolean;
  soundEffects: boolean;
}

export const DEFAULT_IDE_SETTINGS: IdeSettings = {
  theme: 'lumi-emerald',
  glassStyle: 'frosted',
  radiusStyle: 'modern-rounded',
  fontSize: 13,
  fontFamily: 'Fira Code',
  lineNumbers: true,
  wordWrap: false,
  tabSize: 2,
  activeLineHighlight: 'glow',
  autoSave: 'off',
  showGrid: true,
  showAxes: true,
  showDimensions: true,
  lightingMode: 'day',
  renderQuality: 'high',
  spatialBackground: 'theme',
  showMascot: true,
  lumiColorPreset: 'theme',
  autoCompileOnType: false,
  soundEffects: true,
};

export const IDE_THEMES: IdeThemeDefinition[] = [
  {
    id: 'lumi-emerald',
    name: 'Studio Lumi (Esmeralda & Champán)',
    category: 'dark',
    description: 'Estética de cristal de lujo con verde bosque esmeralda profundo y acentos dorados champán.',
    previewColors: {
      bg: '#02110c',
      panel: '#1a422f',
      accent: '#f3ebd6',
      accentText: '#02110c',
      text: '#f5ede0',
      keyword: '#6ee7b7',
    },
    spatialColors: {
      bg: '#02110c',
      gridCenter: '#f3ebd6',
      gridLines: '#1a422f',
    },
    cssVars: {
      '--ide-bg': '#02110c',
      '--ide-panel-bg': 'rgba(26, 66, 47, 0.35)',
      '--ide-panel-solid': '#092218',
      '--ide-panel-border': 'rgba(243, 235, 214, 0.18)',
      '--ide-topbar-bg': 'rgba(4, 22, 16, 0.96)',
      '--ide-topbar-solid': '#041610',
      '--ide-control-bg': 'rgba(26, 66, 47, 0.35)',
      '--ide-text': '#f5ede0',
      '--ide-text-muted': '#b3a892',
      '--ide-accent': '#f3ebd6',
      '--ide-accent-text': '#02110c',
      '--ide-accent-bg': 'rgba(243, 235, 214, 0.15)',
      '--ide-btn-bg': 'rgba(26, 66, 47, 0.5)',
      '--ide-btn-border': 'rgba(243, 235, 214, 0.25)',
      '--ide-dropdown-bg': '#061a13',
      '--ide-syntax-keyword': '#6ee7b7',
      '--ide-syntax-type': '#93c5fd',
      '--ide-syntax-string': '#fde047',
      '--ide-syntax-number': '#f9a8d4',
      '--ide-syntax-comment': '#8ba898',
      '--ide-syntax-identifier': '#f5ede0',
      '--ide-syntax-boolean': '#f43f5e',
      '--ide-syntax-null': '#fbbf24',
      '--ide-active-line': 'rgba(243, 235, 214, 0.12)',
    },
  },
  {
    id: 'vs-dark',
    name: 'Visual Studio Dark+ (Clásico)',
    category: 'dark',
    description: 'Paleta oscura clásica con fondos carbón y azul institucional calibrada para máximo confort visual.',
    previewColors: {
      bg: '#1e1e1e',
      panel: '#252526',
      accent: '#007acc',
      accentText: '#ffffff',
      text: '#e0e0e0',
      keyword: '#569cd6',
    },
    spatialColors: {
      bg: '#1e1e1e',
      gridCenter: '#007acc',
      gridLines: '#333333',
    },
    cssVars: {
      '--ide-bg': '#1e1e1e',
      '--ide-panel-bg': 'rgba(37, 37, 38, 0.85)',
      '--ide-panel-solid': '#252526',
      '--ide-panel-border': 'rgba(255, 255, 255, 0.12)',
      '--ide-topbar-bg': 'rgba(30, 30, 30, 0.98)',
      '--ide-topbar-solid': '#2d2d2d',
      '--ide-control-bg': 'rgba(255, 255, 255, 0.06)',
      '--ide-text': '#e0e0e0',
      '--ide-text-muted': '#a6a6a6',
      '--ide-accent': '#007acc',
      '--ide-accent-text': '#ffffff',
      '--ide-accent-bg': 'rgba(0, 122, 204, 0.2)',
      '--ide-btn-bg': 'rgba(255, 255, 255, 0.08)',
      '--ide-btn-border': 'rgba(255, 255, 255, 0.15)',
      '--ide-dropdown-bg': '#252526',
      '--ide-syntax-keyword': '#569cd6',
      '--ide-syntax-type': '#4ec9b0',
      '--ide-syntax-string': '#ce9178',
      '--ide-syntax-number': '#b5cea8',
      '--ide-syntax-comment': '#7ca668',
      '--ide-syntax-identifier': '#9cdcfe',
      '--ide-syntax-boolean': '#569cd6',
      '--ide-syntax-null': '#569cd6',
      '--ide-active-line': 'rgba(255, 255, 255, 0.08)',
    },
  },
  {
    id: 'monokai-pro',
    name: 'Monokai Pro',
    category: 'dark',
    description: 'Paleta de alto contraste con tonos amarillos, magenta y cian vibrantes sobre gris carbón cálido.',
    previewColors: {
      bg: '#2d2a2e',
      panel: '#221f22',
      accent: '#ffd866',
      accentText: '#221f22',
      text: '#fcfcfa',
      keyword: '#ff6188',
    },
    spatialColors: {
      bg: '#221f22',
      gridCenter: '#ffd866',
      gridLines: '#3e3b3f',
    },
    cssVars: {
      '--ide-bg': '#2d2a2e',
      '--ide-panel-bg': 'rgba(34, 31, 34, 0.88)',
      '--ide-panel-solid': '#221f22',
      '--ide-panel-border': 'rgba(255, 216, 102, 0.18)',
      '--ide-topbar-bg': 'rgba(34, 31, 34, 0.98)',
      '--ide-topbar-solid': '#221f22',
      '--ide-control-bg': 'rgba(255, 255, 255, 0.06)',
      '--ide-text': '#fcfcfa',
      '--ide-text-muted': '#a8a6a8',
      '--ide-accent': '#ffd866',
      '--ide-accent-text': '#221f22',
      '--ide-accent-bg': 'rgba(255, 216, 102, 0.18)',
      '--ide-btn-bg': 'rgba(255, 216, 102, 0.15)',
      '--ide-btn-border': 'rgba(255, 216, 102, 0.35)',
      '--ide-dropdown-bg': '#252327',
      '--ide-syntax-keyword': '#ff6188',
      '--ide-syntax-type': '#78dce8',
      '--ide-syntax-string': '#ffd866',
      '--ide-syntax-number': '#ab9df2',
      '--ide-syntax-comment': '#8f8d91',
      '--ide-syntax-identifier': '#fcfcfa',
      '--ide-syntax-boolean': '#ff6188',
      '--ide-syntax-null': '#ab9df2',
      '--ide-active-line': 'rgba(255, 216, 102, 0.1)',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula Modern',
    category: 'dark',
    description: 'Tema con morado neón, verde cian y comentarios nítidos en periwinkle de alta legibilidad.',
    previewColors: {
      bg: '#282a36',
      panel: '#21222c',
      accent: '#bd93f9',
      accentText: '#21222c',
      text: '#f8f8f2',
      keyword: '#ff79c6',
    },
    spatialColors: {
      bg: '#21222c',
      gridCenter: '#bd93f9',
      gridLines: '#44475a',
    },
    cssVars: {
      '--ide-bg': '#282a36',
      '--ide-panel-bg': 'rgba(33, 34, 44, 0.88)',
      '--ide-panel-solid': '#21222c',
      '--ide-panel-border': 'rgba(189, 147, 249, 0.22)',
      '--ide-topbar-bg': 'rgba(33, 34, 44, 0.98)',
      '--ide-topbar-solid': '#21222c',
      '--ide-control-bg': 'rgba(255, 255, 255, 0.06)',
      '--ide-text': '#f8f8f2',
      '--ide-text-muted': '#a4b5d6',
      '--ide-accent': '#bd93f9',
      '--ide-accent-text': '#21222c',
      '--ide-accent-bg': 'rgba(189, 147, 249, 0.2)',
      '--ide-btn-bg': 'rgba(189, 147, 249, 0.18)',
      '--ide-btn-border': 'rgba(189, 147, 249, 0.4)',
      '--ide-dropdown-bg': '#242632',
      '--ide-syntax-keyword': '#ff79c6',
      '--ide-syntax-type': '#8be9fd',
      '--ide-syntax-string': '#f1fa8c',
      '--ide-syntax-number': '#bd93f9',
      '--ide-syntax-comment': '#8ea2d5',
      '--ide-syntax-identifier': '#50fa7b',
      '--ide-syntax-boolean': '#ff79c6',
      '--ide-syntax-null': '#bd93f9',
      '--ide-active-line': 'rgba(189, 147, 249, 0.12)',
    },
  },
  {
    id: 'one-dark-pro',
    name: 'One Dark Pro',
    category: 'dark',
    description: 'Armoniosa paleta oscura con balance perfecto entre colores de sintaxis y comodidad para la vista.',
    previewColors: {
      bg: '#282c34',
      panel: '#21252b',
      accent: '#61afef',
      accentText: '#1e2227',
      text: '#dcdfe4',
      keyword: '#c678dd',
    },
    spatialColors: {
      bg: '#21252b',
      gridCenter: '#61afef',
      gridLines: '#31363f',
    },
    cssVars: {
      '--ide-bg': '#282c34',
      '--ide-panel-bg': 'rgba(33, 37, 43, 0.88)',
      '--ide-panel-solid': '#21252b',
      '--ide-panel-border': 'rgba(97, 175, 239, 0.18)',
      '--ide-topbar-bg': 'rgba(33, 37, 43, 0.98)',
      '--ide-topbar-solid': '#21252b',
      '--ide-control-bg': 'rgba(255, 255, 255, 0.06)',
      '--ide-text': '#dcdfe4',
      '--ide-text-muted': '#8b97ac',
      '--ide-accent': '#61afef',
      '--ide-accent-text': '#1e2227',
      '--ide-accent-bg': 'rgba(97, 175, 239, 0.18)',
      '--ide-btn-bg': 'rgba(97, 175, 239, 0.16)',
      '--ide-btn-border': 'rgba(97, 175, 239, 0.35)',
      '--ide-dropdown-bg': '#242830',
      '--ide-syntax-keyword': '#c678dd',
      '--ide-syntax-type': '#e5c07b',
      '--ide-syntax-string': '#98c379',
      '--ide-syntax-number': '#d19a66',
      '--ide-syntax-comment': '#8897ac',
      '--ide-syntax-identifier': '#61afef',
      '--ide-syntax-boolean': '#e06c75',
      '--ide-syntax-null': '#d19a66',
      '--ide-active-line': 'rgba(97, 175, 239, 0.1)',
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    category: 'dark',
    description: 'Inspirado en la noche urbana con azul índigo profundo y elementos en neón celeste y lila.',
    previewColors: {
      bg: '#1a1b26',
      panel: '#16161e',
      accent: '#7aa2f7',
      accentText: '#13141c',
      text: '#c0caf5',
      keyword: '#bb9af7',
    },
    spatialColors: {
      bg: '#16161e',
      gridCenter: '#7aa2f7',
      gridLines: '#24283b',
    },
    cssVars: {
      '--ide-bg': '#1a1b26',
      '--ide-panel-bg': 'rgba(22, 22, 30, 0.88)',
      '--ide-panel-solid': '#16161e',
      '--ide-panel-border': 'rgba(122, 162, 247, 0.2)',
      '--ide-topbar-bg': 'rgba(22, 22, 30, 0.98)',
      '--ide-topbar-solid': '#16161e',
      '--ide-control-bg': 'rgba(255, 255, 255, 0.06)',
      '--ide-text': '#c0caf5',
      '--ide-text-muted': '#7f8bb8',
      '--ide-accent': '#7aa2f7',
      '--ide-accent-text': '#13141c',
      '--ide-accent-bg': 'rgba(122, 162, 247, 0.2)',
      '--ide-btn-bg': 'rgba(122, 162, 247, 0.16)',
      '--ide-btn-border': 'rgba(122, 162, 247, 0.35)',
      '--ide-dropdown-bg': '#1a1b26',
      '--ide-syntax-keyword': '#bb9af7',
      '--ide-syntax-type': '#2ac3de',
      '--ide-syntax-string': '#9ece6a',
      '--ide-syntax-number': '#ff9e64',
      '--ide-syntax-comment': '#7987bd',
      '--ide-syntax-identifier': '#7aa2f7',
      '--ide-syntax-boolean': '#f7768e',
      '--ide-syntax-null': '#ff9e64',
      '--ide-active-line': 'rgba(122, 162, 247, 0.12)',
    },
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    category: 'dark',
    description: 'Paleta equilibrada con cian marino y contraste optimizado para largas sesiones de codificación.',
    previewColors: {
      bg: '#002b36',
      panel: '#073642',
      accent: '#2aa198',
      accentText: '#002b36',
      text: '#eee8d5',
      keyword: '#a0c800',
    },
    spatialColors: {
      bg: '#00212b',
      gridCenter: '#2aa198',
      gridLines: '#073642',
    },
    cssVars: {
      '--ide-bg': '#002b36',
      '--ide-panel-bg': 'rgba(7, 54, 66, 0.88)',
      '--ide-panel-solid': '#073642',
      '--ide-panel-border': 'rgba(42, 161, 152, 0.22)',
      '--ide-topbar-bg': 'rgba(7, 54, 66, 0.98)',
      '--ide-topbar-solid': '#073642',
      '--ide-control-bg': 'rgba(255, 255, 255, 0.06)',
      '--ide-text': '#eee8d5',
      '--ide-text-muted': '#93a1a1',
      '--ide-accent': '#2aa198',
      '--ide-accent-text': '#002b36',
      '--ide-accent-bg': 'rgba(42, 161, 152, 0.2)',
      '--ide-btn-bg': 'rgba(42, 161, 152, 0.18)',
      '--ide-btn-border': 'rgba(42, 161, 152, 0.38)',
      '--ide-dropdown-bg': '#073642',
      '--ide-syntax-keyword': '#a0c800',
      '--ide-syntax-type': '#40a9f3',
      '--ide-syntax-string': '#35c4b8',
      '--ide-syntax-number': '#d39a00',
      '--ide-syntax-comment': '#7ea0ab',
      '--ide-syntax-identifier': '#eee8d5',
      '--ide-syntax-boolean': '#dc322f',
      '--ide-syntax-null': '#cb4b16',
      '--ide-active-line': 'rgba(42, 161, 152, 0.14)',
    },
  },
  {
    id: 'vs-light',
    name: 'Visual Studio Light+ (Modo Claro)',
    category: 'light',
    description: 'Tema claro nítido con alto contraste tipográfico para trabajar con comodidad en entornos iluminados.',
    previewColors: {
      bg: '#f5f5f7',
      panel: '#ffffff',
      accent: '#0969da',
      accentText: '#ffffff',
      text: '#1f2328',
      keyword: '#0550ae',
    },
    spatialColors: {
      bg: '#f1f5f9',
      gridCenter: '#0969da',
      gridLines: '#cbd5e1',
    },
    cssVars: {
      '--ide-bg': '#f5f5f7',
      '--ide-panel-bg': 'rgba(255, 255, 255, 0.95)',
      '--ide-panel-solid': '#ffffff',
      '--ide-panel-border': 'rgba(0, 0, 0, 0.12)',
      '--ide-topbar-bg': '#eef0f4',
      '--ide-topbar-solid': '#eef0f4',
      '--ide-control-bg': 'rgba(0, 0, 0, 0.05)',
      '--ide-text': '#1f2328',
      '--ide-text-muted': '#59636e',
      '--ide-accent': '#0969da',
      '--ide-accent-text': '#ffffff',
      '--ide-accent-bg': 'rgba(9, 105, 218, 0.1)',
      '--ide-btn-bg': 'rgba(0, 0, 0, 0.06)',
      '--ide-btn-border': 'rgba(0, 0, 0, 0.15)',
      '--ide-dropdown-bg': '#ffffff',
      '--ide-syntax-keyword': '#0550ae',
      '--ide-syntax-type': '#0e7552',
      '--ide-syntax-string': '#a31515',
      '--ide-syntax-number': '#116329',
      '--ide-syntax-comment': '#57606a',
      '--ide-syntax-identifier': '#1f2328',
      '--ide-syntax-boolean': '#cf222e',
      '--ide-syntax-null': '#953800',
      '--ide-active-line': 'rgba(9, 105, 218, 0.08)',
    },
  },
];
