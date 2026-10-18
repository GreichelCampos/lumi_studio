import React, { useMemo } from 'react';
import { LumiFile } from '../../types';
import { useEditorTabScroll } from '../../hooks/useEditorTabScroll';
import { 
  FileCode, 
  X, 
  Plus, 
  Star, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';

export interface EditorTabBarProps {
  files: LumiFile[];
  openTabIds: string[];
  activeFileId: string | null;
  onSelectFile: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewFile: () => void;
  isDirty?: (fileId: string) => boolean;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Componente modular para la barra de pestañas del editor de código.
 * Gestiona la representación de las pestañas abiertas, el archivo activo,
 * insignias de archivo principal, indicadores de cambios pendientes,
 * cierre de pestañas, creación de nuevos archivos y desplazamiento horizontal.
 */
export const EditorTabBar: React.FC<EditorTabBarProps> = ({
  files,
  openTabIds,
  activeFileId,
  onSelectFile,
  onCloseTab,
  onNewFile,
  isDirty,
  actions,
  children,
}) => {
  const {
    tabsContainerRef,
    canScrollLeft,
    canScrollRight,
    scrollTabs,
  } = useEditorTabScroll({
    activeFileId,
    openTabCount: openTabIds.length,
  });

  // Filtrar y ordenar los archivos abiertos preservando el orden exacto de openTabIds
  const tabFiles = useMemo(() => {
    return openTabIds
      .map((id) => files.find((f) => f.id === id))
      .filter((f): f is LumiFile => f !== undefined);
  }, [openTabIds, files]);

  const actionElements = actions || children;

  return (
    <div className="flex items-center justify-between glass-panel-header px-2 pt-2 border-b border-[var(--ide-panel-border)] select-none min-w-0 overflow-hidden">
      <div className="flex items-center min-w-0 flex-1 relative overflow-hidden pr-2">
        {canScrollLeft && (
          <button
            onClick={() => scrollTabs('left')}
            className="p-1 mr-1 rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-btn-bg)] transition-colors flex-shrink-0 z-10"
            title="Desplazar pestañas hacia la izquierda"
            aria-label="Desplazar pestañas hacia la izquierda"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        )}

        <div
          ref={tabsContainerRef}
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth min-w-0 flex-1 py-0.5"
        >
          {tabFiles.map((file) => {
            const isActive = file.id === activeFileId;
            const fileDirty = isDirty ? isDirty(file.id) : false;

            return (
              <div
                key={file.id}
                data-active-tab={isActive ? 'true' : 'false'}
                data-testid={`tab-${file.id}`}
                onClick={() => onSelectFile(file.id)}
                className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-t-xl text-xs font-mono cursor-pointer transition-all border-t border-x flex-shrink-0 ${
                  isActive
                    ? 'glass-tab-active text-[var(--ide-text)] border-[var(--ide-accent)] font-semibold shadow-sm'
                    : 'glass-tab-inactive text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
                }`}
                title={file.name}
              >
                <FileCode className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-[var(--ide-accent)]' : 'text-[var(--ide-text-muted)]'}`} />
                <span className="truncate max-w-[120px] sm:max-w-[140px]">{file.name}</span>

                {file.isEntry && (
                  <span title="Archivo Principal" className="inline-flex">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />
                  </span>
                )}

                <div className="flex items-center ml-1">
                  {fileDirty && (
                    <span
                      data-testid={`dirty-indicator-${file.id}`}
                      className="w-2 h-2 rounded-full bg-amber-400 group-hover:hidden transition-all shadow-[0_0_6px_rgba(251,191,36,0.8)]"
                      title="Archivo con cambios sin guardar"
                    />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(file.id);
                    }}
                    className={`p-0.5 rounded-md hover:bg-[var(--ide-btn-bg)] hover:text-rose-400 text-[var(--ide-text-muted)] transition-colors ${
                      fileDirty ? 'hidden group-hover:flex' : 'flex'
                    }`}
                    title="Cerrar pestaña"
                    aria-label={`Cerrar pestaña ${file.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}

          <button
            onClick={onNewFile}
            className="p-1.5 ml-0.5 rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-btn-bg)] transition-colors flex-shrink-0"
            title="Crear nuevo archivo .lumi"
            aria-label="Crear nuevo archivo .lumi"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {canScrollRight && (
          <button
            onClick={() => scrollTabs('right')}
            className="p-1 ml-1 rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-btn-bg)] transition-colors flex-shrink-0 z-10"
            title="Desplazar pestañas hacia la derecha"
            aria-label="Desplazar pestañas hacia la derecha"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {actionElements && (
        <div className="flex items-center gap-1.5 flex-shrink-0 pb-1.5 pl-2 z-10">
          {actionElements}
        </div>
      )}
    </div>
  );
};
