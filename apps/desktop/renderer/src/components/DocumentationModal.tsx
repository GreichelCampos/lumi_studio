import React from 'react';
import { LUMI_DOCUMENTATION_SECTIONS, LUMI_KEYWORDS, LUMI_COMMON_ERRORS } from '../data/documentation';
import { LumiMascot } from './LumiMascot';
import { X, Code2, Check, Sparkles } from 'lucide-react';

interface DocumentationModalProps {
  isOpen: boolean;
  view?: 'syntax' | 'about';
  onClose: () => void;
}

const helpTopics = [
  { id: 'errors', label: 'Errores frecuentes' },
  { id: 'examples', label: 'Ejemplos' },
  { id: 'keywords', label: 'Palabras reservadas' },
  { id: 'ide', label: 'Guía del IDE' },
] as const;

const exampleKindLabels = {
  executable: 'Ejemplo ejecutable con Python',
  'syntax-only': 'Ejemplo sintáctico · ejecución no soportada',
  informational: 'Información · no es un programa ejecutable',
};

export const DocumentationModal: React.FC<DocumentationModalProps> = ({
  isOpen,
  view = 'syntax',
  onClose,
}) => {
  const [topic, setTopic] = React.useState<(typeof helpTopics)[number]['id']>('errors');

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

  const isAbout = view === 'about';

  return (
    <div 
      id="modal-documentation-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fade-in select-text"
    >
      <div 
        id={isAbout ? 'modal-about-lumi' : 'modal-documentation'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lumi-help-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl max-h-[85vh] flex flex-col glass-modal text-slate-200"
      >
        <div className="flex items-center justify-between px-6 py-4 glass-panel-header border-b border-[#f3ebd6]/15">
          <div className="flex items-center gap-3">
            {!isAbout && <LumiMascot state="ready" size={34} />}
            <div>
              <h2 id="lumi-help-title" className="text-base font-bold text-[#f3ebd6] drop-shadow-[0_0_8px_rgba(243,235,214,0.4)]">
                {isAbout ? 'Acerca de Estudio Lumi' : 'Ayuda de Lumi'}
              </h2>
              {!isAbout && <p className="text-xs text-[#d5cbb2]">Lenguaje Unificado de Modelado de Interiores</p>}
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

        {isAbout ? (
          <section className="p-6 space-y-2 text-sm">
            <p>Lumi es el Lenguaje Unificado de Modelado de Interiores.</p>
            <p>Estudio Lumi es el entorno para editar y ejecutar programas Lumi y visualizar sus escenas en 3D.</p>
          </section>
        ) : (
          <>
            <nav aria-label="Temas de ayuda" className="flex flex-wrap gap-2 px-6 pt-4">
              {helpTopics.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={topic === id}
                  onClick={() => setTopic(id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold focus-visible:outline focus-visible:outline-offset-2 ${
                    topic === id ? 'bg-[#f3ebd6] text-[#082016]' : 'glass-btn border-[#f3ebd6]/25 text-[#f3ebd6]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
            <div key={topic} className="flex-1 overflow-y-auto p-6 space-y-6">
              {topic === 'errors' && (
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
              )}
              {topic === 'examples' && (
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
              )}
              {topic === 'keywords' && (
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
              )}
              {topic === 'ide' && (
                <section className="space-y-4">
                <div className="p-4 rounded-2xl glass-card border border-[#f3ebd6]/25 flex items-center justify-between !w-auto !h-auto">
                  <div>
                    <span className="text-xs font-bold tracking-widest uppercase text-[#f3ebd6] drop-shadow-[0_0_6px_rgba(243,235,214,0.5)]">Estudio LUMI</span>
                    <h3 className="text-lg font-extrabold text-[#f3ebd6] mt-0.5">“Imagina espacios. Prográmalos.”</h3>
                    <p className="text-xs text-[#d5cbb2] mt-1 max-w-xl leading-relaxed">
                      En Electron, Compilar analiza el archivo principal del proyecto. Ejecutar Lumi corre ese archivo y abre el visor cuando el programa genera una escena. El visor muestra habitaciones, pisos, paredes, puertas, ventanas y muebles colocados. Si el programa usa leer, aparece un formulario. Las instrucciones simples terminan en <code className="text-[#f3ebd6] bg-[#02110c]/60 px-1 rounded">&gt;&gt;</code>.
                    </p>
                  </div>
                  <div className="hidden sm:block">
                    <LumiMascot state="success" size={60} isAnimated={true} />
                  </div>
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
                </section>
              )}
            </div>
          </>
        )}

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
