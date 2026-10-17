/**
 * SpatialVisualTheme.ts
 * Centralized theme and color tokens for 3D spatial visualization and entity states.
 */

export interface EntityVisualState {
  isSelected: boolean;
  hasError: boolean;
  hasWarning: boolean;
  isCurrentDebugStep?: boolean;
}

export const SPATIAL_THEME = {
  // Base Scene Colors
  background: {
    day: '#02110c',     // Dark Emerald Green (#02110c)
    evening: '#031912',
    cyber: '#010a07',
  },
  grid: {
    center: '#f3ebd6',  // Cream Beige primary center lines
    lines: '#1a422f',   // Olive Green / Forest Emerald grid lines
  },
  axes: {
    x: '#ef4444',       // Red (Eje X: Ancho)
    z: '#22c55e',       // Green (Eje Z: Largo)
    origin: '#f3ebd6',  // Cream Beige Origin Marker
  },
  walls: {
    solidOpacity: 0.95,
    occludedOpacity: 0.22, // Dynamic transparency for walls facing camera
    wireframeColor: '#1a422f',
  },
  dimensions: {
    line: '#f3ebd6',
    text: '#f3ebd6',
  },

  // Entity States
  states: {
    normal: {
      outlineColor: '#1a422f',
      ringColor: '#f3ebd6',
      ringOpacity: 0.25,
      emissive: '#000000',
      emissiveIntensity: 0,
    },
    selected: {
      outlineColor: '#f3ebd6',
      ringColor: '#f3ebd6',
      ringOpacity: 0.75,
      emissive: '#1a422f',
      emissiveIntensity: 0.35,
    },
    warning: {
      outlineColor: '#f59e0b',
      ringColor: '#f59e0b',
      ringOpacity: 0.5,
      emissive: '#451a03',
      emissiveIntensity: 0.2,
    },
    error: {
      outlineColor: '#ef4444',
      ringColor: '#ef4444',
      ringOpacity: 0.7,
      emissive: '#450a0a',
      emissiveIntensity: 0.35,
    },
    activeDebug: {
      outlineColor: '#f3ebd6',
      ringColor: '#d8b4fe',
      ringOpacity: 0.8,
      emissive: '#1a422f',
      emissiveIntensity: 0.45,
    },
  },

  // Color lookup for Lumi wall & furniture named colors
  namedColors: {
    blanco: '#f3ebd6',  // Warm cream white
    crema: '#f3ebd6',   // Cream beige
    beige: '#f3ebd6',   // Cream beige
    gris: '#8f9d95',
    azul: '#1e3a8a',
    negro: '#02110c',   // Dark emerald black
    verde: '#1a422f',   // Olive forest green
    esmeralda: '#1a422f',
    oliva: '#1a422f',
    rojo: '#991b1b',
    madera: '#78350f',
    nogal: '#451a03',
    amarillo: '#eab308',
    cyan: '#a7f3d0',
    naranja: '#ea580c',
    purpura: '#7e22ce',
    metal: '#64748b',
  } as Record<string, string>,
};

/**
 * Returns hex color string for a named Lumi color or returns the input as fallback
 */
export function resolveLumiColor(colorName?: string, defaultColor = '#64748b'): string {
  if (!colorName) return defaultColor;
  const clean = colorName.trim().toLowerCase();
  return SPATIAL_THEME.namedColors[clean] || (colorName.startsWith('#') ? colorName : defaultColor);
}

/**
 * Updates SPATIAL_THEME object tokens dynamically when IDE theme or spatial mode changes
 */
export function applyIdeThemeToSpatialTheme(
  accentColor: string,
  bgColor: string,
  gridCenter: string,
  gridLines: string,
  isLightMode: boolean
): void {
  SPATIAL_THEME.background.day = bgColor;
  SPATIAL_THEME.grid.center = gridCenter;
  SPATIAL_THEME.grid.lines = gridLines;
  SPATIAL_THEME.dimensions.line = isLightMode ? '#64748b' : accentColor;
  SPATIAL_THEME.dimensions.text = isLightMode ? '#0f172a' : accentColor;
  SPATIAL_THEME.axes.origin = accentColor;

  SPATIAL_THEME.states.normal.outlineColor = gridLines;
  SPATIAL_THEME.states.selected.outlineColor = accentColor;
  SPATIAL_THEME.states.selected.ringColor = accentColor;
  SPATIAL_THEME.states.selected.emissive = isLightMode ? '#f1f5f9' : gridLines;
  SPATIAL_THEME.states.activeDebug.outlineColor = accentColor;
}

