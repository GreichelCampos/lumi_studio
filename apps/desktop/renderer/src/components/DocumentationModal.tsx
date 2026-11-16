import React from 'react';
import { LUMI_DOCUMENTATION_SECTIONS, LUMI_KEYWORDS, LUMI_COMMON_ERRORS } from '../data/documentation';
import { X, Code2, Check } from 'lucide-react';

interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const exampleKindLabels = {
  executable: 'Ejemplo ejecutable con Python',
  'syntax-only': 'Ejemplo sintáctico · ejecución no soportada',
  informational: 'Información · no es un programa ejecutable',
};

export const DocumentationModal: React.FC<DocumentationModalProps> = ({
  isOpen,
  onClose,
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

  if (!isOpen) return null;

  return (
    <div 
      id="modal-documentation-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fade-in select-text"
    >
      <div 
        id="modal-documentation"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl max-h-[85vh] flex flex-col glass-modal text-slate-200"
      >
        <div className="flex items-center justify-between px-6 py-4 glass-panel-header border-b border-[#f3ebd6]/15">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-base font-bold text-[#f3ebd6] drop-shadow-[0_0_8px_rgba(243,235,214,0.4)]">
                Ayuda de Lumi
              </h2>
              <p className="text-xs text-[#d5cbb2]">Sintaxis, ejemplos y errores frecuentes</p>
            </div>
          </div>
          <button
            id="btn-close-documentation-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl glass-btn text-[#d5cbb2] hover:text-[#f3ebd6] transition-colors"
            title="Cerrar modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-bold">Errores frecuentes</h3>
            <p className="text-xs">En Diagnósticos, usá Ir al código para abrir la línea y columna señaladas. Si borraste un símbolo, revisá también lo que va justo antes.</p>
            {LUMI_COMMON_ERRORS.map(({ title, advice, code }) => (
              <details key={title} className="glass-card p-3 !w-auto !h-auto text-sm">
                <summary className="cursor-pointer font-semibold">{title}</summary>
                <p className="mt-2 text-xs">{advice}</p>
                <pre className="mt-2 overflow-x-auto text-xs"><code>{code}</code></pre>
              </details>
            ))}
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-bold">Ejemplos de Lumi</h3>
            {LUMI_DOCUMENTATION_SECTIONS.map((sec, idx) => (
              <div key={idx} className="glass-card p-4 space-y-2 !w-auto !h-auto">
                <h4 className="text-sm font-bold text-[#f3ebd6] drop-shadow-sm">{sec.title}</h4>
                <p className="text-xs font-semibold text-[#f3ebd6]">{exampleKindLabels[sec.exampleKind]}</p>
                <p className="text-xs text-[#d5cbb2] leading-relaxed">{sec.description}</p>
                <pre className="bg-[#02110c]/60 p-3 rounded-xl text-xs font-mono text-[#f3ebd6] overflow-x-auto border border-[#f3ebd6]/15 shadow-inner">
                  {sec.code}
                </pre>
              </div>
            ))}
          </section>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#f3ebd6] drop-shadow-[0_0_6px_rgba(243,235,214,0.5)] mb-3 flex items-center gap-2">
              <Code2 className="w-4 h-4" />
              <span>Palabras Reservadas y Estructuras Principales</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
              {LUMI_KEYWORDS.map((item) => (
                <div key={item.word} className="glass-card p-3 !w-auto !h-auto">
                  <div className="flex items-center justify-between">
                    <span className="text-[#f3ebd6] font-bold drop-shadow-[0_0_6px_rgba(243,235,214,0.5)]">{item.word}</span>
                    <span className="text-[9px] text-[#f3ebd6] font-sans uppercase font-bold glass-btn px-1.5 py-0.5 rounded-full bg-[#4d6932]/30">{item.category}</span>
                  </div>
                  <p className="text-[10px] text-[#d5cbb2] font-sans mt-1.5 leading-snug">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 glass-panel-header border-t border-[#f3ebd6]/15 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#f3ebd6] hover:bg-[#fff9ec] text-[#082016] font-bold text-xs transition-all shadow-lg shadow-[#02110c]/40 flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Entendido</span>
          </button>
        </div>
      </div>
    </div>
  );
};
