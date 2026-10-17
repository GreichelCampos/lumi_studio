import React from 'react';
import { LumiFile } from '../../types';
import { X, AlertCircle, Save, RotateCcw, Ban } from 'lucide-react';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: LumiFile | null;
  onSaveAndClose: (fileId: string) => void;
  onDiscardAndClose: (fileId: string) => void;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  onClose,
  file,
  onSaveAndClose,
  onDiscardAndClose,
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
      id="modal-unsaved-changes-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fade-in select-none"
    >
      <div 
        id="modal-unsaved-changes"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md glass-modal overflow-hidden text-slate-200"
      >
        <div className="flex items-center justify-between px-6 py-4 glass-panel-header border-b border-[#f3ebd6]/15 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <AlertCircle className="w-5 h-5 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#f3ebd6] tracking-tight">Cambios sin Guardar</h2>
              <p className="text-xs text-amber-300/90 font-mono tracking-wide">{file.name}</p>
            </div>
          </div>
          <button
            id="btn-close-unsaved-changes-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-[#d5cbb2] hover:text-[#f3ebd6] border border-transparent hover:border-[#f3ebd6]/15 transition-all"
            title="Cerrar modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          <p className="text-xs sm:text-sm text-[#d5cbb2] leading-relaxed">
            El archivo <strong className="text-[#f3ebd6] font-mono bg-[#1a422f]/60 px-2 py-0.5 rounded-md border border-[#f3ebd6]/20">{file.name}</strong> tiene modificaciones que no han sido guardadas en el disco.
          </p>
          <p className="text-xs sm:text-sm text-[#8f9d95]">
            ¿Deseas guardar los cambios antes de cerrar la pestaña?
          </p>
        </div>

        <div className="flex items-center justify-between px-6 py-4 glass-panel-header border-t border-[#f3ebd6]/15 backdrop-blur-md gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-[#f3ebd6]/15 text-[#d5cbb2] hover:text-[#f3ebd6] font-medium text-xs transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Ban className="w-3.5 h-3.5 text-[#8f9d95]" />
            <span>Cancelar</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                onDiscardAndClose(file.id);
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Descartar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onSaveAndClose(file.id);
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-[#f3ebd6] hover:bg-[#fff9ec] text-[#082016] font-bold text-xs shadow-lg shadow-[#02110c]/40 border border-[#f3ebd6] transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Save className="w-3.5 h-3.5 fill-[#082016]" />
              <span>Guardar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
