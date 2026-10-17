import React, { useState } from 'react';
import { validateRoomParams } from '../../utils/validation';
import { X, Box, AlertCircle, Sparkles, Check } from 'lucide-react';

interface InsertRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertRoom: (generatedCode: string) => void;
}

export const InsertRoomModal: React.FC<InsertRoomModalProps> = ({
  isOpen,
  onClose,
  onInsertRoom,
}) => {
  const [name, setName] = useState('sala');
  const [ancho, setAncho] = useState('5.0');
  const [largo, setLargo] = useState('4.0');
  const [altura, setAltura] = useState('2.7');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

    const validation = validateRoomParams(name, ancho, largo, altura);
    if (!validation.isValid) {
      setFieldErrors(validation.errors as Record<string, string>);
      return;
    }

    if (validation.generatedCode) {
      onInsertRoom(validation.generatedCode);
      onClose();
    }
  };

  // Preview generated code in real time
  const previewValidation = validateRoomParams(name || 'mi_habitacion', ancho || '5.0', largo || '4.0', altura || '2.7');
  const previewCode = previewValidation.generatedCode || `habitacion ${name || 'sala'}(${ancho || '5.0'}, ${largo || '4.0'}, ${altura || '2.7'}) {\n}`;

  return (
    <div 
      id="modal-insert-room-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fade-in select-none"
    >
      <div 
        id="modal-insert-room"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md glass-modal overflow-hidden text-slate-200"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 glass-panel-header border-b border-[#f3ebd6]/15 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#4d6932]/30 text-[#f3ebd6] border border-[#4d6932]/50 shadow-[0_0_15px_rgba(77,105,50,0.3)]">
              <Box className="w-5 h-5 drop-shadow-[0_0_8px_rgba(243,235,214,0.4)]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#f3ebd6] tracking-tight">Insertar Habitación Lumi</h2>
              <p className="text-xs text-[#d5cbb2]">Genera la estructura de bloque habitacion(...) en el código</p>
            </div>
          </div>
          <button
            id="btn-close-insert-room"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-[#d5cbb2] hover:text-[#f3ebd6] border border-transparent hover:border-[#f3ebd6]/15 transition-all"
            title="Cerrar modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nombre de la habitación */}
          <div>
            <label className="block text-xs font-semibold text-[#d5cbb2] mb-1.5 uppercase tracking-wider">
              Nombre de la Habitación <span className="text-[#f3ebd6]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) {
                  setFieldErrors((prev) => {
                    const copy = { ...prev };
                    delete copy.name;
                    return copy;
                  });
                }
              }}
              placeholder="Ej: sala, cocina, dormitorio_principal"
              autoFocus
              className={`w-full px-3.5 py-2.5 rounded-xl bg-[#082016]/90 border ${
                fieldErrors.name ? 'border-rose-500 ring-1 ring-rose-500' : 'border-[#f3ebd6]/20 focus:border-[#f3ebd6]'
              } text-sm text-[#f3ebd6] placeholder-[#8f9d95] outline-none font-mono text-xs transition-all shadow-inner`}
            />
            {fieldErrors.name && (
              <p className="mt-1 text-xs text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{fieldErrors.name}</span>
              </p>
            )}
          </div>

          {/* Dimensiones: Ancho (X), Largo (Z), Altura (Y) */}
          <div className="grid grid-cols-3 gap-3">
            {/* Ancho */}
            <div>
              <label className="block text-[11px] font-semibold text-[#d5cbb2] mb-1 uppercase tracking-wider">
                Ancho (X, m) <span className="text-[#f3ebd6]">*</span>
              </label>
              <input
                type="text"
                value={ancho}
                onChange={(e) => {
                  setAncho(e.target.value);
                  if (fieldErrors.ancho) {
                    setFieldErrors((prev) => {
                      const copy = { ...prev };
                      delete copy.ancho;
                      return copy;
                    });
                  }
                }}
                placeholder="5.0"
                className={`w-full px-3 py-2 rounded-xl bg-[#082016]/90 border ${
                  fieldErrors.ancho ? 'border-rose-500' : 'border-[#f3ebd6]/20 focus:border-[#f3ebd6]'
                } text-xs font-mono text-[#f3ebd6] placeholder-[#8f9d95] outline-none transition-all shadow-inner`}
              />
              {fieldErrors.ancho && (
                <p className="mt-1 text-[10px] text-rose-400 leading-tight">{fieldErrors.ancho}</p>
              )}
            </div>

            {/* Largo */}
            <div>
              <label className="block text-[11px] font-semibold text-[#d5cbb2] mb-1 uppercase tracking-wider">
                Largo (Z, m) <span className="text-[#f3ebd6]">*</span>
              </label>
              <input
                type="text"
                value={largo}
                onChange={(e) => {
                  setLargo(e.target.value);
                  if (fieldErrors.largo) {
                    setFieldErrors((prev) => {
                      const copy = { ...prev };
                      delete copy.largo;
                      return copy;
                    });
                  }
                }}
                placeholder="4.0"
                className={`w-full px-3 py-2 rounded-xl bg-[#082016]/90 border ${
                  fieldErrors.largo ? 'border-rose-500' : 'border-[#f3ebd6]/20 focus:border-[#f3ebd6]'
                } text-xs font-mono text-[#f3ebd6] placeholder-[#8f9d95] outline-none transition-all shadow-inner`}
              />
              {fieldErrors.largo && (
                <p className="mt-1 text-[10px] text-rose-400 leading-tight">{fieldErrors.largo}</p>
              )}
            </div>

            {/* Altura */}
            <div>
              <label className="block text-[11px] font-semibold text-[#d5cbb2] mb-1 uppercase tracking-wider">
                Altura (Y, m) <span className="text-[#f3ebd6]">*</span>
              </label>
              <input
                type="text"
                value={altura}
                onChange={(e) => {
                  setAltura(e.target.value);
                  if (fieldErrors.altura) {
                    setFieldErrors((prev) => {
                      const copy = { ...prev };
                      delete copy.altura;
                      return copy;
                    });
                  }
                }}
                placeholder="2.7"
                className={`w-full px-3 py-2 rounded-xl bg-[#082016]/90 border ${
                  fieldErrors.altura ? 'border-rose-500' : 'border-[#f3ebd6]/20 focus:border-[#f3ebd6]'
                } text-xs font-mono text-[#f3ebd6] placeholder-[#8f9d95] outline-none transition-all shadow-inner`}
              />
              {fieldErrors.altura && (
                <p className="mt-1 text-[10px] text-rose-400 leading-tight">{fieldErrors.altura}</p>
              )}
            </div>
          </div>

          {/* Live Preview del código Lumi */}
          <div className="p-3.5 rounded-xl bg-[#1a422f]/20 border border-[#f3ebd6]/15 space-y-1.5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-[11px] text-[#d5cbb2]">
              <span className="flex items-center gap-1 font-semibold text-[#f3ebd6]">
                <Sparkles className="w-3 h-3 text-[#f3ebd6]" />
                <span>Código Lumi generado:</span>
              </span>
              <span className="text-[10px] font-mono text-[#8f9d95]">posición actual del cursor</span>
            </div>
            <pre className="font-mono text-xs text-[#f3ebd6] bg-[#02110c]/60 p-2.5 rounded-lg border border-[#f3ebd6]/20 overflow-x-auto whitespace-pre">
              {previewCode}
            </pre>
          </div>

          {/* Footer Action Buttons */}
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
              <Check className="w-4 h-4" />
              <span>Insertar en Editor</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
