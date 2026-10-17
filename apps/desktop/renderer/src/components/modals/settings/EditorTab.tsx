import React from 'react';
import { useIdeSettings } from '../../../context/IdeSettingsContext';
import { Type } from 'lucide-react';
import { AutoSaveOption, IdeSettings } from '../../../types/settings';

export const EditorTab: React.FC = () => {
  const { settings, updateSettings } = useIdeSettings();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="text-sm font-bold text-[var(--ide-text)] mb-1 flex items-center gap-2">
          <Type className="w-4 h-4 text-[var(--ide-accent)]" />
          <span>Tipografía y Tamaño de Fuente</span>
        </h3>
        <p className="text-xs text-[var(--ide-text-muted)] mb-3">
          Ajusta la fuente tipográfica monoespaciada y la escala de lectura en el editor.
        </p>

        {/* Font Size Selector */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-[var(--ide-text-muted)] mr-2">Tamaño:</span>
          {[12, 13, 14, 16, 18].map((size) => (
            <button
              key={size}
              onClick={() => updateSettings({ fontSize: size })}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                settings.fontSize === size
                  ? 'bg-[var(--ide-accent)] text-[var(--ide-accent-text,#000000)] shadow-sm'
                  : 'bg-[var(--ide-control-bg,rgba(0,0,0,0.1))] border border-[var(--ide-panel-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
              }`}
            >
              {size}px
            </button>
          ))}
        </div>

        {/* Font Family Selector */}
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { id: 'Fira Code', label: 'Fira Code', sample: '>> habitacion "Suite" [6, 4, 3]' },
            { id: 'JetBrains Mono', label: 'JetBrains Mono', sample: '>> habitacion "Suite" [6, 4, 3]' },
            { id: 'Source Code Pro', label: 'Source Code Pro', sample: '>> habitacion "Suite" [6, 4, 3]' },
            { id: 'Consolas', label: 'Consolas (Windows)', sample: '>> habitacion "Suite" [6, 4, 3]' },
          ].map((font) => (
            <button
              key={font.id}
              onClick={() => updateSettings({ fontFamily: font.id as IdeSettings['fontFamily'] })}
              className={`p-3 rounded-xl border text-left transition-all ${
                settings.fontFamily === font.id
                  ? 'border-[var(--ide-accent)] bg-[var(--ide-btn-bg)]'
                  : 'border-[var(--ide-panel-border)] bg-[var(--ide-control-bg,rgba(0,0,0,0.1))] hover:bg-[var(--ide-btn-bg)] text-[var(--ide-text-muted)]'
              }`}
            >
              <div className="text-xs font-semibold text-[var(--ide-text)]">{font.label}</div>
              <div 
                className="text-[11px] mt-1 text-[var(--ide-text-muted)] truncate"
                style={{ fontFamily: font.id }}
              >
                {font.sample}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Line Numbers, Word Wrap & Tab Size */}
      <div className="pt-4 border-t border-[var(--ide-panel-border)]/60 space-y-4">
        <h3 className="text-sm font-bold text-[var(--ide-text)]">
          Comportamiento del Editor
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Toggle Line Numbers */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--ide-control-bg,rgba(0,0,0,0.1))] border border-[var(--ide-panel-border)]">
            <div>
              <div className="text-xs font-semibold text-[var(--ide-text)]">Números de Línea</div>
              <div className="text-[10px] text-[var(--ide-text-muted)]">Mostrar barra lateral numerada</div>
            </div>
            <input
              type="checkbox"
              checked={settings.lineNumbers}
              onChange={(e) => updateSettings({ lineNumbers: e.target.checked })}
              className="w-4 h-4 rounded accent-[var(--ide-accent)] cursor-pointer"
            />
          </div>

          {/* Toggle Word Wrap */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--ide-control-bg,rgba(0,0,0,0.1))] border border-[var(--ide-panel-border)]">
            <div>
              <div className="text-xs font-semibold text-[var(--ide-text)]">Ajuste de Línea (Word Wrap)</div>
              <div className="text-[10px] text-[var(--ide-text-muted)]">Ajustar líneas largas al ancho</div>
            </div>
            <input
              type="checkbox"
              checked={settings.wordWrap}
              onChange={(e) => updateSettings({ wordWrap: e.target.checked })}
              className="w-4 h-4 rounded accent-[var(--ide-accent)] cursor-pointer"
            />
          </div>

          {/* Tab Size */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--ide-control-bg,rgba(0,0,0,0.1))] border border-[var(--ide-panel-border)]">
            <div>
              <div className="text-xs font-semibold text-[var(--ide-text)]">Tamaño de Tabulación</div>
              <div className="text-[10px] text-[var(--ide-text-muted)]">Espacios por nivel de sangría</div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => updateSettings({ tabSize: 2 })}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                  settings.tabSize === 2
                    ? 'bg-[var(--ide-accent)] text-[var(--ide-accent-text,#000000)]'
                    : 'bg-[var(--ide-btn-bg)] text-[var(--ide-text-muted)]'
                }`}
              >
                2
              </button>
              <button
                onClick={() => updateSettings({ tabSize: 4 })}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                  settings.tabSize === 4
                    ? 'bg-[var(--ide-accent)] text-[var(--ide-accent-text,#000000)]'
                    : 'bg-[var(--ide-btn-bg)] text-[var(--ide-text-muted)]'
                }`}
              >
                4
              </button>
            </div>
          </div>

          {/* Auto-save */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--ide-control-bg,rgba(0,0,0,0.1))] border border-[var(--ide-panel-border)]">
            <div>
              <div className="text-xs font-semibold text-[var(--ide-text)]">Guardado Automático</div>
              <div className="text-[10px] text-[var(--ide-text-muted)]">Persistir cambios periódicamente</div>
            </div>
            <select
              value={settings.autoSave}
              onChange={(e) => updateSettings({ autoSave: e.target.value as AutoSaveOption })}
              className="px-2.5 py-1 rounded bg-[var(--ide-dropdown-bg)] border border-[var(--ide-panel-border)] text-xs text-[var(--ide-text)] outline-none cursor-pointer"
            >
              <option value="off">Desactivado</option>
              <option value="30s">Cada 30 seg</option>
              <option value="60s">Cada 1 min</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
