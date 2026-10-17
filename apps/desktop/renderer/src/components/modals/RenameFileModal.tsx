import React, { useState, useEffect } from 'react';
import { validateFileName } from '../../utils/validation';
import { X, Edit3, AlertCircle } from 'lucide-react';
import { LumiFile } from '../../types';

interface RenameFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: LumiFile | null;
  onRename: (fileId: string, newName: string) => void;
  existingFileNames: string[];
}

export const RenameFileModal: React.FC<RenameFileModalProps> = ({
  isOpen,
  onClose,
  file,
  onRename,
  existingFileNames,
}) => {
  const [name, setName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (file) {
      setName(file.name);
      setErrorMessage(null);
    }
  }, [file]);

  useEffect(() => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateFileName(name, existingFileNames, file.name);
    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Nombre no válido');
      return;
    }

    onRename(file.id, validation.cleanValue!);
    setErrorMessage(null);
    onClose();
  };

  return (
    <div 
      id="modal-rename-file-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fade-in select-none"
    >
      <div 
        id="modal-rename-file"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md glass-modal overflow-hidden text-slate-200"
      >
        <div className="flex items-center justify-between px-6 py-4 glass-panel-header border-b border-[#f3ebd6]/15 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#4d6932]/30 text-[#f3ebd6] border border-[#4d6932]/50 shadow-[0_0_15px_rgba(77,105,50,0.3)]">
              <Edit3 className="w-5 h-5 drop-shadow-[0_0_8px_rgba(243,235,214,0.4)]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#f3ebd6] tracking-tight">Renombrar Archivo</h2>
              <p className="text-xs text-[#d5cbb2]">Modifica el nombre del archivo .lumi</p>
            </div>
          </div>
          <button
            id="btn-close-rename-file-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-[#d5cbb2] hover:text-[#f3ebd6] border border-transparent hover:border-[#f3ebd6]/15 transition-all"
            title="Cerrar modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs backdrop-blur-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#d5cbb2] mb-1.5 uppercase tracking-wider">
              Nuevo Nombre <span className="text-[#f3ebd6]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl bg-[#082016]/90 border border-[#f3ebd6]/20 focus:border-[#f3ebd6] focus:ring-1 focus:ring-[#f3ebd6] text-[#f3ebd6] outline-none font-mono text-xs transition-all backdrop-blur-sm shadow-inner"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-[#1a422f]/20 border border-[#f3ebd6]/15 text-xs flex items-center justify-between backdrop-blur-sm">
            <span className="text-[#d5cbb2]">Nombre actual:</span>
            <span className="font-mono text-[#f3ebd6] font-semibold bg-[#1a422f]/60 px-2 py-0.5 rounded border border-[#f3ebd6]/20">{file.name}</span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#f3ebd6]/15">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-[#f3ebd6]/15 text-[#d5cbb2] hover:text-[#f3ebd6] font-medium text-xs transition-all active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#f3ebd6] hover:bg-[#fff9ec] text-[#082016] font-bold text-xs shadow-lg shadow-[#02110c]/40 border border-[#f3ebd6] transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Edit3 className="w-4 h-4" />
              <span>Guardar Nombre</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
