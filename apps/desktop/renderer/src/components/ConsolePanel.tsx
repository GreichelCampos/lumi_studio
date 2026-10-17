import React, { useState, useEffect, useMemo } from 'react';
import { 
  LumiState, 
  DiagnosticItem, 
  DebugStep, 
  ScenePlan, 
  DiagnosticSeverity, 
  DiagnosticCategory,
  IdeLogEvent,
  CompileResult,
  DebuggerStatus,
  PlaybackSpeed
} from '../types';
import { LumiMascot } from './LumiMascot';
import { OutputLogView } from './console/OutputLogView';
import { DiagnosticsListView } from './console/DiagnosticsListView';
import { SpatialDebuggerView } from './console/SpatialDebuggerView';
import { ideLogger } from '../services/logger/IdeLogService';
import { lumiAssistant, AssistantMessage } from '../services/assistant/LumiAssistantService';
import { 
  Terminal, 
  AlertCircle, 
  AlertTriangle, 
  Bug, 
  CheckCircle2, 
  RefreshCw,
} from 'lucide-react';

interface ConsolePanelProps {
  lumiState: LumiState;
  logs: string[];
  diagnostics: DiagnosticItem[];
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
  onNavigateToDiagnostic: (diag: DiagnosticItem) => void;
  onFocusObject: (objectId: string) => void;
  scenePlan: ScenePlan | null;
  onLumiClick?: () => void;
  isStale?: boolean;
  lastCompileResult?: CompileResult | null;
}

export const ConsolePanel: React.FC<ConsolePanelProps> = ({
  lumiState,
  logs,
  diagnostics,
  debugSteps,
  currentStepIndex,
  debuggerStatus = 'idle',
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
  onNavigateToDiagnostic,
  onFocusObject,
  scenePlan,
  onLumiClick,
  isStale = false,
  lastCompileResult = null,
}) => {
  const [activeMainTab, setActiveMainTab] = useState<'salida' | 'diagnosticos' | 'depurador'>('salida');
  const [ideEvents, setIdeEvents] = useState<IdeLogEvent[]>(() => ideLogger.getHistory());
  const [assistantMsg, setAssistantMsg] = useState<AssistantMessage>(() => lumiAssistant.getMessage());

  useEffect(() => {
    const unsubscribe = lumiAssistant.subscribe((msg) => {
      setAssistantMsg(msg);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = ideLogger.subscribe((newEvent) => {
      setIdeEvents((prev) => [...prev.slice(-150), newEvent]);
    });
    return unsubscribe;
  }, []);

  const errorCount = useMemo(() => diagnostics.filter((d) => d.severity === 'error').length, [diagnostics]);
  const warningCount = useMemo(() => diagnostics.filter((d) => d.severity === 'warning').length, [diagnostics]);

  const primaryRoom = scenePlan?.rooms[0] || null;

  // Active Mascot state priority: assistant message state if relevant, else compile state
  const activeMascotState = assistantMsg.state || lumiState;

  const handleClearOutput = () => {
    ideLogger.clear();
    setIdeEvents([]);
  };

  return (
    <div
      id="console-panel"
      className="relative w-full h-full flex flex-col glass-panel shadow-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-3 py-1.5 glass-panel-header select-none">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-4 h-4 text-[var(--ide-accent)] mr-1" />
          
          <button
            id="tab-salida-btn"
            onClick={() => setActiveMainTab('salida')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeMainTab === 'salida'
                ? 'glass-tab-active text-[var(--ide-text)] border-[var(--ide-accent)] font-semibold'
                : 'glass-tab-inactive text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
            }`}
          >
            <span>Salida</span>
          </button>

          <button
            id="tab-diagnosticos-btn"
            onClick={() => setActiveMainTab('diagnosticos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeMainTab === 'diagnosticos'
                ? 'glass-tab-active text-[var(--ide-text)] border-[var(--ide-accent)] font-semibold'
                : 'glass-tab-inactive text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
            }`}
          >
            <span>Diagnósticos</span>
            {diagnostics.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  errorCount > 0
                    ? 'bg-rose-500 text-white shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                    : warningCount > 0
                    ? 'bg-amber-500 text-black'
                    : 'bg-[var(--ide-btn-bg)] text-[var(--ide-text)]'
                }`}
              >
                {diagnostics.length}
              </span>
            )}
          </button>

          <button
            id="tab-depurador-btn"
            onClick={() => setActiveMainTab('depurador')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeMainTab === 'depurador'
                ? 'glass-tab-active text-[var(--ide-text)] border-[var(--ide-accent)] font-semibold'
                : 'glass-tab-inactive text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
            }`}
          >
            <Bug className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
            <span>Depurador Espacial</span>
            {debugSteps.length > 0 && (
              <span className="text-[10px] text-[var(--ide-text-muted)] font-mono">
                ({debugSteps.length})
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isStale && (
            <span className="flex items-center gap-1 text-xs text-amber-300 glass-btn border-amber-400/40 px-2.5 py-1 rounded-full font-medium" title="El código ha cambiado. Presiona Compilar (F5)">
              <RefreshCw className="w-3 h-3 text-amber-400 animate-spin-slow" />
              <span>Compilación obsoleta</span>
            </span>
          )}

          {lumiState === 'compiling' && (
            <span className="flex items-center gap-1.5 text-xs text-[var(--ide-text)] glass-btn border-[var(--ide-panel-border)] px-2.5 py-1 rounded-full font-medium">
              <RefreshCw className="w-3 h-3 text-[var(--ide-accent)] animate-spin" />
              <span>Compilando...</span>
            </span>
          )}

          {lumiState === 'success' && !isStale && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-300 glass-btn border-emerald-400/40 px-2.5 py-1 rounded-full font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{lastCompileResult?.origin === 'python'
                ? lastCompileResult.operation === 'execute' ? 'Ejecución terminada' : 'Análisis terminado'
                : 'Compilación exitosa'}</span>
            </span>
          )}

          {lumiState === 'error' && (
            <span className="flex items-center gap-1.5 text-xs text-rose-300 glass-btn border-rose-400/40 px-2.5 py-1 rounded-full font-medium">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>{diagnostics.some((item) => item.severity === 'unspecified')
                ? `${diagnostics.length} diagnóstico(s)`
                : diagnostics.length === 0 ? 'Fallo de infraestructura'
                : `${errorCount} error${errorCount !== 1 ? 'es' : ''}`}</span>
            </span>
          )}

          {lumiState === 'warning' && (
            <span className="flex items-center gap-1.5 text-xs text-amber-300 glass-btn border-amber-400/40 px-2.5 py-1 rounded-full font-medium">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>{lastCompileResult?.status === 'incomplete' ? 'Análisis incompleto'
                : `${warningCount} advertencia${warningCount !== 1 ? 's' : ''}`}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 relative flex overflow-hidden min-h-0">
        <div className="flex-1 overflow-y-auto p-3 pb-24 font-mono text-xs text-[var(--ide-text)] space-y-2 min-w-0">
          {activeMainTab === 'salida' && (
            <OutputLogView
              events={ideEvents}
              logs={logs}
              lastCompileResult={lastCompileResult}
              scenePlan={scenePlan}
              primaryRoom={primaryRoom}
              errorCount={errorCount}
              warningCount={warningCount}
              onClear={handleClearOutput}
            />
          )}

          {activeMainTab === 'diagnosticos' && (
            <DiagnosticsListView
              diagnostics={diagnostics}
              onNavigateToDiagnostic={onNavigateToDiagnostic}
              onFocusObject={onFocusObject}
            />
          )}

          {activeMainTab === 'depurador' && (
            <SpatialDebuggerView
              debugSteps={debugSteps}
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
              onFocusObject={onFocusObject}
            />
          )}
        </div>

        <div
          aria-label="Asistente Lumi"
          className="absolute right-4 bottom-2 z-20 pointer-events-auto flex items-center justify-end select-none"
        >
          <LumiMascot
            state={activeMascotState}
            size={68}
            isAnimated={true}
            showSpeechBubble={Boolean(assistantMsg.text)}
            message={assistantMsg.text}
            onClick={onLumiClick}
          />
        </div>
      </div>
    </div>
  );
};
