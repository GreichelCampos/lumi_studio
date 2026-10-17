import React from 'react';
import { DebuggerStatus, PlaybackSpeed } from '../../types';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  ChevronsLeft,
  ChevronsRight,
  Gauge,
} from 'lucide-react';

export interface DebuggerControlsProps {
  stepCount: number;
  currentStepIndex: number;
  debuggerStatus?: DebuggerStatus;
  playbackSpeed?: PlaybackSpeed;
  isPlaying?: boolean;
  onStepChange: (index: number) => void;
  onStartDebugging?: () => void;
  onTogglePlay?: () => void;
  onPrevStep?: () => void;
  onNextStep?: () => void;
  onJumpToStart?: () => void;
  onJumpToEnd?: () => void;
  onResetDebugger?: () => void;
  onChangeSpeed?: (speed: PlaybackSpeed) => void;
}

export const DebuggerControls: React.FC<DebuggerControlsProps> = ({
  stepCount,
  currentStepIndex,
  playbackSpeed = 1,
  isPlaying = false,
  onStepChange,
  onStartDebugging,
  onTogglePlay,
  onPrevStep,
  onNextStep,
  onJumpToStart,
  onJumpToEnd,
  onResetDebugger,
  onChangeSpeed,
}) => {
  const isStartDisabled = stepCount === 0 || currentStepIndex === 0;
  const isEndDisabled = stepCount === 0 || currentStepIndex >= stepCount - 1;
  const isAllDisabled = stepCount === 0;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Jump to start */}
      <button
        id="btn-debug-start"
        onClick={onJumpToStart || (() => onStepChange(0))}
        disabled={isStartDisabled}
        className="p-1.5 rounded-xl glass-btn text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
        title="Ir al inicio (Paso 1)"
      >
        <ChevronsLeft className="w-3.5 h-3.5" />
      </button>

      {/* Step back */}
      <button
        id="btn-debug-prev"
        onClick={onPrevStep || (() => onStepChange(Math.max(0, currentStepIndex - 1)))}
        disabled={isStartDisabled}
        className="p-1.5 rounded-xl glass-btn text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
        title="Paso anterior"
      >
        <SkipBack className="w-3.5 h-3.5" />
      </button>

      {/* Play / Pause toggle */}
      <button
        id="btn-debug-play-pause"
        onClick={onTogglePlay || onStartDebugging}
        disabled={isAllDisabled}
        className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-500/30 disabled:opacity-40 transition-all"
        title={isPlaying ? 'Pausar depuración' : 'Reproducir paso a paso'}
      >
        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-white" />}
        <span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
      </button>

      {/* Step forward */}
      <button
        id="btn-debug-next"
        onClick={onNextStep || (() => onStepChange(Math.min(stepCount - 1, currentStepIndex + 1)))}
        disabled={isEndDisabled}
        className="p-1.5 rounded-xl glass-btn text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
        title="Paso siguiente"
      >
        <SkipForward className="w-3.5 h-3.5" />
      </button>

      {/* Jump to end */}
      <button
        id="btn-debug-end"
        onClick={onJumpToEnd || (() => onStepChange(stepCount - 1))}
        disabled={isEndDisabled}
        className="p-1.5 rounded-xl glass-btn text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
        title="Ir al paso final"
      >
        <ChevronsRight className="w-3.5 h-3.5" />
      </button>

      {/* Reset */}
      <button
        id="btn-debug-reset"
        onClick={onResetDebugger || (() => onStepChange(0))}
        disabled={isAllDisabled}
        className="p-1.5 rounded-xl glass-btn text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] disabled:opacity-40 transition-colors"
        title="Reiniciar depuración"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>

      {/* Speed Selector */}
      {onChangeSpeed && (
        <div className="flex items-center gap-1 ml-1 pl-1 border-l border-[var(--ide-panel-border)] text-xs">
          <Gauge className="w-3 h-3 text-[var(--ide-text-muted)]" />
          {([0.5, 1, 2] as PlaybackSpeed[]).map((spd) => (
            <button
              key={spd}
              onClick={() => onChangeSpeed(spd)}
              className={`px-1.5 py-0.5 rounded-lg text-[11px] font-mono transition-colors ${
                playbackSpeed === spd
                  ? 'bg-[var(--ide-accent-bg)] text-[var(--ide-accent)] border border-[var(--ide-accent)]/50 font-bold'
                  : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-btn-bg)]'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
