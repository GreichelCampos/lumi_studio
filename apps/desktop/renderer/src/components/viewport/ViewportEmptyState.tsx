import React from 'react';
import { Hammer, AlertCircle, Box, Layers, Plus } from 'lucide-react';

export type EmptyStateType = 'no_compile' | 'compile_errors' | 'no_rooms' | 'empty_scene' | 'scene_unavailable';

interface ViewportEmptyStateProps {
  type: EmptyStateType;
  onCompile?: () => void;
  onInsertRoom?: () => void;
}

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
      title: 'Sin ScenePlan para esta compilación',
      description: 'Esta respuesta de Python no incluye una escena 3D. Revisa el resultado y las capacidades pendientes en la consola; no se utiliza una escena simulada.',
      actionText: '', actionFn: undefined,
    },
    no_compile: {
      icon: Hammer,
      iconColor: 'text-[var(--ide-accent)]',
      bgColor: 'bg-[var(--ide-accent-bg)]',
      borderColor: 'border-[var(--ide-accent)]/40',
      title: 'Proyecto sin compilar',
      description: 'Presiona "Compilar (F5)" para procesar el código Lumi y generar el plano espacial 3D.',
      actionText: 'Compilar proyecto (F5)',
      actionFn: onCompile,
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
