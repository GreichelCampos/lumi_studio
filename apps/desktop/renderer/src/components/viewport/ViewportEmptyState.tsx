import React from 'react';
import { Hammer, AlertCircle, Box, Layers, Plus } from 'lucide-react';

export type EmptyStateType = 'no_compile' | 'analysis_completed' | 'analysis_incomplete' | 'compile_errors' | 'execution_error' | 'no_rooms' | 'empty_scene' | 'scene_unavailable';

interface ViewportEmptyStateProps {
  type: EmptyStateType;
  onCompile?: () => void;
  onInsertRoom?: () => void;
}

const initialShortcuts = [
  { key: 'F5', label: 'Analizar código' },
  { key: 'F6', label: 'Ejecutar Lumi' },
];

export const ViewportEmptyState: React.FC<ViewportEmptyStateProps> = ({
  type,
  onCompile,
  onInsertRoom,
}) => {
  const config = {
    scene_unavailable: {
      icon: Box,
      iconColor: 'text-[var(--ide-accent)]', bgColor: 'bg-[var(--ide-accent-bg)]',
      borderColor: 'border-[var(--ide-panel-border)]',
      title: 'Sin escena 3D',
      description: 'Usa Ejecutar Lumi (F6) con una habitación en el programa o importa un archivo .lumic. Si la ejecución se detuvo, revisa Diagnósticos.',
      actionText: '', actionFn: undefined,
    },
    no_compile: {
      icon: Hammer,
      iconColor: 'text-[var(--ide-accent)]',
      bgColor: 'bg-[var(--ide-accent-bg)]',
      borderColor: 'border-[var(--ide-accent)]/40',
      title: 'Todo listo para comenzar',
      description: 'Escribí tu código Lumi y utilizá las herramientas del IDE para compilarlo, ejecutarlo y visualizar los espacios que construyas.',
      actionText: '',
      actionFn: undefined,
    },
    analysis_completed: {
      icon: Hammer,
      iconColor: 'text-[var(--ide-accent)]',
      bgColor: 'bg-[var(--ide-accent-bg)]',
      borderColor: 'border-[var(--ide-accent)]/40',
      title: 'Análisis finalizado',
      description: 'Usá Ejecutar Lumi (F6) para visualizar la habitación.',
      actionText: '',
      actionFn: undefined,
    },
    analysis_incomplete: {
      icon: AlertCircle,
      iconColor: 'text-amber-400',
      bgColor: 'bg-amber-950/40',
      borderColor: 'border-amber-500/30',
      title: 'Análisis incompleto',
      description: 'El código fue analizado, pero algunas comprobaciones todavía no están disponibles. Usá Ejecutar Lumi (F6) para comprobar el espacio y dibujar la escena.',
      actionText: '',
      actionFn: undefined,
    },
    compile_errors: {
      icon: AlertCircle,
      iconColor: 'text-rose-400',
      bgColor: 'bg-rose-950/40',
      borderColor: 'border-rose-500/40',
      title: 'Compilación con errores',
      description: 'Existen errores bloqueantes en el código Lumi. Revise los diagnósticos para solucionarlos antes de visualizar el 3D.',
      actionText: 'Reintentar compilación',
      actionFn: onCompile,
    },
    execution_error: {
      icon: AlertCircle,
      iconColor: 'text-rose-400',
      bgColor: 'bg-rose-950/40',
      borderColor: 'border-rose-500/40',
      title: 'La ejecución no pudo completarse',
      description: 'Revisá la consola y los diagnósticos para conocer el error real de la ejecución. No se mostrará una escena anterior.',
      actionText: '',
      actionFn: undefined,
    },
    no_rooms: {
      icon: Box,
      iconColor: 'text-amber-400',
      bgColor: 'bg-amber-950/40',
      borderColor: 'border-amber-500/30',
      title: 'Sin habitaciones definidas',
      description: 'El proyecto no contiene bloques habitacion(...) válidos en el archivo de entrada.',
      actionText: 'Insertar habitación...',
      actionFn: onInsertRoom,
    },
    empty_scene: {
      icon: Layers,
      iconColor: 'text-[var(--ide-text-muted)]',
      bgColor: 'bg-[var(--ide-control-bg)]',
      borderColor: 'border-[var(--ide-panel-border)]',
      title: 'ScenePlan vacío',
      description: 'El plano espacial no tiene entidades registradas para renderizar.',
      actionText: 'Compilar código (F5)',
      actionFn: onCompile,
    },
  }[type];

  const Icon = config.icon;

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-[var(--ide-bg)]/85 backdrop-blur-sm select-none">
      <div className={`w-14 h-14 rounded-2xl ${config.bgColor} border ${config.borderColor} flex items-center justify-center ${config.iconColor} shadow-xl mb-3.5`}>
        <Icon className="w-7 h-7" />
      </div>

      <h3 className="text-sm font-bold text-[var(--ide-text)] mb-1">{config.title}</h3>
      <p className="text-xs text-[var(--ide-text-muted)] max-w-sm mb-4 leading-relaxed">
        {config.description}
      </p>

      {type === 'no_compile' && (
        <div className="flex items-center gap-2 mb-4" aria-label="Atajos principales">
          {initialShortcuts.map((shortcut) => (
            <div key={shortcut.key} className="glass-btn flex items-center gap-2 rounded-xl border border-[var(--ide-panel-border)] px-2.5 py-1.5 text-[11px] text-[var(--ide-text-muted)]">
              <kbd className="rounded-md border border-[var(--ide-accent)]/35 bg-[var(--ide-accent-bg)] px-1.5 py-0.5 font-mono font-bold text-[var(--ide-accent)]">
                {shortcut.key}
              </kbd>
              <span>{shortcut.label}</span>
            </div>
          ))}
        </div>
      )}

      {config.actionFn && (
        <button
          onClick={config.actionFn}
          className="px-4 py-2 rounded-xl bg-[var(--ide-accent)] hover:brightness-110 text-[var(--ide-accent-text)] font-bold text-xs transition-all shadow-md flex items-center gap-1.5"
        >
          {type === 'no_rooms' ? <Plus className="w-3.5 h-3.5" /> : <Hammer className="w-3.5 h-3.5" />}
          <span>{config.actionText}</span>
        </button>
      )}
    </div>
  );
};
