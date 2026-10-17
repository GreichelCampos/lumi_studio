import React, { useState } from 'react';
import { validateProjectName, validateProjectLocation } from '../../utils/validation';
import { X, FolderPlus, Sparkles, Folder, AlertCircle } from 'lucide-react';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (data: { name: string; location: string; description?: string }) => void;
  existingProjectNames: string[];
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
  existingProjectNames,
}) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('~/ProyectosLumi');
  const [description, setDescription] = useState('Proyecto de modelado de interiores con Lumi 3D');
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const nameValidation = validateProjectName(name, existingProjectNames);
    if (!nameValidation.isValid) {
      setErrorMessage(nameValidation.error || 'Nombre de proyecto no válido');
      return;
    }

    const locValidation = validateProjectLocation(location);
    if (!locValidation.isValid) {
      setErrorMessage(locValidation.error || 'Ubicación de proyecto no válida');
      return;
    }

    onCreateProject({
      name: nameValidation.cleanValue!,
      location: locValidation.cleanValue!,
      description: description.trim(),
    });

    setName('');
    setErrorMessage(null);
    onClose();
  };

  return (
    <div 
      id="modal-new-project-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fade-in select-none"
    >
      <div 
        id="modal-new-project"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg glass-modal overflow-hidden text-slate-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white/[0.04] border-b border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#4d6932]/30 text-[#f3ebd6] border border-[#4d6932]/50 shadow-[0_0_15px_rgba(77,105,50,0.3)]">
              <FolderPlus className="w-5 h-5 drop-shadow-[0_0_8px_rgba(243,235,214,0.4)]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#f3ebd6] tracking-tight">Crear Nuevo Proyecto Lumi</h2>
              <p className="text-xs text-[#d5cbb2]">Configura el espacio y archivo principal inicial</p>
            </div>
          </div>
          <button
            id="btn-close-new-project-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-[#d5cbb2] hover:text-[#f3ebd6] border border-transparent hover:border-[#f3ebd6]/15 transition-all"
            title="Cerrar modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs backdrop-blur-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#d5cbb2] mb-1.5 uppercase tracking-wider">
              Nombre del Proyecto <span className="text-[#f3ebd6]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Ej: ApartamentoModerno"
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl bg-[#082016]/90 border border-[#f3ebd6]/20 focus:border-[#f3ebd6] focus:ring-1 focus:ring-[#f3ebd6] text-[#f3ebd6] placeholder-[#8f9d95] outline-none transition-all backdrop-blur-sm shadow-inner"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#d5cbb2] mb-1.5 uppercase tracking-wider">
              Ubicación / Directorio Simulado <span className="text-[#f3ebd6]">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="~/ProyectosLumi"
                className="w-full px-4 py-2.5 rounded-xl bg-[#082016]/90 border border-[#f3ebd6]/20 focus:border-[#f3ebd6] focus:ring-1 focus:ring-[#f3ebd6] text-[#f3ebd6] placeholder-[#8f9d95] outline-none font-mono text-xs transition-all backdrop-blur-sm shadow-inner"
              />
              <Folder className="absolute right-3.5 top-3 w-4 h-4 text-[#8f9d95]" />
            </div>
            <p className="text-[11px] text-[#8f9d95] mt-1">
              Ruta física en PySide6 o almacenamiento local en el navegador.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#d5cbb2] mb-1.5 uppercase tracking-wider">
              Descripción del Espacio (Opcional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Modelado de sala de estar y cocina abierta"
              className="w-full px-4 py-2.5 rounded-xl bg-[#082016]/90 border border-[#f3ebd6]/20 focus:border-[#f3ebd6] focus:ring-1 focus:ring-[#f3ebd6] text-[#f3ebd6] placeholder-[#8f9d95] outline-none transition-all backdrop-blur-sm shadow-inner"
            />
          </div>

          {/* Info pill about auto-created files */}
          <div className="p-3.5 rounded-xl bg-[#1a422f]/30 border border-[#4d6932]/50 text-xs text-[#f3ebd6] flex items-start gap-2.5 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 mt-0.5 text-[#f3ebd6] flex-shrink-0" />
            <div>
              <strong className="text-[#f3ebd6]">Creación automática:</strong> Se generará el archivo <code className="bg-black/40 px-1.5 py-0.5 rounded text-[#f3ebd6] font-mono border border-[#f3ebd6]/30">principal.lumi</code> con la plantilla base y se marcará como punto de entrada.
            </div>
          </div>

          {/* Footer Buttons */}
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
              <FolderPlus className="w-4 h-4" />
              <span>Crear Proyecto</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
