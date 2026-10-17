import React from 'react';
import { useIdeSettings } from '../../../context/IdeSettingsContext';
import { Palette, Check } from 'lucide-react';
import { GlassStyle, RadiusStyle } from '../../../types/settings';

export const AppearanceTab: React.FC = () => {
  const { settings, updateSettings, setTheme, availableThemes } = useIdeSettings();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="text-sm font-bold text-[var(--ide-text)] mb-1 flex items-center gap-2">
          <Palette className="w-4 h-4 text-[var(--ide-accent)]" />
          <span>Temas de Color del IDE</span>
        </h3>
        <p className="text-xs text-[var(--ide-text-muted)] mb-4">
          Selecciona una paleta equilibrada para personalizar fondos, paneles, contraste de texto y resaltado de sintaxis.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {availableThemes.map((theme) => {
            const isSelected = settings.theme === theme.id;
            return (
              <div
                key={theme.id}
                onClick={() => setTheme(theme.id)}
                className={`group cursor-pointer rounded-xl p-3 border transition-all text-left flex flex-col justify-between relative overflow-hidden ${
                  isSelected
                    ? 'border-[var(--ide-accent)] bg-[var(--ide-btn-bg)] ring-1 ring-[var(--ide-accent)] shadow-md'
                    : 'border-[var(--ide-panel-border)] bg-[var(--ide-control-bg,rgba(0,0,0,0.1))] hover:bg-[var(--ide-btn-bg)] hover:border-[var(--ide-accent)]/50'
                }`}
              >
                {isSelected && (
                  <div 
                    className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center shadow-md font-bold"
                    style={{ 
                      backgroundColor: theme.previewColors.accent,
                      color: theme.previewColors.accentText || '#000000'
                    }}
                  >
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}

                <div className="flex items-center gap-2.5 mb-2">
                  <span 
                    className="w-3.5 h-3.5 rounded-full border border-black/20 dark:border-white/30 flex-shrink-0 shadow-inner"
                    style={{ backgroundColor: theme.previewColors.bg }}
                  />
                  <div className="font-semibold text-xs text-[var(--ide-text)] truncate pr-5">
                    {theme.name}
                  </div>
                </div>

                <p className="text-[11px] text-[var(--ide-text-muted)] line-clamp-2 mb-3 leading-relaxed">
                  {theme.description}
                </p>

                <div 
                  className="rounded-lg p-2.5 font-mono text-[10px] space-y-0.5 border shadow-inner"
                  style={{ 
                    backgroundColor: theme.previewColors.bg, 
                    color: theme.previewColors.text,
                    borderColor: theme.cssVars['--ide-panel-border'] || 'rgba(0,0,0,0.1)'
                  }}
                >
                  <div className="flex items-center gap-1 opacity-70 border-b border-black/10 dark:border-white/10 pb-1 mb-1 text-[9px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500/70" />
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500/70" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" />
                    <span className="ml-1 opacity-80">main.lumi</span>
                  </div>
                  <div className="truncate">
                    <span style={{ color: theme.previewColors.keyword, fontWeight: 'bold' }}>principal</span>{' '}
                    <span>&#123;</span>
                  </div>
                  <div className="pl-2.5 truncate">
                    <span style={{ color: theme.previewColors.keyword }}>habitacion</span>{' '}
                    <span style={{ color: theme.previewColors.accent }}>"Salon"</span>{' '}
                    <span style={{ color: theme.previewColors.text }}>[8, 5, 3]</span>
                  </div>
                  <div>&#125;</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-4 border-t border-[var(--ide-panel-border)]/60">
        <h3 className="text-sm font-bold text-[var(--ide-text)] mb-1">
          Acabado de Superficie de los Paneles
        </h3>
        <p className="text-xs text-[var(--ide-text-muted)] mb-3">
          Ajusta el nivel de transparencia y desenfoque de los paneles del entorno.
        </p>

        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'frosted', label: 'Translúcido (Cristal)', desc: 'Desenfocado profundo de 20px con reflejos' },
            { id: 'subtle', label: 'Cristal Sutil', desc: 'Desenfocado ligero de 8px suave' },
            { id: 'solid', label: 'Mate Sólido', desc: 'Superficie opaca y nítida de alto contraste' },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => updateSettings({ glassStyle: opt.id as GlassStyle })}
              className={`p-3 rounded-xl border text-left transition-all ${
                settings.glassStyle === opt.id
                  ? 'border-[var(--ide-accent)] bg-[var(--ide-btn-bg)] font-semibold shadow-sm'
                  : 'border-[var(--ide-panel-border)] bg-[var(--ide-control-bg,rgba(0,0,0,0.1))] hover:bg-[var(--ide-btn-bg)] text-[var(--ide-text-muted)]'
              }`}
            >
              <div className="text-xs text-[var(--ide-text)] font-semibold">{opt.label}</div>
              <div className="text-[10px] text-[var(--ide-text-muted)] mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-[var(--ide-panel-border)]/60">
        <h3 className="text-sm font-bold text-[var(--ide-text)] mb-1">
          Estilo de Bordes y Esquinas
        </h3>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <button
            onClick={() => updateSettings({ radiusStyle: 'modern-rounded' })}
            className={`p-3 rounded-xl border text-left transition-all ${
              settings.radiusStyle === 'modern-rounded'
                ? 'border-[var(--ide-accent)] bg-[var(--ide-btn-bg)]'
                : 'border-[var(--ide-panel-border)] bg-[var(--ide-control-bg,rgba(0,0,0,0.1))] text-[var(--ide-text-muted)]'
            }`}
          >
            <div className="text-xs text-[var(--ide-text)] font-semibold">Bordes Redondeados (20px)</div>
            <div className="text-[10px] text-[var(--ide-text-muted)]">Radio curvo suave y moderno</div>
          </button>

          <button
            onClick={() => updateSettings({ radiusStyle: 'classic-vscode' })}
            className={`p-3 rounded-xl border text-left transition-all ${
              settings.radiusStyle === 'classic-vscode'
                ? 'border-[var(--ide-accent)] bg-[var(--ide-btn-bg)]'
                : 'border-[var(--ide-panel-border)] bg-[var(--ide-control-bg,rgba(0,0,0,0.1))] text-[var(--ide-text-muted)]'
            }`}
          >
            <div className="text-xs text-[var(--ide-text)] font-semibold">Esquinas Clásicas (6px)</div>
            <div className="text-[10px] text-[var(--ide-text-muted)]">Radio compacto estilo tradicional de escritorio</div>
          </button>
        </div>
      </div>
    </div>
  );
};
