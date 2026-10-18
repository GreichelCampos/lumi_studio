import React, { useState, useRef, useEffect } from 'react';
import { LumiProject, LumiFile } from '../types';
import { 
  Folder, 
  FolderOpen, 
  FileCode, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Trash2, 
  Layers, 
  BookOpen,
  Star,
  Edit3,
  MoreVertical,
  FolderPlus,
  Compass,
  FilePlus,
  Check
} from 'lucide-react';

interface ProjectExplorerProps {
  currentProject: LumiProject | null;
  projects: LumiProject[];
  onSelectProject: (projectId: string) => void;
  activeFileId: string | null;
  onSelectFile: (fileId: string) => void;
  onNewFile: () => void;
  onNewProject: () => void;
  onOpenProjectModal: () => void;
  onRenameFile: (file: LumiFile) => void;
  onDeleteFile: (file: LumiFile) => void;
  onSetEntryFile: (fileId: string) => void;
  onOpenDocs: () => void;
  isDirty?: (fileId: string) => boolean;
}

export const ProjectExplorer: React.FC<ProjectExplorerProps> = ({
  currentProject,
  projects,
  onSelectProject,
  activeFileId,
  onSelectFile,
  onNewFile,
  onNewProject,
  onOpenProjectModal,
  onRenameFile,
  onDeleteFile,
  onSetEntryFile,
  onOpenDocs,
  isDirty,
}) => {
  const [folderOpen, setFolderOpen] = useState(true);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [activeMenuFileId, setActiveMenuFileId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuFileId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      id="project-explorer-panel"
      className="relative w-full h-full flex flex-col glass-panel shadow-2xl overflow-hidden select-none"
    >
      <div className="flex items-center justify-between px-4 py-3 glass-panel-header">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[var(--ide-accent)] drop-shadow-[0_0_8px_var(--ide-accent-bg)]" />
          <span className="text-xs font-semibold text-[var(--ide-accent)] uppercase tracking-wider">
            Explorador
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onNewFile}
            disabled={!currentProject}
            className="p-1.5 rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-btn-bg)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            title="Nuevo archivo .lumi"
            aria-label="Nuevo archivo .lumi"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onNewProject}
            className="p-1.5 rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-btn-bg)] transition-all"
            title="Nuevo proyecto Lumi"
            aria-label="Nuevo proyecto Lumi"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onOpenDocs}
            className="p-1.5 rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-btn-bg)] transition-all"
            title="Manual y Sintaxis Lumi"
            aria-label="Manual y Sintaxis Lumi"
          >
            <BookOpen className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="px-3 pt-2.5 pb-2.5 border-b border-[var(--ide-panel-border)]">
        <div className="relative">
          {currentProject ? (
            <button
              onClick={() => setShowProjectPicker(!showProjectPicker)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl glass-btn text-xs text-[var(--ide-text)] font-medium transition-all"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-[var(--ide-accent)] shadow-[0_0_8px_rgba(255,255,255,0.4)] flex-shrink-0" />
                <span className="truncate font-semibold">{currentProject.name}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--ide-text-muted)] flex-shrink-0" />
            </button>
          ) : (
            <button
              onClick={onOpenProjectModal}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[var(--ide-accent)] text-[var(--ide-accent-text,#02110c)] font-semibold transition-all shadow-sm"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Abrir Proyecto...</span>
            </button>
          )}

          {showProjectPicker && (
            <div className="absolute top-full left-0 right-0 mt-1.5 z-30 glass-dropdown border border-[var(--ide-panel-border)] rounded-2xl shadow-2xl overflow-hidden py-1.5 animate-fade-in text-[var(--ide-text)]">
              <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-[var(--ide-text-muted)] tracking-wider flex items-center justify-between border-b border-[var(--ide-panel-border)]">
                <span>Espacios de Trabajo</span>
                <span className="text-[var(--ide-text)] font-mono">{projects.length}</span>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {projects.map((proj) => (
                  <button
                    key={proj.id}
                    onClick={() => {
                      onSelectProject(proj.id);
                      setShowProjectPicker(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-[var(--ide-btn-bg)] hover:text-[var(--ide-text)] transition-colors ${
                      currentProject?.id === proj.id ? 'bg-[var(--ide-btn-bg)] text-[var(--ide-text)] font-semibold' : 'text-[var(--ide-text-muted)]'
                    }`}
                  >
                    <span className="truncate">{proj.name}</span>
                    {currentProject?.id === proj.id && (
                      <Check className="w-3.5 h-3.5 text-[var(--ide-accent)] flex-shrink-0 ml-1" />
                    )}
                  </button>
                ))}
              </div>
              <div className="pt-1.5 mt-1 border-t border-[var(--ide-panel-border)] px-2 space-y-1">
                <button
                  onClick={() => {
                    setShowProjectPicker(false);
                    onOpenProjectModal();
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-[11px] rounded-xl text-[var(--ide-text-muted)] hover:bg-[var(--ide-btn-bg)] hover:text-[var(--ide-text)] flex items-center gap-1.5 transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
                  <span>Gestionar todos los proyectos...</span>
                </button>
                <button
                  onClick={() => {
                    setShowProjectPicker(false);
                    onNewProject();
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-[11px] rounded-xl text-[var(--ide-text)] hover:bg-[var(--ide-btn-bg)] flex items-center gap-1.5 font-semibold transition-colors"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
                  <span>Crear nuevo proyecto...</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {!currentProject ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8 space-y-3">
            <div className="p-3 rounded-2xl bg-[var(--ide-control-bg,rgba(0,0,0,0.1))] text-[var(--ide-accent)]">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--ide-text)]">Sin proyecto abierto</p>
              <p className="text-[11px] text-[var(--ide-text-muted)] mt-0.5">Crea o abre un proyecto para ver sus archivos</p>
            </div>
            <div className="flex flex-col w-full gap-1.5 pt-2">
              <button
                onClick={onNewProject}
                className="w-full py-1.5 px-3 rounded-xl bg-[var(--ide-accent)] text-[var(--ide-accent-text,#02110c)] font-bold text-xs hover:brightness-110 transition-all flex items-center justify-center gap-1.5 shadow-md"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Nuevo Proyecto</span>
              </button>
              <button
                onClick={onOpenProjectModal}
                className="w-full py-1.5 px-3 rounded-xl glass-btn text-[var(--ide-text-muted)] font-semibold text-xs hover:text-[var(--ide-text)] transition-all flex items-center justify-center gap-1.5"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Abrir Existente</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-1">
            <div
              onClick={() => setFolderOpen(!folderOpen)}
              className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-semibold text-[var(--ide-text)] hover:bg-[var(--ide-btn-bg)] cursor-pointer select-none transition-colors"
            >
              <div className="flex items-center gap-1.5 truncate">
                {folderOpen ? <ChevronDown className="w-3.5 h-3.5 text-[var(--ide-accent)] flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-[var(--ide-text-muted)] flex-shrink-0" />}
                {folderOpen ? <FolderOpen className="w-4 h-4 text-[var(--ide-accent)] flex-shrink-0" /> : <Folder className="w-4 h-4 text-[var(--ide-text-muted)] flex-shrink-0" />}
                <span className="font-mono text-[var(--ide-text)] truncate">{currentProject.name}</span>
              </div>
              <span className="text-[10px] text-[var(--ide-text-muted)] font-mono">
                {currentProject.files.length}
              </span>
            </div>

            {folderOpen && (
              <div className="ml-3 pl-2 border-l border-[var(--ide-panel-border)] mt-1 space-y-0.5">
                {currentProject.files.length === 0 ? (
                  <div className="py-4 text-center px-2">
                    <p className="text-[11px] text-[var(--ide-text-muted)] mb-2">No hay archivos en este proyecto</p>
                    <button
                      onClick={onNewFile}
                      className="px-3 py-1 rounded-lg bg-[var(--ide-btn-bg)] text-[var(--ide-text)] border border-[var(--ide-btn-border)] text-[11px] font-semibold hover:brightness-110 transition-all flex items-center gap-1 mx-auto"
                    >
                      <FilePlus className="w-3 h-3" />
                      <span>Crear archivo</span>
                    </button>
                  </div>
                ) : (
                  currentProject.files.map((file) => {
                    const isActive = file.id === activeFileId;
                    const isFileDirty = isDirty ? isDirty(file.id) : false;
                    const isEntry = file.isEntry || file.id === currentProject.entryFileId;
                    const isMenuOpen = activeMenuFileId === file.id;

                    return (
                      <div
                        key={file.id}
                        data-testid={`explorer-file-${file.id}`}
                        title={file.path}
                        onClick={() => onSelectFile(file.id)}
                        className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-mono cursor-pointer transition-all ${
                          isActive
                            ? 'bg-[var(--ide-btn-bg)] text-[var(--ide-text)] border border-[var(--ide-btn-border)] font-semibold shadow-sm'
                            : 'text-[var(--ide-text-muted)] hover:bg-[var(--ide-btn-bg)] hover:text-[var(--ide-text)] border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-1 truncate">
                          <FileCode className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-[var(--ide-accent)]' : 'text-[var(--ide-text-muted)]'}`} />
                          <span className="truncate">{file.name}</span>
                          
                          {isFileDirty && (
                            <span 
                              className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 animate-pulse" 
                              title="Cambios sin guardar"
                            />
                          )}

                          {isEntry && (
                            <span 
                              className="text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 px-1 py-0.2 rounded tracking-tight flex-shrink-0"
                              title="Archivo principal de compilación (Punto de entrada)"
                            >
                              PRINCIPAL
                            </span>
                          )}
                        </div>

                        <div className="relative flex items-center gap-0.5 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuFileId(isMenuOpen ? null : file.id);
                            }}
                            className={`p-1 rounded-md text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-btn-bg)] transition-all ${
                              isMenuOpen ? 'opacity-100 bg-[var(--ide-btn-bg)]' : 'opacity-0 group-hover:opacity-100'
                            }`}
                            title="Opciones de archivo"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {isMenuOpen && (
                            <div
                              ref={menuRef}
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-full mt-1 z-40 w-48 glass-dropdown border border-[var(--ide-panel-border)] rounded-2xl shadow-2xl py-1.5 text-[var(--ide-text)]"
                            >
                              {!isEntry && (
                                <button
                                  onClick={() => {
                                    onSetEntryFile(file.id);
                                    setActiveMenuFileId(null);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--ide-btn-bg)] hover:text-[var(--ide-text)] flex items-center gap-2 transition-colors"
                                >
                                  <Star className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Establecer como principal</span>
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  onRenameFile(file);
                                  setActiveMenuFileId(null);
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--ide-btn-bg)] hover:text-[var(--ide-text)] flex items-center gap-2 transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
                                <span>Renombrar...</span>
                              </button>

                              <button
                                onClick={() => {
                                  onDeleteFile(file);
                                  setActiveMenuFileId(null);
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-rose-500/20 text-rose-400 flex items-center gap-2 transition-colors border-t border-[var(--ide-panel-border)] mt-0.5 pt-1.5"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                <span>Eliminar archivo</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {currentProject && (
        <div className="p-3 bg-[var(--ide-control-bg,rgba(0,0,0,0.1))] border-t border-[var(--ide-panel-border)] text-[11px] text-[var(--ide-text-muted)]">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--ide-accent)] shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
              <span className="font-semibold text-[var(--ide-text)]">Espacio de Trabajo</span>
            </div>
            {currentProject.entryFileId && (
              <span className="text-[10px] text-amber-400 font-mono">
                Entry: {currentProject.files.find(f => f.id === currentProject.entryFileId)?.name || 'principal.lumi'}
              </span>
            )}
          </div>
          <p className="text-[10px] text-[var(--ide-text-muted)] leading-relaxed truncate">
            {currentProject.description || currentProject.location || 'Proyecto Lumi'}
          </p>
        </div>
      )}
    </div>
  );
};
