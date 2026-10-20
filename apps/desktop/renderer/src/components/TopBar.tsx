import React, { useState, useRef, useEffect } from 'react';
import { LumiState, LumiProject } from '../types';
import { LumiMascot } from './LumiMascot';
import { useWindowControls } from '../hooks/useWindowControls';
import { 
  Hammer, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Minus, 
  Square, 
  X, 
  Sparkles,
  BookOpen,
  FileCode,
  FolderOpen,
  FolderPlus,
  Save,
  Download,
  Code2,
  Check,
  Settings
} from 'lucide-react';

interface TopBarProps {
  isRealBackend?: boolean;
  lumiState: LumiState;
  onCompile: () => void;
  onRun: () => void;
  isCompiling: boolean;
  isStale?: boolean;
  hasBlockingErrors?: boolean;
  canRun?: boolean;
  projects: LumiProject[];
  currentProject: LumiProject | null;
  onSelectProject: (projectId: string) => void;
  onNewProject: () => void;
  onOpenProjectModal: () => void;
  onOpenDocs: () => void;
  onOpenSettings?: () => void;
  onNewFile: () => void;
  onSaveFile: () => void;
  onSaveAll: () => void;
  onSaveAs?: () => void;
  onRenameProject?: () => void;
  onInsertRoomModal: () => void;
  dirtyCount?: number;
  onExportLumic?: () => { success: boolean; error?: string; fileName?: string };
  onImportLumicFile?: (file: File) => Promise<{ success: boolean; error?: string }>;
}

export const TopBar: React.FC<TopBarProps> = ({
  isRealBackend = false,
  lumiState,
  onCompile,
  onRun,
  isCompiling,
  isStale = false,
  hasBlockingErrors = false,
  canRun = true,
  projects,
  currentProject,
  onSelectProject,
  onNewProject,
  onOpenProjectModal,
  onOpenDocs,
  onOpenSettings,
  onNewFile,
  onSaveFile,
  onSaveAll,
  onSaveAs,
  onRenameProject,
  onInsertRoomModal,
  dirtyCount = 0,
  onExportLumic,
  onImportLumicFile,
}) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const windowControls = useWindowControls();
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const lumicFileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  const handleExport = () => {
    if (onExportLumic) {
      const res = onExportLumic();
      if (res.success) {
        showToast(`Artefacto exportado: ${res.fileName}`);
      } else {
        showToast(res.error || 'No se pudo exportar');
      }
    } else {
      showToast('Exportación no disponible');
    }
  };

  const handleTriggerImport = () => {
    lumicFileInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportLumicFile) {
      const res = await onImportLumicFile(file);
      if (res.success) {
        showToast(`Artefacto .lumic cargado: ${file.name}`);
      } else {
        showToast(res.error || 'Error al validar artefacto .lumic');
      }
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        handleTriggerImport();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const menus = [
    {
      id: 'archivo',
      label: 'Archivo',
      items: [
        { label: 'Nuevo archivo .lumi', action: onNewFile, shortcut: 'Ctrl+N' },
        { label: 'Guardar archivo actual', action: onSaveFile, shortcut: 'Ctrl+S' },
        ...(onSaveAs ? [{ label: 'Guardar archivo como...', action: onSaveAs }] : []),
        ...(onRenameProject ? [{ label: 'Renombrar proyecto...', action: onRenameProject }] : []),
        { label: 'Guardar todos los cambios', action: onSaveAll, shortcut: 'Ctrl+Shift+S' },
        { divider: true },
        { label: 'Nuevo proyecto...', action: onNewProject, shortcut: '' },
        { label: 'Abrir proyecto...', action: onOpenProjectModal, shortcut: 'Ctrl+O' },
        { divider: true },
        { 
          label: 'Exportar compilación (.lumic)...', 
          action: handleExport, 
          shortcut: 'Ctrl+E' 
        },
        { 
          label: 'Abrir compilación (.lumic)...', 
          action: handleTriggerImport, 
          shortcut: 'Ctrl+Shift+O' 
        },
      ]
    },
    {
      id: 'editar',
      label: 'Editar',
      items: [
        { 
          label: 'Formatear código Lumi (no disponible)',
          action: () => showToast('El formateador de código Lumi todavía no está implementado.'),
          shortcut: ''
        },
        { 
          label: 'Guardar espacio de trabajo', 
          action: onSaveAll, 
          shortcut: '' 
        },
        { divider: true },
        {
          label: 'Configuración...',
          action: () => onOpenSettings && onOpenSettings(),
          shortcut: 'Ctrl+,'
        },
      ]
    },
    {
      id: 'insertar',
      label: 'Insertar',
      items: [
        { 
          label: 'Habitación...', 
          action: onInsertRoomModal, 
          shortcut: 'Alt+H' 
        },
      ]
    },
    {
      id: 'proyecto',
      label: 'Proyecto',
      items: [
        ...projects.map((p) => ({
          label: p.name,
          action: () => onSelectProject(p.id),
          shortcut: currentProject?.id === p.id ? '✓' : '',
        })),
        { divider: true },
        { label: 'Crear nuevo proyecto...', action: onNewProject, shortcut: '' },
        { label: 'Gestionar todos los proyectos...', action: onOpenProjectModal, shortcut: '' },
      ]
    },
    {
      id: 'compilar',
      label: 'Compilar',
      items: [
        { label: 'Compilar código Lumi (F5)', action: onCompile, shortcut: 'F5' },
        { label: isRealBackend ? 'Analizar archivo principal' : 'Compilación de demostración', action: onCompile, shortcut: '' },
      ]
    },
    {
      id: 'ejecutar',
      label: 'Ejecutar',
      items: [
        { label: isRealBackend ? 'Ejecutar con Python' : 'Ejecutar y renderizar 3D', action: onRun, shortcut: 'F6' },
        { label: isRealBackend ? 'Ejecutar archivo principal' : 'Mostrar escena de demostración', action: onRun, shortcut: '' },
      ]
    },
    {
      id: 'ayuda',
      label: 'Ayuda',
      items: [
        { label: 'Ayuda de sintaxis Lumi', action: onOpenDocs, shortcut: 'F1' },
        { label: 'Configuración del IDE', action: () => onOpenSettings && onOpenSettings(), shortcut: 'Ctrl+,' },
        { divider: true },
        { label: 'Acerca de Estudio Lumi', action: onOpenDocs, shortcut: '' },
      ]
    }
  ];

  return (
    <div
      id="top-window-bar"
      className="relative z-40 glass-topbar text-[var(--ide-text)] select-none flex flex-col"
    >
      <input
        type="file"
        ref={lumicFileInputRef}
        accept=".lumic,.json"
        className="hidden"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {(feedbackToast || windowControls.error) && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 px-4 py-2 glass-card border-[var(--ide-panel-border)] text-[var(--ide-text)] text-xs font-semibold rounded-2xl shadow-2xl animate-fade-in flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
          <span role={windowControls.error ? 'alert' : undefined}>{feedbackToast || windowControls.error}</span>
        </div>
      )}

      <div data-testid="window-titlebar" className={`${windowControls.available ? 'lumi-window-drag ' : ''}flex items-center justify-between px-3 py-1 bg-white/[0.02] border-b border-[var(--ide-panel-border)] text-[11px] text-[var(--ide-text-muted)]`}>
        <div className="flex items-center gap-2">
          <LumiMascot state={lumiState} size={16} isAnimated={false} />
          <span className="font-semibold text-[var(--ide-text)] tracking-wide">Studio LUMI</span>
          <span className="opacity-30">|</span>
          <span className="text-[var(--ide-text-muted)] font-mono text-[10px]">
            {currentProject ? `${currentProject.name} — ${currentProject.location || 'Espacio local'}` : 'Sin proyecto'}
          </span>
          {dirtyCount > 0 && (
            <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-sans font-semibold">
              ● {dirtyCount} modificado{dirtyCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Original Lumi controls; desktop operations stay behind preload. */}
        <div className="flex items-center gap-1.5">
          <button 
            className="p-1 hover:bg-[var(--ide-btn-bg)] rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
            title="Minimizar ventana"
            aria-label="Minimizar ventana"
            onClick={() => void windowControls.control('minimize')}
          >
            <Minus className="w-3 h-3" />
          </button>
          <button 
            className="p-1 hover:bg-[var(--ide-btn-bg)] rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
            title={windowControls.maximized ? 'Restaurar ventana' : 'Maximizar ventana'}
            aria-label={windowControls.maximized ? 'Restaurar ventana' : 'Maximizar ventana'}
            onClick={() => void windowControls.control('toggleMaximize')}
          >
            <Square className="w-2.5 h-2.5" />
          </button>
          <button 
            className="p-1 hover:bg-rose-500/20 rounded-lg text-[var(--ide-text-muted)] hover:text-rose-400 transition-colors"
            title="Cerrar ventana"
            aria-label="Cerrar ventana"
            onClick={() => void windowControls.control('close')}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between px-3 h-9 bg-[var(--ide-control-bg,rgba(0,0,0,0.1))] border-b border-[var(--ide-panel-border)] relative z-30">
        <div className="flex items-center gap-1" ref={menuRef}>
          {menus.map((menu) => (
            <div key={menu.id} className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)}
                className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
                  openMenu === menu.id
                    ? 'bg-[var(--ide-btn-bg)] text-[var(--ide-text)] border border-[var(--ide-btn-border)] shadow-sm'
                    : 'text-[var(--ide-text-muted)] hover:bg-[var(--ide-btn-bg)] hover:text-[var(--ide-text)] border border-transparent'
                }`}
              >
                {menu.label}
              </button>

              {openMenu === menu.id && (
                <div className="absolute left-0 top-full mt-1.5 w-56 glass-dropdown border border-[var(--ide-panel-border)] rounded-2xl shadow-2xl py-1.5 z-50 animate-fade-in text-xs text-[var(--ide-text)]">
                  {menu.items.map((item, idx) => {
                    if ('divider' in item && item.divider) {
                      return <div key={idx} className="my-1 border-t border-[var(--ide-panel-border)]" />;
                    }
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setOpenMenu(null);
                          if ('action' in item && item.action) item.action();
                        }}
                        className="w-full text-left px-3.5 py-1.5 hover:bg-[var(--ide-btn-bg)] hover:text-[var(--ide-text)] text-[var(--ide-text)] flex items-center justify-between transition-colors"
                      >
                        <span>{'label' in item ? item.label : ''}</span>
                        {'shortcut' in item && item.shortcut && (
                          <span className="text-[10px] text-[var(--ide-text-muted)] font-mono">
                            {item.shortcut}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {onOpenSettings && (
            <button
              id="topbar-settings-button"
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium text-[var(--ide-text-muted)] hover:bg-[var(--ide-btn-bg)] hover:text-[var(--ide-text)] border border-transparent transition-all ml-0.5"
              title="Configuración del IDE (Ctrl+,) - Temas de color, fuentes y visor 3D"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Ajustes</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSaveFile}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl glass-btn text-[var(--ide-text)] text-xs font-semibold hover:text-[var(--ide-text)] transition-all shadow-sm"
            title="Guardar archivo actual (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
            <span>Guardar</span>
          </button>

          <button
            onClick={onCompile}
            disabled={isCompiling}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl glass-btn text-[var(--ide-text)] text-xs font-semibold hover:text-[var(--ide-text)] transition-all shadow-sm"
            title="Compilar y validar sintaxis (F5)"
          >
            <Hammer className={`w-3.5 h-3.5 text-[var(--ide-accent)] ${isCompiling ? 'animate-spin' : ''}`} />
            <span>{isCompiling ? 'Compilando...' : 'Compilar'}</span>
          </button>

          <button
            onClick={onRun}
            disabled={canRun === false || hasBlockingErrors}
            className={`flex items-center gap-1.5 px-3.5 py-1 rounded-xl text-xs font-bold transition-all ${
              canRun === false || hasBlockingErrors
                ? 'bg-black/10 dark:bg-white/5 text-[var(--ide-text-muted)] cursor-not-allowed border border-[var(--ide-panel-border)]'
                : 'bg-[var(--ide-accent)] hover:brightness-110 text-[var(--ide-accent-text,#02110c)] shadow-lg border border-[var(--ide-accent)] active:scale-95'
            }`}
            title={isRealBackend ? 'Ejecutar con Python (F6)' : 'Ejecutar y renderizar espacio 3D (F6)'}
          >
            <Play className={`w-3.5 h-3.5 ${canRun === false || hasBlockingErrors ? 'opacity-40' : 'fill-current'}`} />
            <span>{isRealBackend ? 'Ejecutar Python' : 'Ejecutar 3D'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
