import React from 'react';
import { SPATIAL_THEME } from '../../services/spatial/SpatialVisualTheme';
import { HelpCircle, X } from 'lucide-react';

interface VisualLegendOverlayProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const VisualLegendOverlay: React.FC<VisualLegendOverlayProps> = ({
  isOpen,
  onToggle,
}) => {
  if (!isOpen) {
    return (
      <button
        id="btn-open-legend"
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-btn text-[11px] text-[var(--ide-text-muted)] font-mono transition-all shadow-md border border-[var(--ide-panel-border)]"
        title="Mostrar guía de estados espaciales"
      >
        <HelpCircle className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
        <span className="hidden sm:inline font-semibold">Leyenda</span>
      </button>
    );
  }

  return (
    <div
      id="visual-legend-card"
      className="absolute bottom-12 left-3 glass-card p-3.5 shadow-2xl z-20 text-[var(--ide-text)] select-none !w-64 !h-auto animate-fade-in border border-[var(--ide-panel-border)] bg-[var(--ide-panel-solid)]/90 backdrop-blur-md"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--ide-panel-border)]">
        <span className="text-xs font-bold text-[var(--ide-text)] flex items-center gap-1.5 font-mono">
          <HelpCircle className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
          Estados Espaciales
        </span>
        <button
          id="btn-close-legend"
          type="button"
          onClick={onToggle}
          className="p-1 rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] glass-btn transition-colors"
          title="Ocultar leyenda"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-2 text-xs">
        {/* Normal */}
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-sm bg-[var(--ide-accent)] opacity-60 border border-[var(--ide-panel-border)] flex-shrink-0" />
          <div className="flex flex-col">
            <span className="text-[var(--ide-text)] font-medium leading-none">Normal</span>
            <span className="text-[10px] text-[var(--ide-text-muted)]">Mueble colocado sin conflictos</span>
          </div>
        </div>

        {/* Seleccionado */}
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-sm bg-[var(--ide-accent)] border border-[var(--ide-accent)] shadow-sm flex-shrink-0" />
          <div className="flex flex-col">
            <span className="text-[var(--ide-accent)] font-medium leading-none">Seleccionado</span>
            <span className="text-[10px] text-[var(--ide-text-muted)]">Contorno y proyección iluminada</span>
          </div>
        </div>

        {/* Advertencia */}
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-sm bg-amber-500 border border-amber-300 flex-shrink-0" />
          <div className="flex flex-col">
            <span className="text-amber-300 font-medium leading-none">Advertencia</span>
            <span className="text-[10px] text-[var(--ide-text-muted)]">Holgura ajustada o cota límite</span>
          </div>
        </div>

        {/* Error espacial */}
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-sm bg-rose-500 border border-rose-300 shadow-sm shadow-rose-500/50 flex-shrink-0" />
          <div className="flex flex-col">
            <span className="text-rose-400 font-medium leading-none">Error espacial</span>
            <span className="text-[10px] text-[var(--ide-text-muted)]">Colisión o fuera de límites</span>
          </div>
        </div>

        {/* Depuración Activa */}
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-sm bg-purple-500 border border-purple-300 shadow-sm flex-shrink-0" />
          <div className="flex flex-col">
            <span className="text-purple-300 font-medium leading-none">Objeto activo (Depurador)</span>
            <span className="text-[10px] text-[var(--ide-text-muted)]">Línea de código en ejecución</span>
          </div>
        </div>
      </div>
    </div>
  );
};
