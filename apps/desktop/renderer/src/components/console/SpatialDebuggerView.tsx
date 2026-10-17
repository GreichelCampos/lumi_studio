import React from 'react';
import {
  DebugStep,
  DebuggerStatus,
  PlaybackSpeed,
} from '../../types';
import { Bug, Compass } from 'lucide-react';
import { DebuggerControls } from './DebuggerControls';
import { getDebuggerStatusInfo } from './debuggerUtils';

export interface SpatialDebuggerViewProps {
  debugSteps: DebugStep[];
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
  onFocusObject: (objectId: string) => void;
}

export const SpatialDebuggerView: React.FC<SpatialDebuggerViewProps> = ({
  debugSteps,
  currentStepIndex,
  debuggerStatus = 'idle' as DebuggerStatus,
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
  onFocusObject,
}) => {
  const currentStep = debugSteps.length > 0 ? debugSteps[currentStepIndex] : undefined;
  const statusInfo = getDebuggerStatusInfo(debuggerStatus);

  return (
    <div className="space-y-3 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-2 glass-panel-header p-2.5 rounded-2xl border border-white/20 shadow-md">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-purple-400 drop-shadow-[0_0_6px_rgba(192,132,252,0.6)]" />
          <span className="text-xs font-bold text-slate-200">
            Paso {debugSteps.length > 0 ? currentStepIndex + 1 : 0} de {debugSteps.length}
          </span>

          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusInfo.badgeClass}`}
          >
            {statusInfo.label}
          </span>
        </div>

        <DebuggerControls
          stepCount={debugSteps.length}
          currentStepIndex={currentStepIndex}
          debuggerStatus={debuggerStatus}
          playbackSpeed={playbackSpeed}
          isPlaying={isPlaying}
          onStepChange={onStepChange}
          onStartDebugging={onStartDebugging}
          onTogglePlay={onTogglePlay}
          onPrevStep={onPrevStep}
          onNextStep={onNextStep}
          onJumpToStart={onJumpToStart}
          onJumpToEnd={onJumpToEnd}
          onResetDebugger={onResetDebugger}
          onChangeSpeed={onChangeSpeed}
        />
      </div>

      {debugSteps.length > 0 && currentStep ? (
        <div className="glass-card p-3.5 space-y-2 !w-auto !h-auto">
          <div className="flex items-center justify-between text-xs text-[var(--ide-accent)]">
            <span className="font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--ide-accent)] animate-ping" />
              <span>
                Línea {currentStep.sourceRef.line} ({currentStep.sourceRef.file}):
              </span>
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[var(--ide-accent-bg)] text-[var(--ide-accent)] border border-[var(--ide-accent)]/40">
                {currentStep.eventType}
              </span>
              <span className="font-mono bg-[var(--ide-accent-bg)] px-2 py-0.5 rounded-lg border border-[var(--ide-accent)]/30 text-[11px] text-[var(--ide-accent)]">
                Paso #{currentStep.stepIndex}
              </span>
            </div>
          </div>

          <div className="font-mono text-xs text-[var(--ide-text)] bg-[var(--ide-control-bg)] p-2.5 rounded-xl border border-[var(--ide-panel-border)] shadow-inner flex items-center justify-between">
            <code>{currentStep.codeLine}</code>
            <span className="text-[10px] text-[var(--ide-text-muted)] font-sans">
              Col {currentStep.sourceRef.column}
            </span>
          </div>

          <p className="text-xs text-[var(--ide-text)] leading-relaxed">
            {currentStep.description || currentStep.actionDescription}
          </p>

          <div className="flex items-center gap-2 pt-1 text-[11px] text-[var(--ide-text-muted)]">
            {currentStep.roomId && (
              <span className="glass-btn px-2 py-0.5 rounded-lg border border-[var(--ide-panel-border)]">
                Habitación: <strong className="text-[var(--ide-text)]">{currentStep.roomId}</strong>
              </span>
            )}
            {currentStep.activeObjectId && (
              <button
                onClick={() => onFocusObject(currentStep.activeObjectId!)}
                className="glass-btn bg-[var(--ide-accent-bg)] hover:bg-[var(--ide-btn-bg)] text-[var(--ide-accent)] px-2.5 py-0.5 rounded-lg border border-[var(--ide-accent)]/40 flex items-center gap-1 transition-colors"
              >
                <Compass className="w-3 h-3 text-[var(--ide-accent)]" />
                <span>Objeto activo: {currentStep.activeObjectId}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-8 text-center text-[var(--ide-text-muted)] space-y-2 glass-panel rounded-2xl border border-[var(--ide-panel-border)]">
          <Bug className="w-8 h-8 text-[var(--ide-text-muted)]" />
          <div className="text-sm font-semibold text-[var(--ide-text)]">
            No hay pasos de depuración disponibles
          </div>
          <p className="text-xs text-[var(--ide-text-muted)] max-w-sm">
            Compila el proyecto sin errores bloqueantes para habilitar el depurador espacial paso a paso.
          </p>
        </div>
      )}
    </div>
  );
};
