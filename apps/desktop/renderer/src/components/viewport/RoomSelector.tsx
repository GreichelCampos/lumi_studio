import React from 'react';
import { RoomModel } from '../../types';
import { Layers, AlertTriangle, Box } from 'lucide-react';

interface RoomSelectorProps {
  rooms: RoomModel[];
  activeRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
}

export const RoomSelector: React.FC<RoomSelectorProps> = ({
  rooms,
  activeRoomId,
  onSelectRoom,
}) => {
  if (!rooms || rooms.length === 0) {
    return null;
  }

  if (rooms.length === 1) {
    const room = rooms[0];
    const [rw, rl, rh] = room.dimensions;
    const hasRoomErrors = room.objects.some((o) => o.hasCollision || o.isOutOfBounds);

    return (
      <div 
        id="room-selector-single"
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-btn text-xs text-[var(--ide-text-muted)] border border-[var(--ide-panel-border)]"
      >
        <Layers className="w-3.5 h-3.5 text-[var(--ide-accent)] flex-shrink-0" />
        <span className="font-bold text-[var(--ide-text)] font-mono">{room.name}</span>
        <span className="text-[11px] text-[var(--ide-text-muted)] font-mono opacity-80">
          ({rw.toFixed(1)}×{rl.toFixed(1)}×{rh.toFixed(1)}m)
        </span>
        <span className="flex items-center gap-1 text-[11px] text-[var(--ide-text-muted)] px-1.5 py-0.5 bg-[var(--ide-control-bg)] rounded-lg border border-[var(--ide-panel-border)]">
          <Box className="w-2.5 h-2.5 text-[var(--ide-accent)]" />
          <span>{room.objects.length} obj</span>
        </span>
        {hasRoomErrors && (
          <span 
            className="flex items-center gap-1 text-[10px] text-rose-300 bg-rose-500/20 px-1.5 py-0.5 rounded-lg border border-rose-400/40"
            title="Los datos de esta habitación indican colisiones o elementos fuera de límites"
          >
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            <span>Conflicto</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <div id="room-selector-multi" className="flex items-center gap-1.5 glass-btn rounded-xl p-1 border border-[var(--ide-panel-border)]">
      <div className="flex items-center gap-1 px-1.5 text-[var(--ide-text-muted)] flex-shrink-0">
        <Layers className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
        <span className="text-[11px] uppercase tracking-wider font-semibold">Habitación:</span>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto max-w-[260px] sm:max-w-[360px] md:max-w-[480px] lg:max-w-[600px] xl:max-w-none">
        {rooms.map((room) => {
          const isActive = room.id === activeRoomId;
          const [rw, rl, rh] = room.dimensions;
          const hasRoomErrors = room.objects.some((o) => o.hasCollision || o.isOutOfBounds);

          return (
            <button
              id={`room-tab-${room.id}`}
              key={room.id}
              onClick={() => onSelectRoom(room.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex-shrink-0 ${
                isActive
                  ? 'bg-[var(--ide-accent-bg)] text-[var(--ide-accent)] font-bold border border-[var(--ide-accent)]/50 shadow-sm'
                  : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-btn-bg)] border border-transparent'
              }`}
              title={`Habitación ${room.name} (${rw}m × ${rl}m × ${rh}m, ${room.objects.length} objetos)`}
            >
              <span>{room.name}</span>
              <span className="text-[10px] opacity-75">
                ({rw.toFixed(1)}×{rl.toFixed(1)}m)
              </span>
              <span className="text-[10px] px-1 rounded bg-[var(--ide-control-bg)] opacity-90 font-bold border border-[var(--ide-panel-border)]">
                {room.objects.length}
              </span>
              {hasRoomErrors && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse flex-shrink-0 shadow-[0_0_6px_rgba(244,63,94,0.8)]" title="Contiene error espacial" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
