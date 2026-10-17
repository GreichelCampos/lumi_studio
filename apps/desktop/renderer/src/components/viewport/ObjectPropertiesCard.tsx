import React from 'react';
import { SpatialObject, DoorModel, WindowModel, SourceReference } from '../../types';
import { 
  Box, 
  X, 
  Move, 
  RotateCw, 
  Maximize2, 
  FileCode, 
  Palette, 
  AlertTriangle,
  DoorClosed,
  AppWindow,
  Layers
} from 'lucide-react';

export type SelectedEntity = 
  | { kind: 'object'; data: SpatialObject }
  | { kind: 'door'; data: DoorModel }
  | { kind: 'window'; data: WindowModel };

interface ObjectPropertiesCardProps {
  entity: SelectedEntity | null;
  onClose: () => void;
  onNavigateToSource?: (sourceRef: SourceReference) => void;
}

export const ObjectPropertiesCard: React.FC<ObjectPropertiesCardProps> = ({
  entity,
  onClose,
  onNavigateToSource,
}) => {
  if (!entity) return null;

  const isObject = entity.kind === 'object';
  const isDoor = entity.kind === 'door';
  const isWindow = entity.kind === 'window';

  const title = isObject
    ? entity.data.name || entity.data.id
    : isDoor
    ? `Puerta (${entity.data.wall})`
    : `Ventana (${entity.data.wall})`;

  const typeLabel = isObject
    ? `Mueble • ${entity.data.type}`
    : isDoor
    ? `Abertura • Puerta (${entity.data.wall})`
    : `Abertura • Ventana (${entity.data.wall})`;

  const positionStr = isObject
    ? `X: ${entity.data.position[0].toFixed(2)}m, Y: ${entity.data.position[1].toFixed(2)}m, Z: ${entity.data.position[2].toFixed(2)}m`
    : `Posición pared: ${entity.data.position.toFixed(2)}m`;

  const rotationStr = isObject
    ? `X: ${entity.data.rotation[0]}°, Y: ${entity.data.rotation[1]}°, Z: ${entity.data.rotation[2]}°`
    : null;

  const dimensionsStr = isObject
    ? `${entity.data.dimensions[0].toFixed(2)} × ${entity.data.dimensions[1].toFixed(2)} × ${entity.data.dimensions[2].toFixed(2)} m`
    : `${entity.data.width.toFixed(2)} × ${entity.data.height.toFixed(2)} m`;

  const sourceRef = entity.data.sourceRef;
  const hasError = isObject && (entity.data.hasCollision || entity.data.isOutOfBounds);

  return (
    <div 
      id="object-properties-card"
      className="absolute top-3 left-3 w-80 max-w-[calc(100%-1.5rem)] max-h-[calc(100%-1.5rem)] flex flex-col glass-card border border-white/20 rounded-2xl overflow-hidden z-30 text-slate-100 select-none animate-fade-in pointer-events-auto"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 glass-panel-header border-b border-[var(--ide-panel-border)] backdrop-blur-md flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-xl bg-[var(--ide-accent-bg)] text-[var(--ide-accent)] border border-[var(--ide-accent)]/40 shadow-sm flex-shrink-0">
            {isObject ? (
              <Box className="w-4 h-4" />
            ) : isDoor ? (
              <DoorClosed className="w-4 h-4" />
            ) : (
              <AppWindow className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-[var(--ide-text)] truncate font-mono tracking-tight">{title}</h4>
            <span className="text-[10px] text-[var(--ide-text-muted)] font-sans block truncate uppercase tracking-wider">{typeLabel}</span>
          </div>
        </div>

        <button
          id="btn-close-object-card"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="w-7 h-7 flex items-center justify-center rounded-xl bg-white/[0.06] hover:bg-rose-500/20 text-[var(--ide-text-muted)] hover:text-rose-200 border border-[var(--ide-panel-border)] hover:border-rose-400/40 transition-all ml-1 flex-shrink-0 cursor-pointer shadow-sm active:scale-95"
          title="Cerrar panel de propiedades (Esc)"
          aria-label="Cerrar detalles del objeto"
        >
          <X className="w-4 h-4 pointer-events-none" />
        </button>
      </div>

      {/* Warning/Error banner if object has collision or out of bounds */}
      {hasError && (
        <div className="px-3.5 py-2 bg-rose-500/20 border-b border-rose-500/30 backdrop-blur-sm flex items-center gap-2 text-rose-200 text-[11px] flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-rose-300 flex-shrink-0" />
          <span className="font-medium">
            {entity.data.isOutOfBounds
              ? 'Objeto fuera de los límites de la habitación'
              : 'Colisión detectada con otro elemento espacial'}
          </span>
        </div>
      )}

      {/* Properties List */}
      <div className="p-3.5 space-y-2.5 text-xs flex-1 overflow-y-auto min-h-0 backdrop-blur-md">
        {/* Identificador Lumi */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[var(--ide-text-muted)] font-sans flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
            <span>ID Lumi:</span>
          </span>
          <span className="font-mono text-[var(--ide-text)] bg-[var(--ide-control-bg)] px-2.5 py-0.5 rounded-lg border border-[var(--ide-panel-border)] text-[11px] shadow-sm">
            {entity.data.id}
          </span>
        </div>

        {/* Posición espacial */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] text-[var(--ide-text-muted)] font-sans flex items-center gap-1.5 flex-shrink-0">
            <Move className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
            <span>Posición:</span>
          </span>
          <span className="font-mono text-[var(--ide-text)] text-[11px] text-right truncate bg-[var(--ide-control-bg)] px-2 py-0.5 rounded border border-[var(--ide-panel-border)]" title={positionStr}>
            {positionStr}
          </span>
        </div>

        {/* Dimensiones */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[var(--ide-text-muted)] font-sans flex items-center gap-1.5">
            <Maximize2 className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
            <span>Dimensiones:</span>
          </span>
          <span className="font-mono text-[var(--ide-text)] text-[11px] bg-[var(--ide-control-bg)] px-2 py-0.5 rounded border border-[var(--ide-panel-border)]">
            {dimensionsStr}
          </span>
        </div>

        {/* Rotación (si es objeto espacial) */}
        {isObject && rotationStr && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[var(--ide-text-muted)] font-sans flex items-center gap-1.5">
              <RotateCw className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
              <span>Rotación:</span>
            </span>
            <span className="font-mono text-[var(--ide-text)] text-[11px] bg-[var(--ide-control-bg)] px-2 py-0.5 rounded border border-[var(--ide-panel-border)]">
              {rotationStr}
            </span>
          </div>
        )}

        {/* Material y Color */}
        {isObject && (entity.data.color || entity.data.material) && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[var(--ide-text-muted)] font-sans flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
              <span>Acabado:</span>
            </span>
            <span className="font-mono text-[var(--ide-text)] text-[11px] capitalize bg-[var(--ide-control-bg)] px-2 py-0.5 rounded border border-[var(--ide-panel-border)]">
              {[entity.data.material, entity.data.color].filter(Boolean).join(' • ')}
            </span>
          </div>
        )}
      </div>

      {/* Footer / Actions */}
      <div className="px-3.5 py-2.5 glass-panel-header border-t border-[var(--ide-panel-border)] backdrop-blur-md flex items-center justify-between gap-2">
        {sourceRef ? (
          <span className="text-[10px] text-[var(--ide-text-muted)] font-mono truncate">
            {sourceRef.file}:{sourceRef.line}
          </span>
        ) : (
          <span className="text-[10px] text-[var(--ide-text-muted)] font-sans">
            Presiona Esc para deseleccionar
          </span>
        )}

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {sourceRef && onNavigateToSource && (
            <button
              id="btn-navigate-source"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigateToSource(sourceRef);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[var(--ide-accent-bg)] hover:brightness-110 text-[var(--ide-accent)] border border-[var(--ide-accent)]/50 text-[11px] font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
            >
              <FileCode className="w-3.5 h-3.5 pointer-events-none" />
              <span>Ir al código</span>
            </button>
          )}

          <button
            id="btn-footer-close-card"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="flex items-center gap-1 px-3 py-1 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] border border-[var(--ide-panel-border)] text-[11px] font-medium transition-all cursor-pointer active:scale-95"
          >
            <span>Cerrar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
