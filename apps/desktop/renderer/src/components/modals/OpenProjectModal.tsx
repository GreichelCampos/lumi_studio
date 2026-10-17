import React, { useState } from 'react';
import { LumiProject } from '../../types';
import { 
  X, 
  FolderOpen, 
  Search, 
  FileCode, 
  Calendar, 
  Trash2, 
  Check, 
  Sparkles,
  Layers
} from 'lucide-react';

interface OpenProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: LumiProject[];
  currentProjectId: string;
  onSelectProject: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => void;
  onNewProjectClick?: () => void;
}

export const OpenProjectModal: React.FC<OpenProjectModalProps> = ({
  isOpen,
  onClose,
  projects,
  currentProjectId,
  onSelectProject,
  onDeleteProject,
  onNewProjectClick,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div 
      id="modal-open-project-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fade-in select-none"
    >
      <div 
        id="modal-open-project"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl glass-modal overflow-hidden text-slate-200 flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 glass-panel-header border-b border-[#f3ebd6]/15 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#4d6932]/30 text-[#f3ebd6] border border-[#4d6932]/50 shadow-[0_0_15px_rgba(77,105,50,0.3)]">
              <FolderOpen className="w-5 h-5 drop-shadow-[0_0_8px_rgba(243,235,214,0.4)]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#f3ebd6] tracking-tight">Abrir Proyecto Existente</h2>
              <p className="text-xs text-[#d5cbb2]">Selecciona un proyecto de tu espacio de trabajo</p>
            </div>
          </div>
          <button
            id="btn-close-open-project-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-[#d5cbb2] hover:text-[#f3ebd6] border border-transparent hover:border-[#f3ebd6]/15 transition-all"
            title="Cerrar modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-[#f3ebd6]/15 bg-[#02110c]/40 backdrop-blur-sm">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-[#8f9d95]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar proyecto por nombre o descripción..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#082016]/90 border border-[#f3ebd6]/20 text-xs text-[#f3ebd6] placeholder-[#8f9d95] focus:outline-none focus:border-[#f3ebd6] backdrop-blur-sm shadow-inner"
            />
          </div>
        </div>

        {/* Project List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredProjects.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#1a422f]/40 flex items-center justify-center mx-auto text-[#8f9d95]">
                <Layers className="w-6 h-6" />
              </div>
              <p className="text-sm text-[#d5cbb2] font-medium">No se encontraron proyectos</p>
              {onNewProjectClick && (
                <button
                  onClick={() => {
                    onClose();
                    onNewProjectClick();
                  }}
                  className="px-4 py-2 rounded-xl bg-[#4d6932]/30 text-[#f3ebd6] border border-[#4d6932]/50 text-xs font-semibold hover:bg-[#4d6932]/50 transition-all"
                >
                  Crear un nuevo proyecto
                </button>
              )}
            </div>
          ) : (
            filteredProjects.map((project) => {
              const isCurrent = project.id === currentProjectId;
              const filesCount = project.files.length;
              return (
                <div
                  key={project.id}
                  onClick={() => {
                    onSelectProject(project.id);
                    onClose();
                  }}
                  className={`group relative flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-[#1a422f]/50 border-[#f3ebd6]/50 shadow-md shadow-[#02110c]/50'
                      : 'bg-[#082016]/60 border-[#f3ebd6]/15 hover:border-[#f3ebd6]/35 hover:bg-[#1a422f]/30'
                  }`}
                >
                  <div className="space-y-1 pr-4 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#f3ebd6] truncate">
                        {project.name}
                      </span>
                      {isCurrent && (
                        <span className="flex items-center gap-1 text-[10px] bg-[#4d6932]/40 text-[#f3ebd6] border border-[#4d6932]/60 px-2 py-0.5 rounded-full font-semibold">
                          <Check className="w-3 h-3" />
                          <span>Abierto</span>
                        </span>
                      )}
                    </div>
                    {project.description && (
                      <p className="text-xs text-[#d5cbb2] line-clamp-1">
                        {project.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-[11px] text-[#8f9d95] pt-1">
                      <span className="flex items-center gap-1">
                        <FileCode className="w-3.5 h-3.5 text-[#f3ebd6]" />
                        <span>{filesCount} {filesCount === 1 ? 'archivo' : 'archivos'}</span>
                      </span>
                      {project.location && (
                        <span className="truncate max-w-[200px] text-[#8f9d95] font-mono text-[10px]">
                          {project.location}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProject(project.id);
                        onClose();
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isCurrent
                          ? 'bg-[#f3ebd6] text-[#082016] hover:bg-[#fff9ec]'
                          : 'bg-[#1a422f]/60 text-[#f3ebd6] hover:bg-[#1a422f]'
                      }`}
                    >
                      {isCurrent ? 'Continuar' : 'Abrir'}
                    </button>

                    {onDeleteProject && projects.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`¿Eliminar el proyecto "${project.name}" permanentemente?`)) {
                            onDeleteProject(project.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-[#8f9d95] hover:text-rose-400 hover:bg-rose-950/40 opacity-0 group-hover:opacity-100 transition-all"
                        title="Eliminar proyecto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 glass-panel-header border-t border-[#f3ebd6]/15 backdrop-blur-md">
          <div className="text-xs text-[#d5cbb2]">
            Total: <strong className="text-[#f3ebd6] font-mono">{projects.length}</strong> {projects.length === 1 ? 'proyecto' : 'proyectos'}
          </div>
          <div className="flex items-center gap-2.5">
            {onNewProjectClick && (
              <button
                onClick={() => {
                  onClose();
                  onNewProjectClick();
                }}
                className="px-4 py-2 rounded-xl bg-[#f3ebd6] hover:bg-[#fff9ec] text-[#082016] font-bold text-xs shadow-lg shadow-[#02110c]/40 border border-[#f3ebd6] transition-all active:scale-95"
              >
                Nuevo Proyecto...
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-[#f3ebd6]/15 text-[#d5cbb2] hover:text-[#f3ebd6] font-medium text-xs transition-all active:scale-95"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
