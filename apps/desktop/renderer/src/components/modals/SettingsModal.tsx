import React, { useState, useEffect } from 'react';
import { useIdeSettings } from '../../context/IdeSettingsContext';
import { 
  X, 
  Palette, 
  Type, 
  Boxes, 
  Sparkles, 
  RotateCcw, 
  Settings as SettingsIcon 
} from 'lucide-react';
import { 
  AppearanceTab, 
  EditorTab, 
  ViewportTab, 
  AssistantTab 
} from './settings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabId = 'appearance' | 'editor' | 'viewport' | 'assistant';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { 
    resetSettings, 
    currentTheme 
  } = useIdeSettings();

  const [activeTab, setActiveTab] = useState<TabId>('appearance');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      id="modal-settings-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in select-none"
    >
      <div
        id="modal-settings"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl max-h-[88vh] flex flex-col glass-modal text-[var(--ide-text)] shadow-2xl border border-[var(--ide-panel-border)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 glass-panel-header border-b border-[var(--ide-panel-border)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--ide-btn-bg)] border border-[var(--ide-btn-border)] text-[var(--ide-accent)] shadow-sm">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--ide-text)] flex items-center gap-2">
                <span>Configuración del Entorno de Desarrollo</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10 text-[var(--ide-text-muted)] border border-[var(--ide-panel-border)]">
                  Ctrl+,
                </span>
              </h2>
              <p className="text-xs text-[var(--ide-text-muted)]">
                Personaliza la apariencia del entorno, tipografía del editor, visualización 3D y herramientas de desarrollo.
              </p>
            </div>
          </div>
          <button
            id="btn-close-settings-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl glass-btn text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
            title="Cerrar configuración (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body with Tabs */}
        <div className="flex flex-1 min-h-[460px] max-h-[calc(88vh-130px)] overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-56 border-r border-[var(--ide-panel-border)] bg-[var(--ide-control-bg,rgba(0,0,0,0.1))] p-3 flex flex-col gap-1.5 overflow-y-auto">
            <button
              onClick={() => setActiveTab('appearance')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                activeTab === 'appearance'
                  ? 'bg-[var(--ide-btn-bg)] text-[var(--ide-text)] border border-[var(--ide-btn-border)] shadow-sm'
                  : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-btn-bg)] border border-transparent'
              }`}
            >
              <Palette className="w-4 h-4 text-[var(--ide-accent)]" />
              <span>Temas y Colores</span>
            </button>

            <button
              onClick={() => setActiveTab('editor')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                activeTab === 'editor'
                  ? 'bg-[var(--ide-btn-bg)] text-[var(--ide-text)] border border-[var(--ide-btn-border)] shadow-sm'
                  : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-btn-bg)] border border-transparent'
              }`}
            >
              <Type className="w-4 h-4 text-[var(--ide-accent)]" />
              <span>Editor de Código</span>
            </button>

            <button
              onClick={() => setActiveTab('viewport')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                activeTab === 'viewport'
                  ? 'bg-[var(--ide-btn-bg)] text-[var(--ide-text)] border border-[var(--ide-btn-border)] shadow-sm'
                  : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-btn-bg)] border border-transparent'
              }`}
            >
              <Boxes className="w-4 h-4 text-[var(--ide-accent)]" />
              <span>Visor 3D y Gráficos</span>
            </button>

            <button
              onClick={() => setActiveTab('assistant')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                activeTab === 'assistant'
                  ? 'bg-[var(--ide-btn-bg)] text-[var(--ide-text)] border border-[var(--ide-btn-border)] shadow-sm'
                  : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-btn-bg)] border border-transparent'
              }`}
            >
              <Sparkles className="w-4 h-4 text-[var(--ide-accent)]" />
              <span>Asistente y Compilación</span>
            </button>

            {/* Quick Live Preview Card in Sidebar */}
            <div className="mt-auto pt-3 border-t border-[var(--ide-panel-border)]/40 text-[11px] space-y-1.5">
              <div className="text-[10px] uppercase font-bold text-[var(--ide-text-muted)] tracking-wider">
                Tema en uso
              </div>
              <div className="font-semibold text-[var(--ide-text)] truncate">
                {currentTheme.name}
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <span 
                  className="w-4 h-4 rounded-full border border-black/20 dark:border-white/20 shadow-sm"
                  style={{ backgroundColor: currentTheme.previewColors.bg }}
                  title="Fondo"
                />
                <span 
                  className="w-4 h-4 rounded-full border border-black/20 dark:border-white/20 shadow-sm"
                  style={{ backgroundColor: currentTheme.previewColors.panel }}
                  title="Paneles"
                />
                <span 
                  className="w-4 h-4 rounded-full border border-black/20 dark:border-white/20 shadow-sm"
                  style={{ backgroundColor: currentTheme.previewColors.accent }}
                  title="Acento"
                />
                <span 
                  className="w-4 h-4 rounded-full border border-black/20 dark:border-white/20 shadow-sm"
                  style={{ backgroundColor: currentTheme.previewColors.keyword }}
                  title="Sintaxis"
                />
              </div>
            </div>
          </div>

          {/* Active Tab Content Panel */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            {activeTab === 'appearance' && <AppearanceTab />}
            {activeTab === 'editor' && <EditorTab />}
            {activeTab === 'viewport' && <ViewportTab />}
            {activeTab === 'assistant' && <AssistantTab />}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-[var(--ide-control-bg,rgba(0,0,0,0.1))] border-t border-[var(--ide-panel-border)]">
          <button
            type="button"
            onClick={resetSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-[var(--ide-text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            title="Restablecer todas las configuraciones a valores de fábrica"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Predeterminados</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[var(--ide-accent)] hover:brightness-110 text-[var(--ide-accent-text,#000000)] font-bold text-xs shadow-lg transition-all"
          >
            Aceptar y Guardar
          </button>
        </div>
      </div>
    </div>
  );
};
