import React from 'react';
import { useIdeSettings } from '../../../context/IdeSettingsContext';
import { Sparkles } from 'lucide-react';
import { LumiColorPreset } from '../../../types/settings';
import { LumiMascot } from '../../LumiMascot';

export const AssistantTab: React.FC = () => {
  const { settings, updateSettings } = useIdeSettings();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="text-sm font-bold text-[var(--ide-text)] mb-1 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--ide-accent)]" />
          <span>Asistente Lumi y Sistema de Compilación</span>
        </h3>
        <p className="text-xs text-[var(--ide-text-muted)] mb-4">
          Controla la presencia de la mascota interactiva Lumi y la validación en tiempo real.
        </p>

        <div className="space-y-3">
          {/* Show Mascot */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--ide-control-bg,rgba(0,0,0,0.1))] border border-[var(--ide-panel-border)]">
            <div>
              <div className="text-xs font-semibold text-[var(--ide-text)]">Mascota Compañera Lumi</div>
              <div className="text-[11px] text-[var(--ide-text-muted)]">
                Mostrar la mascota flotante con expresiones reactivas en la esquina inferior
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.showMascot}
              onChange={(e) => updateSettings({ showMascot: e.target.checked })}
              className="w-4 h-4 rounded accent-[var(--ide-accent)] cursor-pointer"
            />
          </div>

          {/* Auto-compile on Type */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--ide-control-bg,rgba(0,0,0,0.1))] border border-[var(--ide-panel-border)]">
            <div>
              <div className="text-xs font-semibold text-[var(--ide-text)]">Auto-compilación al Escribir</div>
              <div className="text-[11px] text-[var(--ide-text-muted)]">
                Validar sintaxis y generar AST automáticamente tras 1.5s sin pulsar teclas
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.autoCompileOnType}
              onChange={(e) => updateSettings({ autoCompileOnType: e.target.checked })}
              className="w-4 h-4 rounded accent-[var(--ide-accent)] cursor-pointer"
            />
          </div>

          {/* Sound Effects */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--ide-control-bg,rgba(0,0,0,0.1))] border border-[var(--ide-panel-border)]">
            <div>
              <div className="text-xs font-semibold text-[var(--ide-text)]">Efectos de Audio de la Interfaz</div>
              <div className="text-[11px] text-[var(--ide-text-muted)]">
                Sonidos sutiles de confirmación al compilar o renderizar exitosamente
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.soundEffects}
              onChange={(e) => updateSettings({ soundEffects: e.target.checked })}
              className="w-4 h-4 rounded accent-[var(--ide-accent)] cursor-pointer"
            />
          </div>
        </div>

        {/* Personalización de Color de Lumi */}
        <div className="pt-5 mt-5 border-t border-[var(--ide-panel-border)]/60">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-xs font-bold text-[var(--ide-text)] uppercase tracking-wider">
                Color y Aura de la Mascota Lumi
              </h4>
              <p className="text-[11px] text-[var(--ide-text-muted)] mt-0.5">
                Personaliza el resplandor reactivo y tonalidad de Lumi o mantenlo sincronizado con el tema.
              </p>
            </div>

            {/* Mini Live Preview of Lumi */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--ide-control-bg)] border border-[var(--ide-panel-border)] shadow-sm">
              <LumiMascot
                state="ready"
                size={32}
                isAnimated={true}
                colorPreset={settings.lumiColorPreset}
              />
              <span className="text-[10px] font-mono text-[var(--ide-text)] font-semibold">
                Vista previa
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { id: 'theme', label: 'Sincronizado', desc: 'Sigue el tema del IDE', dot: 'bg-[var(--ide-accent)]' },
              { id: 'blue', label: 'Azul VS Code', desc: 'Resplandor azul zafiro', dot: 'bg-sky-500' },
              { id: 'gold', label: 'Oro Champán', desc: 'Elegancia clásica cálida', dot: 'bg-amber-300' },
              { id: 'purple', label: 'Morado Neón', desc: 'Violeta cyberpunk', dot: 'bg-purple-400' },
              { id: 'emerald', label: 'Esmeralda', desc: 'Verde bosque original', dot: 'bg-emerald-500' },
              { id: 'cyan', label: 'Cian Eléctrico', desc: 'Resplandor turquesa', dot: 'bg-cyan-400' },
              { id: 'rose', label: 'Rosa Neón', desc: 'Vibrante y llamativo', dot: 'bg-rose-400' },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => updateSettings({ lumiColorPreset: preset.id as LumiColorPreset })}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  (settings.lumiColorPreset || 'theme') === preset.id
                    ? 'border-[var(--ide-accent)] bg-[var(--ide-btn-bg)] font-semibold shadow-sm'
                    : 'border-[var(--ide-panel-border)] bg-[var(--ide-control-bg)] hover:bg-[var(--ide-btn-bg)] text-[var(--ide-text-muted)]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${preset.dot} flex-shrink-0 shadow-sm`} />
                  <span className="text-xs text-[var(--ide-text)] font-semibold truncate">{preset.label}</span>
                </div>
                <div className="text-[10px] text-[var(--ide-text-muted)] mt-1 truncate">{preset.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
