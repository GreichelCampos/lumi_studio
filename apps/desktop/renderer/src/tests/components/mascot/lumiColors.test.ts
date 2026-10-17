import { describe, it, expect } from 'vitest';
import {
  getLumiGlowColors,
  getLumiBodyColors,
  LUMI_SEMANTIC_PALETTES,
  LUMI_DECORATIVE_PRESETS,
  LUMI_DEFAULT_EMERALD_PALETTE,
} from '../../../components/mascot/lumiColors';
import { IDE_THEMES, IdeThemeDefinition, LumiColorPreset } from '../../../types/settings';

describe('Protección de Identidad Visual y Colores Semánticos de Lumi (Fase 2B)', () => {
  const allThemes: IdeThemeDefinition[] = IDE_THEMES;
  const decorativePresets: LumiColorPreset[] = ['blue', 'purple', 'emerald', 'cyan', 'rose', 'gold'];

  describe('Regla Fundamental: Inviolabilidad de Colores Semánticos frente a Temas del IDE', () => {
    it('el estado "error" debe mantener SIEMPRE su paleta semántica roja, sin importar el tema del IDE', () => {
      allThemes.forEach((theme) => {
        const colors = getLumiGlowColors('error', 'theme', theme);
        expect(colors.glow).toBe(LUMI_SEMANTIC_PALETTES.error.glow);
        expect(colors.shade).toBe(LUMI_SEMANTIC_PALETTES.error.shade);
        expect(colors.core).toBe(LUMI_SEMANTIC_PALETTES.error.core);
        expect(colors.rim).toBe(LUMI_SEMANTIC_PALETTES.error.rim);
        expect(colors.pulseClass).toBe('glow-lumi-red');
      });
    });

    it('el estado "warning" debe mantener SIEMPRE su paleta semántica amarilla/ámbar, sin importar el tema del IDE', () => {
      allThemes.forEach((theme) => {
        const colors = getLumiGlowColors('warning', 'theme', theme);
        expect(colors.glow).toBe(LUMI_SEMANTIC_PALETTES.warning.glow);
        expect(colors.shade).toBe(LUMI_SEMANTIC_PALETTES.warning.shade);
        expect(colors.core).toBe(LUMI_SEMANTIC_PALETTES.warning.core);
        expect(colors.rim).toBe(LUMI_SEMANTIC_PALETTES.warning.rim);
        expect(colors.pulseClass).toBe('glow-lumi-yellow');
      });
    });

    it('el estado "compiling" debe mantener SIEMPRE su paleta semántica púrpura, sin importar el tema del IDE', () => {
      allThemes.forEach((theme) => {
        const colors = getLumiGlowColors('compiling', 'theme', theme);
        expect(colors.glow).toBe(LUMI_SEMANTIC_PALETTES.compiling.glow);
        expect(colors.shade).toBe(LUMI_SEMANTIC_PALETTES.compiling.shade);
        expect(colors.core).toBe(LUMI_SEMANTIC_PALETTES.compiling.core);
        expect(colors.rim).toBe(LUMI_SEMANTIC_PALETTES.compiling.rim);
        expect(colors.pulseClass).toBe('glow-lumi-purple');
      });
    });
  });

  describe('Regla Fundamental: Inviolabilidad de Colores Semánticos frente a Presets Decorativos', () => {
    it('ningún preset decorativo de usuario puede anular el color de un "error"', () => {
      decorativePresets.forEach((preset) => {
        const colors = getLumiGlowColors('error', preset, allThemes[0]);
        expect(colors.glow).toBe(LUMI_SEMANTIC_PALETTES.error.glow);
        expect(colors.shade).toBe(LUMI_SEMANTIC_PALETTES.error.shade);
        expect(colors.pulseClass).toBe('glow-lumi-red');
      });
    });

    it('ningún preset decorativo de usuario puede anular el color de una advertencia "warning"', () => {
      decorativePresets.forEach((preset) => {
        const colors = getLumiGlowColors('warning', preset, allThemes[0]);
        expect(colors.glow).toBe(LUMI_SEMANTIC_PALETTES.warning.glow);
        expect(colors.shade).toBe(LUMI_SEMANTIC_PALETTES.warning.shade);
        expect(colors.pulseClass).toBe('glow-lumi-yellow');
      });
    });

    it('ningún preset decorativo de usuario puede anular el color del estado "compiling"', () => {
      decorativePresets.forEach((preset) => {
        const colors = getLumiGlowColors('compiling', preset, allThemes[0]);
        expect(colors.glow).toBe(LUMI_SEMANTIC_PALETTES.compiling.glow);
        expect(colors.shade).toBe(LUMI_SEMANTIC_PALETTES.compiling.shade);
        expect(colors.pulseClass).toBe('glow-lumi-purple');
      });
    });
  });

  describe('Comportamiento de Estados Base y Presets Decorativos (ready / success)', () => {
    it('en el tema predeterminado lumi-emerald y preset "theme", debe aplicar la paleta verde esmeralda', () => {
      const defaultTheme = allThemes.find((t) => t.id === 'lumi-emerald');
      const colors = getLumiGlowColors('ready', 'theme', defaultTheme);
      expect(colors.glow).toBe(LUMI_DEFAULT_EMERALD_PALETTE.glow);
      expect(colors.shade).toBe(LUMI_DEFAULT_EMERALD_PALETTE.shade);
      expect(colors.core).toBe(LUMI_DEFAULT_EMERALD_PALETTE.core);
      expect(colors.pulseClass).toBe('glow-lumi-green');
    });

    it('en estado "success" sin preset específico, debe seguir la misma base armónica que "ready"', () => {
      const defaultTheme = allThemes.find((t) => t.id === 'lumi-emerald');
      const colors = getLumiGlowColors('success', 'theme', defaultTheme);
      expect(colors.shade).toBe(LUMI_DEFAULT_EMERALD_PALETTE.shade);
    });

    it('los presets decorativos solo modifican estados normales ("ready", "success")', () => {
      const blueColors = getLumiGlowColors('ready', 'blue');
      expect(blueColors.shade).toBe(LUMI_DECORATIVE_PRESETS.blue.shade);
      expect(blueColors.pulseClass).toBe('glow-lumi-blue');

      const purpleColors = getLumiGlowColors('ready', 'purple');
      expect(purpleColors.shade).toBe(LUMI_DECORATIVE_PRESETS.purple.shade);
      expect(purpleColors.pulseClass).toBe('glow-lumi-purple');
    });

    it('getLumiBodyColors respeta los contrastes de tema claro (light mode)', () => {
      const lightTheme = allThemes.find((t) => t.category === 'light');
      const body = getLumiBodyColors('theme', lightTheme);
      expect(body.stop0).toBe('#f8fafc');
      expect(body.chestBase).toBe('#ffffff');
    });

    it('getLumiBodyColors respeta el tema predeterminado oscuro lumi-emerald', () => {
      const emeraldTheme = allThemes.find((t) => t.id === 'lumi-emerald');
      const body = getLumiBodyColors('theme', emeraldTheme);
      expect(body.stroke).toBe('#10b981');
      expect(body.footFill).toBe('#082016');
    });
  });
});
