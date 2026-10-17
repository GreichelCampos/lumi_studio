import React, { useState } from 'react';
import { LumiFile } from '../../types';
import { X, Trash2, AlertTriangle, Star, AlertCircle } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: LumiFile | null;
  hasUnsavedChanges: boolean;
  isEntryFile: boolean;
  totalFilesInProject: number;
  onConfirmDelete: (fileId: string) => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  file,
  hasUnsavedChanges,
  isEntryFile,
  totalFilesInProject,
  onConfirmDelete,
}) => {
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

  if (!isOpen || !file) return null;

  return (
    <div 
      id="modal-confirm-delete-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fade-in select-none"
    >
      <div 
        id="modal-confirm-delete"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md glass-modal overflow-hidden text-slate-200"
      >
        <div className="flex items-center justify-between px-6 py-4 glass-panel-header border-b border-[#f3ebd6]/15 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/15 text-rose-300 border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
              <Trash2 className="w-5 h-5 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#f3ebd6] tracking-tight">Eliminar Archivo</h2>
              <p className="text-xs text-rose-300/90 font-mono tracking-wide">{file.name}</p>
            </div>
          </div>
          <button
            id="btn-close-delete-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-[#d5cbb2] hover:text-[#f3ebd6] border border-transparent hover:border-[#f3ebd6]/15 transition-all"
            title="Cerrar modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs sm:text-sm text-[#d5cbb2] leading-relaxed">
            ¿Estás seguro de que deseas eliminar permanentemente el archivo{' '}
            <strong className="text-[#f3ebd6] font-mono bg-[#1a422f]/60 px-2 py-0.5 rounded-md border border-[#f3ebd6]/20">{file.name}</strong>? Esta acción no se puede deshacer.
          </p>

          {hasUnsavedChanges && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs backdrop-blur-sm">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
              <div>
                <strong className="text-amber-100">Cambios sin guardar:</strong> Este archivo tiene modificaciones pendientes en el editor que se perderán al eliminarlo.
              </div>
            </div>
          )}

          {isEntryFile && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#4d6932]/25 border border-[#4d6932]/50 text-[#f3ebd6] text-xs backdrop-blur-sm">
              <Star className="w-4 h-4 text-[#f3ebd6] flex-shrink-0 mt-0.5 fill-[#f3ebd6] drop-shadow-[0_0_6px_rgba(243,235,214,0.5)]" />
              <div>
                <strong className="text-[#f3ebd6]">Archivo Principal del Proyecto:</strong> Este archivo está configurado como el punto de entrada para compilación. Al eliminarlo, se designará automáticamente otro archivo disponible como principal.
              </div>
            </div>
          )}

          {totalFilesInProject <= 1 && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs backdrop-blur-sm">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5 drop-shadow-[0_0_6px_rgba(244,63,94,0.5)]" />
              <div>
                <strong className="text-rose-100">Último archivo:</strong> El proyecto quedará sin archivos. Podrás crear un nuevo archivo .lumi en cualquier momento.
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 px-6 py-4 glass-panel-header border-t border-[#f3ebd6]/15 backdrop-blur-md">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-[#f3ebd6]/15 text-[#d5cbb2] hover:text-[#f3ebd6] font-medium text-xs transition-all active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirmDelete(file.id);
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold text-xs shadow-lg shadow-rose-600/30 border border-rose-400/40 transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            <span>Eliminar Definitivamente</span>
          </button>
        </div>
      </div>
    </div>
  );
};
