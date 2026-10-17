import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  IdeSettings, 
  DEFAULT_IDE_SETTINGS, 
  IDE_THEMES, 
  IdeThemeId, 
  IdeThemeDefinition 
} from '../types/settings';

interface IdeSettingsContextValue {
  settings: IdeSettings;
  updateSettings: (updates: Partial<IdeSettings>) => void;
  setTheme: (themeId: IdeThemeId) => void;
  resetSettings: () => void;
  currentTheme: IdeThemeDefinition;
  availableThemes: IdeThemeDefinition[];
}

const SETTINGS_STORAGE_KEY = 'lumi_ide_settings_v2';

const IdeSettingsContext = createContext<IdeSettingsContextValue | null>(null);

export const IdeSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<IdeSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_IDE_SETTINGS, ...parsed };
      }
    } catch (err) {
      console.warn('Failed to parse IDE settings from localStorage:', err);
    }
    return DEFAULT_IDE_SETTINGS;
  });

  const currentTheme = useMemo(() => {
    return IDE_THEMES.find((t) => t.id === settings.theme) || IDE_THEMES[0];
  }, [settings.theme]);

  // Aplicar variables CSS y atributos en documentElement cuando cambian los ajustes
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme);
    root.setAttribute('data-glass', settings.glassStyle);
    root.setAttribute('data-radius', settings.radiusStyle);

    // Aplicar variables CSS del tema
    const vars = currentTheme.cssVars;
    Object.entries(vars).forEach(([key, val]) => {
      root.style.setProperty(key, String(val));
    });

    // Ajustar opacidad según modo de cristal
    if (settings.glassStyle === 'solid') {
      root.style.setProperty('--ide-backdrop-filter', 'none');
      root.style.setProperty('--ide-active-panel-bg', vars['--ide-panel-solid'] || vars['--ide-panel-bg']);
    } else if (settings.glassStyle === 'subtle') {
      root.style.setProperty('--ide-backdrop-filter', 'blur(8px)');
      root.style.setProperty('--ide-active-panel-bg', vars['--ide-panel-bg']);
    } else {
      root.style.setProperty('--ide-backdrop-filter', 'blur(20px)');
      root.style.setProperty('--ide-active-panel-bg', vars['--ide-panel-bg']);
    }

    // Radio de bordes
    if (settings.radiusStyle === 'classic-vscode') {
      root.style.setProperty('--ide-radius', '6px');
      root.style.setProperty('--ide-radius-sm', '4px');
    } else {
      root.style.setProperty('--ide-radius', '20px');
      root.style.setProperty('--ide-radius-sm', '12px');
    }

    // Persistir en localStorage
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (err) {
      console.warn('Failed to save IDE settings to localStorage:', err);
    }
  }, [settings, currentTheme]);

  const updateSettings = useCallback((updates: Partial<IdeSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const setTheme = useCallback((themeId: IdeThemeId) => {
    setSettings((prev) => ({ ...prev, theme: themeId }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_IDE_SETTINGS);
  }, []);

  const value = useMemo(
    () => ({
      settings,
      updateSettings,
      setTheme,
      resetSettings,
      currentTheme,
      availableThemes: IDE_THEMES,
    }),
    [settings, updateSettings, setTheme, resetSettings, currentTheme]
  );

  return (
    <IdeSettingsContext.Provider value={value}>
      {children}
    </IdeSettingsContext.Provider>
  );
};

export const useIdeSettings = (): IdeSettingsContextValue => {
  const context = useContext(IdeSettingsContext);
  if (!context) {
    throw new Error('useIdeSettings must be used within an IdeSettingsProvider');
  }
  return context;
};

export const useOptionalIdeSettings = (): IdeSettingsContextValue | null => {
  return useContext(IdeSettingsContext);
};
