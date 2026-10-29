import React from 'react';
import { LUMI_DOCUMENTATION_SECTIONS, LUMI_KEYWORDS } from '../data/documentation';
import { LumiMascot } from './LumiMascot';
import { X, Sparkles, Code2 } from 'lucide-react';

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
            <LumiMascot state="ready" size={34} />
            <div>
              <h2 className="text-base font-bold text-[#f3ebd6] drop-shadow-[0_0_8px_rgba(243,235,214,0.4)]">
                Ayuda de Lumi
              </h2>
              <p className="text-xs text-[#d5cbb2]">Lenguaje Unificado de Modelado de Interiores</p>
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
          <div className="p-4 rounded-2xl glass-card border border-[#f3ebd6]/25 flex items-center justify-between !w-auto !h-auto">
            <div>
              <span className="text-xs font-bold tracking-widest uppercase text-[#f3ebd6] drop-shadow-[0_0_6px_rgba(243,235,214,0.5)]">Estudio LUMI</span>
              <h3 className="text-lg font-extrabold text-[#f3ebd6] mt-0.5">“Imagina espacios. Prográmalos.”</h3>
              <p className="text-xs text-[#d5cbb2] mt-1 max-w-xl leading-relaxed">
                En Electron, Compilar analiza el código y Ejecutar Python puede generar escenas con habitaciones, pisos y muebles colocados mediante el intérprete real. El visor también importa archivos .lumic. Paredes y aberturas declaradas todavía requieren geometría acordada; Python no produce trazas de depuración. Las instrucciones simples terminan en <code className="text-[#f3ebd6] bg-[#02110c]/60 px-1 rounded">&gt;&gt;</code>.
              </p>
            </div>
            <div className="hidden sm:block">
              <LumiMascot state="success" size={60} isAnimated={true} />
            </div>
          </div>

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

          <div className="space-y-4">
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
          </div>

          <div className="glass-card p-4.5 !w-auto !h-auto">
            <h4 className="text-sm font-bold text-[#f3ebd6] mb-3 flex items-center gap-2 drop-shadow-sm">
              <Sparkles className="w-4 h-4 text-[#f3ebd6] drop-shadow-[0_0_6px_rgba(243,235,214,0.5)]" />
              <span>Estados Visuales del Asistente Lumi</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="flex flex-col items-center text-center p-2.5 rounded-xl glass-btn border-[#f3ebd6]/30">
                <LumiMascot state="ready" size={40} isAnimated={false} />
                <span className="font-bold text-[#f3ebd6] mt-1">Crema</span>
                <span className="text-[10px] text-[#d5cbb2]">Listo</span>
              </div>
              <div className="flex flex-col items-center text-center p-2.5 rounded-xl glass-btn border-[#4d6932]/50">
                <LumiMascot state="compiling" size={40} isAnimated={false} />
                <span className="font-bold text-[#f3ebd6] mt-1">Oliva</span>
                <span className="text-[10px] text-[#d5cbb2]">Compilando</span>
              </div>
              <div className="flex flex-col items-center text-center p-2.5 rounded-xl glass-btn border-emerald-400/30">
                <LumiMascot state="success" size={40} isAnimated={false} />
                <span className="font-bold text-emerald-300 mt-1">Verde</span>
                <span className="text-[10px] text-[#d5cbb2]">Compilación Exitosa</span>
              </div>
              <div className="flex flex-col items-center text-center p-2.5 rounded-xl glass-btn border-amber-400/30">
                <LumiMascot state="warning" size={40} isAnimated={false} />
                <span className="font-bold text-amber-300 mt-1">Amarillo</span>
                <span className="text-[10px] text-[#d5cbb2]">Advertencia</span>
              </div>
              <div className="flex flex-col items-center text-center p-2.5 rounded-xl glass-btn border-rose-400/30">
                <LumiMascot state="error" size={40} isAnimated={false} />
                <span className="font-bold text-rose-300 mt-1">Rojo</span>
                <span className="text-[10px] text-[#d5cbb2]">Error recibido</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 glass-panel-header border-t border-[#f3ebd6]/15 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#f3ebd6] hover:bg-[#fff9ec] text-[#082016] font-bold text-xs transition-all shadow-lg shadow-[#02110c]/40"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
