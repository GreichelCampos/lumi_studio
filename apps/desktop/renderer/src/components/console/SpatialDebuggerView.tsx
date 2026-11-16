import React from 'react';
import {
  DebugStep,
  DebuggerStatus,
  PlaybackSpeed,
  CompileResult,
  DiagnosticItem,
} from '../../types';
import { Bug, Compass } from 'lucide-react';
import { DebuggerControls } from './DebuggerControls';
import { getDebuggerStatusInfo } from './debuggerUtils';
import { validDebugSource, resolveDebugStep } from '../../services/editor/debugStepNavigation';
import { PythonDebuggerStatus } from './PythonDebuggerStatus';

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
  lastCompileResult?: CompileResult | null;
  onNavigateToDiagnostic?: (diagnostic: DiagnosticItem) => void;
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
  lastCompileResult,
  onNavigateToDiagnostic,
}) => {
  const currentStep = debugSteps.length > 0 ? debugSteps[currentStepIndex] : undefined;
  const statusInfo = getDebuggerStatusInfo(debuggerStatus);
  const source = validDebugSource(currentStep?.sourceRef) ? currentStep.sourceRef : null;
  const objectId = resolveDebugStep(null, currentStep ?? null).activeObjectId;
  const inspectedEntity = (() => {
    if (!currentStep?.activeObjectId || !currentStep.sceneSnapshot) return null;
    const rooms = currentStep.roomId
      ? currentStep.sceneSnapshot.rooms.filter(room => room.id === currentStep.roomId)
      : currentStep.sceneSnapshot.rooms;
    for (const room of rooms) {
      const object = room.objects.find(item => item.id === currentStep.activeObjectId);
      if (object) return { room: room.name, kind: object.type, name: object.name,
        placed: object.position !== undefined, position: object.position, rotation: object.rotation,
        dimensions: object.dimensions };
      const door = room.doors.find(item => item.id === currentStep.activeObjectId);
      if (door) return { room: room.name, kind: 'puerta', name: door.name ?? door.id,
        dimensions: [door.width, door.height] };
      const window = room.windows.find(item => item.id === currentStep.activeObjectId);
      if (window) return { room: room.name, kind: 'ventana', name: window.name ?? window.id,
        dimensions: [window.width, window.height] };
      const wall = Object.values(room.walls).find(item => item.id === currentStep.activeObjectId);
      if (wall) return { room: room.name, kind: 'pared', name: wall.name ?? wall.id };
    }
    return null;
  })();

  return (
    <div className="space-y-3 font-sans">
      <p className="text-xs text-[var(--ide-text-muted)]">
        Reproducción de snapshots espaciales de Python, archivos .lumic o demostraciones compatibles.
      </p>
      {lastCompileResult?.origin === 'python' && (
        <PythonDebuggerStatus result={lastCompileResult} onNavigateToDiagnostic={onNavigateToDiagnostic} />
      )}
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
                {source ? `Línea ${source.line} (${source.file}):` : 'Sin referencia de código disponible'}
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
              {source?.column !== undefined ? `Col ${source.column}` : 'Sin columna disponible'}
            </span>
          </div>

          <p className="text-xs text-[var(--ide-text)] leading-relaxed">
            {currentStep.description || currentStep.actionDescription}
          </p>
          {inspectedEntity && (
            <dl aria-label="Inspección espacial del paso" className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-xl border border-[var(--ide-panel-border)] bg-[var(--ide-control-bg)] p-2.5 text-[11px]">
              <dt className="text-[var(--ide-text-muted)]">Habitación</dt><dd>{inspectedEntity.room}</dd>
              <dt className="text-[var(--ide-text-muted)]">Elemento</dt><dd>{inspectedEntity.name}</dd>
              <dt className="text-[var(--ide-text-muted)]">Tipo</dt><dd>{inspectedEntity.kind}</dd>
              {'placed' in inspectedEntity && <><dt className="text-[var(--ide-text-muted)]">Estado</dt><dd>{inspectedEntity.placed ? 'Colocado' : 'Declarado, sin colocar'}</dd></>}
              {'position' in inspectedEntity && inspectedEntity.position && <><dt className="text-[var(--ide-text-muted)]">Posición</dt><dd>{inspectedEntity.position.join(', ')}</dd></>}
              {'rotation' in inspectedEntity && inspectedEntity.rotation && <><dt className="text-[var(--ide-text-muted)]">Rotación</dt><dd>{inspectedEntity.rotation.join(', ')}°</dd></>}
              {'dimensions' in inspectedEntity && inspectedEntity.dimensions && <><dt className="text-[var(--ide-text-muted)]">Dimensiones</dt><dd>{inspectedEntity.dimensions.join(' × ')} m</dd></>}
            </dl>
          )}
          {currentStep.spatialState && (
            <details className="text-xs">
              <summary>Estado registrado del paso</summary>
              <pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(currentStep.spatialState, null, 2)}</pre>
            </details>
          )}

          <div className="flex items-center gap-2 pt-1 text-[11px] text-[var(--ide-text-muted)]">
            {currentStep.roomId && (
              <span className="glass-btn px-2 py-0.5 rounded-lg border border-[var(--ide-panel-border)]">
                Habitación: <strong className="text-[var(--ide-text)]">{currentStep.roomId}</strong>
              </span>
            )}
            {objectId && (
              <button
                onClick={() => onFocusObject(objectId)}
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
            Ejecutá un programa Lumi con F6 o importá un archivo .lumic que incluya pasos espaciales.
          </p>
        </div>
      )}
    </div>
  );
};
