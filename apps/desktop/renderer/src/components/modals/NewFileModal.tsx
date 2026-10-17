import React, { useState } from 'react';
import { validateFileName } from '../../utils/validation';
import { X, FilePlus, AlertCircle, Sparkles } from 'lucide-react';

interface NewFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateFile: (fileName: string) => void | Promise<boolean>;
  existingFileNames: string[];
}

export const NewFileModal: React.FC<NewFileModalProps> = ({
  isOpen,
  onClose,
  onCreateFile,
  existingFileNames,
}) => {
  const [fileName, setFileName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateFileName(fileName, existingFileNames);
    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Nombre de archivo no válido');
      return;
    }

    if (await onCreateFile(validation.cleanValue!) === false) return;
    setFileName('');
    setErrorMessage(null);
    onClose();
  };

  const previewName = fileName.trim()
    ? fileName.trim().toLowerCase().endsWith('.lumi')
      ? fileName.trim()
      : `${fileName.trim()}.lumi`
    : 'nuevo_modulo.lumi';

  return (
    <div 
      id="modal-new-file-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fade-in select-none"
    >
      <div 
        id="modal-new-file"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md glass-modal overflow-hidden text-[var(--ide-text)] border border-[var(--ide-panel-border)]"
      >
        <div className="flex items-center justify-between px-6 py-4 glass-panel-header border-b border-[var(--ide-panel-border)] backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[var(--ide-accent-bg)] text-[var(--ide-accent)] border border-[var(--ide-accent)]/40 shadow-sm">
              <FilePlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--ide-text)] tracking-tight">Nuevo Archivo Lumi</h2>
              <p className="text-xs text-[var(--ide-text-muted)]">Extensión .lumi requerida</p>
            </div>
          </div>
          <button
            id="btn-close-new-file-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-[var(--ide-btn-bg)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] border border-transparent hover:border-[var(--ide-panel-border)] transition-all"
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
            <label className="block text-xs font-semibold text-[var(--ide-text-muted)] mb-1.5 uppercase tracking-wider">
              Nombre del Archivo <span className="text-[var(--ide-accent)]">*</span>
            </label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => {
                setFileName(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Ej: mobiliario_comedor"
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--ide-control-bg)] border border-[var(--ide-panel-border)] focus:border-[var(--ide-accent)] focus:ring-1 focus:ring-[var(--ide-accent)] text-[var(--ide-text)] placeholder-[var(--ide-text-muted)] outline-none font-mono text-xs transition-all shadow-inner"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--ide-control-bg)] border border-[var(--ide-panel-border)] text-xs flex items-center justify-between backdrop-blur-sm">
            <span className="text-[var(--ide-text-muted)]">Archivo resultante:</span>
            <span className="font-mono text-[var(--ide-accent)] font-bold bg-[var(--ide-btn-bg)] px-2.5 py-1 rounded-lg border border-[var(--ide-panel-border)] shadow-sm">
              {previewName}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--ide-panel-border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[var(--ide-btn-bg)] hover:brightness-110 border border-[var(--ide-panel-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] font-medium text-xs transition-all active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[var(--ide-accent)] hover:brightness-110 text-[var(--ide-accent-text,#000000)] font-bold text-xs shadow-lg border border-[var(--ide-accent)] transition-all flex items-center gap-1.5 active:scale-95"
            >
              <FilePlus className="w-4 h-4" />
              <span>Crear y Abrir</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
