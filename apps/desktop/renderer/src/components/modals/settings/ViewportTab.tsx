import React from 'react';
import { useIdeSettings } from '../../../context/IdeSettingsContext';
import { Boxes } from 'lucide-react';
import { LightingMode, RenderQuality, SpatialBackgroundMode } from '../../../types/settings';

export const ViewportTab: React.FC = () => {
  const { settings, updateSettings } = useIdeSettings();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="text-sm font-bold text-[var(--ide-text)] mb-1 flex items-center gap-2">
          <Boxes className="w-4 h-4 text-[var(--ide-accent)]" />
          <span>Visualización espacial 3D</span>
        </h3>
        <p className="text-xs text-[var(--ide-text-muted)] mb-4">
          Configuración de rejilla, guías métricas, iluminación y fidelidad gráfica de la escena.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--ide-control-bg,rgba(0,0,0,0.1))] border border-[var(--ide-panel-border)]">
            <div>
              <div className="text-xs font-semibold text-[var(--ide-text)]">Cuadrícula del suelo</div>
              <div className="text-[10px] text-[var(--ide-text-muted)]">Cuadrícula métrica de referencia</div>
            </div>
            <input
              type="checkbox"
              aria-label="Cuadrícula del suelo"
              checked={settings.showGrid}
              onChange={(e) => updateSettings({ showGrid: e.target.checked })}
              className="w-4 h-4 rounded accent-[var(--ide-accent)] cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--ide-control-bg,rgba(0,0,0,0.1))] border border-[var(--ide-panel-border)]">
            <div>
              <div className="text-xs font-semibold text-[var(--ide-text)]">Ejes cartesianos (X, Y, Z)</div>
              <div className="text-[10px] text-[var(--ide-text-muted)]">Guías de color espacial tridimensional</div>
            </div>
            <input
              type="checkbox"
              aria-label="Ejes cartesianos"
              checked={settings.showAxes}
              onChange={(e) => updateSettings({ showAxes: e.target.checked })}
              className="w-4 h-4 rounded accent-[var(--ide-accent)] cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--ide-control-bg,rgba(0,0,0,0.1))] border border-[var(--ide-panel-border)]">
            <div>
              <div className="text-xs font-semibold text-[var(--ide-text)]">Cotas y medidas métricas</div>
              <div className="text-[10px] text-[var(--ide-text-muted)]">Etiquetas flotantes con metros y espesores</div>
            </div>
            <input
              type="checkbox"
              aria-label="Cotas y medidas métricas"
              checked={settings.showDimensions}
              onChange={(e) => updateSettings({ showDimensions: e.target.checked })}
              className="w-4 h-4 rounded accent-[var(--ide-accent)] cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--ide-control-bg,rgba(0,0,0,0.1))] border border-[var(--ide-panel-border)]">
            <div>
              <div className="text-xs font-semibold text-[var(--ide-text)]">Iluminación ambiental</div>
              <div className="text-[10px] text-[var(--ide-text-muted)]">Tono del sol y atmósfera de la escena</div>
            </div>
            <select
              aria-label="Iluminación ambiental"
              value={settings.lightingMode}
              onChange={(e) => updateSettings({ lightingMode: e.target.value as LightingMode })}
              className="px-2.5 py-1 rounded bg-[var(--ide-dropdown-bg)] border border-[var(--ide-panel-border)] text-xs text-[var(--ide-text)] outline-none cursor-pointer"
            >
              <option value="day">Día (Soleado)</option>
              <option value="night">Noche (Ciber)</option>
              <option value="studio">Atardecer</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--ide-control-bg,rgba(0,0,0,0.1))] border border-[var(--ide-panel-border)] md:col-span-2">
            <div>
              <div className="text-xs font-semibold text-[var(--ide-text)]">Color y entorno del espacio 3D</div>
              <div className="text-[10px] text-[var(--ide-text-muted)]">Fondo del visor tridimensional y cuadrícula métrica</div>
            </div>
            <select
              aria-label="Color y entorno del espacio 3D"
              value={settings.spatialBackground || 'theme'}
              onChange={(e) => updateSettings({ spatialBackground: e.target.value as SpatialBackgroundMode })}
              className="px-2.5 py-1 rounded bg-[var(--ide-dropdown-bg)] border border-[var(--ide-panel-border)] text-xs text-[var(--ide-text)] outline-none cursor-pointer"
            >
              <option value="theme">Sincronizado con el tema del IDE (recomendado)</option>
              <option value="deep-dark">Oscuro profundo (#030712)</option>
              <option value="studio-light">Estudio claro (#f8fafc)</option>
              <option value="cyber">Ciberpunk neón (#050510)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-[var(--ide-panel-border)]/60">
        <h3 className="text-sm font-bold text-[var(--ide-text)] mb-2">
          Fidelidad de Renderizado
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'high', label: 'Alta Fidelidad', desc: 'Sombras y resolución adaptada a la pantalla' },
            { id: 'balanced', label: 'Equilibrada', desc: 'Sombras y resolución estándar' },
            { id: 'performance', label: 'Alto Rendimiento', desc: 'Sin sombras y con resolución estándar' },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => updateSettings({ renderQuality: opt.id as RenderQuality })}
              className={`p-3 rounded-xl border text-left transition-all ${
                settings.renderQuality === opt.id
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
    </div>
  );
};
