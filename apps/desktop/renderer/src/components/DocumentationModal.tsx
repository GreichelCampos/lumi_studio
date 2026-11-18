import React from 'react';
import { LUMI_DOCUMENTATION_SECTIONS, LUMI_KEYWORDS, LUMI_COMMON_ERRORS, LUMI_PROJECT_EXAMPLES, LUMI_DEBUG_GUIDE, LUMI_FIRST_STEPS, LUMI_IDE_PROCEDURES, type HelpProcedure } from '../data/documentation';
import { LUMI_REPOSITORY, LUMI_TEAM } from '../../../projectCredits';
import { LumiMascot } from './LumiMascot';
import { X, Code2, Check, Sparkles, ExternalLink, Github, MousePointer2 } from 'lucide-react';

interface DocumentationModalProps {
  isOpen: boolean;
  view?: 'syntax' | 'about';
  onClose: () => void;
}

const helpTopics = [
  { id: 'start', label: 'Primeros pasos' },
  { id: 'errors', label: 'Errores frecuentes' },
  { id: 'examples', label: 'Ejemplos' },
  { id: 'keywords', label: 'Palabras reservadas' },
  { id: 'projects', label: 'Proyectos e importaciones' },
  { id: 'debugger', label: 'Depurador espacial' },
  { id: 'ide', label: 'Guía del IDE' },
] as const;

const exampleKindLabels = {
  executable: 'Ejemplo para ejecutar',
  'syntax-only': 'Ejemplo sintáctico · ejecución no soportada',
  informational: 'Información · no es un programa ejecutable',
};

function CodeExample({ code }: { code: string }) {
  const [status, setStatus] = React.useState('');

  async function copy() {
    try {
      if (window.lumiDesktop?.copyText) await window.lumiDesktop.copyText(code);
      else await navigator.clipboard.writeText(code);
      setStatus('Código copiado');
    } catch {
      setStatus('Seleccioná el código para copiarlo.');
    }
  }

  return (
    <div className="space-y-2">
      <pre className="overflow-x-auto rounded-xl bg-[var(--ide-control-bg)] p-3 text-xs text-[var(--ide-text)]"><code>{code}</code></pre>
      <button type="button" onClick={() => void copy()} className="glass-btn rounded-lg px-3 py-1 text-xs">Copiar código</button>
      <span role="status" className="ml-2 text-xs">{status}</span>
    </div>
  );
}

function Procedure({ procedure }: { procedure: HelpProcedure }) {
  return (
    <div className="space-y-2 text-xs leading-relaxed">
      <p><strong>Qué hacer</strong> {procedure.action}</p>
      {procedure.code && <CodeExample code={procedure.code} />}
      <p><strong>Resultado esperado</strong> {procedure.expected}</p>
      <p><strong>Si falla</strong> {procedure.troubleshooting}</p>
    </div>
  );
}

const searchEntries: { title: string; description: string; code: string; procedure?: HelpProcedure }[] = [
  ...[...LUMI_FIRST_STEPS, ...LUMI_IDE_PROCEDURES].map(procedure => ({
    title: procedure.title,
    description: [procedure.action, procedure.expected, procedure.troubleshooting].join(' '),
    code: procedure.code ?? '',
    procedure,
  })),
  ...LUMI_DOCUMENTATION_SECTIONS.map(({ title, description, code }) => ({ title, description, code })),
  ...LUMI_COMMON_ERRORS.map(({ title, advice, code }) => ({ title, description: advice, code })),
  ...LUMI_PROJECT_EXAMPLES,
  ...LUMI_DEBUG_GUIDE.map(({ title, advice, code, expected, troubleshooting }) => ({ title, description: [advice, expected, troubleshooting].join(' '), code, procedure: { title, action: advice, expected, troubleshooting, code } })),
  ...LUMI_KEYWORDS.map(({ word, category, desc }) => ({ title: word, description: category + ' · ' + desc, code: '' })),
];

function normalize(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

export const DocumentationModal: React.FC<DocumentationModalProps> = ({
  isOpen,
  view = 'syntax',
  onClose,
}) => {
  const [topic, setTopic] = React.useState<(typeof helpTopics)[number]['id']>('start');
  const [query, setQuery] = React.useState('');
  const [debugIndex, setDebugIndex] = React.useState(0);
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const searchResults = terms.length ? searchEntries.filter(entry => {
    const text = normalize([entry.title, entry.description, entry.code].join(' '));
    return terms.every(term => text.includes(term));
  }) : [];
  const debugStep = LUMI_DEBUG_GUIDE[debugIndex];

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
        className={`relative w-full max-h-[85vh] flex flex-col glass-modal text-[var(--ide-text)] ${isAbout ? 'max-w-3xl' : 'max-w-4xl'}`}
      >
        <div className="flex items-center justify-between px-6 py-4 glass-panel-header border-b border-[var(--ide-panel-border)]">
          <div className="flex items-center gap-3">
            {!isAbout && <LumiMascot state="ready" size={34} />}
            <div>
              <h2 id="lumi-help-title" className="text-base font-bold text-[var(--ide-text)]">
                {isAbout ? 'Acerca de Lumi Studio' : 'Ayuda de Lumi'}
              </h2>
              {!isAbout && <p className="text-xs text-[var(--ide-text-muted)]">Lenguaje Unificado de Modelado de Interiores</p>}
            </div>
          </div>
          <button
            id="btn-close-documentation-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl glass-btn text-[var(--ide-text-muted)] hover:text-[var(--ide-accent)] transition-colors"
            title="Cerrar modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isAbout ? (
          <section className="overflow-y-auto px-5 py-5 sm:px-7 sm:py-6 space-y-6 text-sm">
            <div className="rounded-2xl border border-[var(--ide-panel-border)] bg-[var(--ide-accent-bg)] px-5 py-6 flex items-center gap-5">
              <div className="min-w-0 flex-1">
                <p className="text-4xl font-bold tracking-tight text-[var(--ide-text)]">LUMI</p>
                <p className="mt-2 font-semibold text-[var(--ide-text)]">Lenguaje Unificado de Modelado de Interiores</p>
                <p className="mt-3 text-[var(--ide-text-muted)] leading-relaxed">Aprendé programación en español al diseñar habitaciones. Cambiá una medida o mové un mueble en el código y observá el resultado en 3D.</p>
              </div>
              <div className="hidden sm:block shrink-0" aria-hidden="true"><LumiMascot state="ready" size={84} isAnimated={false} /></div>
            </div>

            <div>
              <h3 className="flex items-center gap-2 font-semibold text-[var(--ide-text)]"><MousePointer2 aria-hidden="true" className="h-4 w-4" /> Qué podés hacer</h3>
              <p className="mt-2 leading-relaxed text-[var(--ide-text-muted)]">Creá espacios con paredes, puertas, ventanas y muebles. Revisá las colisiones y las puertas bloqueadas en Diagnósticos. Usá el depurador espacial para ver cómo cambia la escena paso a paso.</p>
            </div>

            <div>
              <h3 className="font-semibold text-[var(--ide-text)]">Equipo</h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--ide-text-muted)]">Proyecto de Paradigmas de Programación · Universidad Nacional, Campus Pérez Zeledón</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                {LUMI_TEAM.map(({ name, github }) => (
                  <li key={github} className="rounded-xl border border-[var(--ide-panel-border)] bg-[var(--ide-control-bg)] p-3">
                    <p className="font-semibold text-[var(--ide-text)]">{name}</p>
                    <a className="mt-1 inline-flex items-center gap-1.5 break-all text-xs text-[var(--ide-text-muted)] underline underline-offset-2 hover:text-[var(--ide-accent)]" href={`https://github.com/${github}`} target="_blank" rel="noreferrer">
                      @{github}<ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
              <a className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[var(--ide-panel-border)] px-3 py-2 text-xs font-semibold text-[var(--ide-text)] hover:bg-[var(--ide-accent-bg)]" href={LUMI_REPOSITORY} target="_blank" rel="noreferrer">
                <Github aria-hidden="true" className="h-4 w-4" /> Repositorio de Lumi Studio en GitHub <ExternalLink aria-hidden="true" className="h-3 w-3" />
              </a>
            </div>
          </section>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 px-6 pt-4">
              <label htmlFor="lumi-help-search" className="text-xs font-semibold">Buscar en la ayuda</label>
              <input
                id="lumi-help-search"
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Ej. vectores, importar, ciclo"
                className="min-w-0 flex-1 rounded-lg border border-[var(--ide-panel-border)] bg-[var(--ide-control-bg)] px-3 py-2 text-sm"
              />
            </div>
            <nav aria-label="Temas de ayuda" className="flex flex-wrap gap-2 px-6 pt-4">
              {helpTopics.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={topic === id}
                  onClick={() => { setTopic(id); setQuery(''); }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold focus-visible:outline focus-visible:outline-offset-2 ${
                    topic === id ? 'bg-[var(--ide-accent)] text-[var(--ide-accent-text)]' : 'glass-btn border-[var(--ide-panel-border)] text-[var(--ide-text)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
            {terms.length > 0 ? (
              <section className="flex-1 overflow-y-auto p-6 space-y-3" aria-label="Resultados de búsqueda">
                <p role="status" className="text-xs">{searchResults.length ? `Resultados: ${searchResults.length}` : 'Sin resultados. Probá con otra palabra.'}</p>
                {searchResults.map(entry => (
                  <details key={entry.title} className="glass-card p-3 !w-auto !h-auto text-sm">
                    <summary className="cursor-pointer font-semibold">{entry.title}</summary>
                    {entry.procedure ? <Procedure procedure={entry.procedure} /> : (
                      <>
                        <p className="my-2 text-xs">{entry.description}</p>
                        {entry.code && <CodeExample code={entry.code} />}
                      </>
                    )}
                  </details>
                ))}
              </section>
            ) : (
            <div key={topic} className="flex-1 overflow-y-auto p-6 space-y-6">
              {topic === 'start' && (
                <section className="space-y-4">
                  <h3 className="text-sm font-bold">Primeros pasos</h3>
                  <p className="text-xs">Creá una sala desde cero y comprobá el resultado. Toda esta ayuda está disponible sin conexión.</p>
                  <ol className="list-decimal pl-5 space-y-4">
                    {LUMI_FIRST_STEPS.map(procedure => (
                      <li key={procedure.title} className="glass-card p-4 !w-auto !h-auto">
                        <h4 className="mb-2 text-sm font-semibold">{procedure.title}</h4>
                        <Procedure procedure={procedure} />
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              {topic === 'errors' && (
                <section className="space-y-3">
                  <h3 className="text-sm font-bold">Errores frecuentes</h3>
                  <p className="text-xs">En Diagnósticos, usá Ir al código para abrir la línea y columna señaladas. Si borraste un símbolo, revisá también lo que va justo antes.</p>
                  {LUMI_COMMON_ERRORS.map(({ title, advice, code }) => (
                    <details key={title} className="glass-card p-3 !w-auto !h-auto text-sm">
                      <summary className="cursor-pointer font-semibold">{title}</summary>
                      <p className="mt-2 text-xs">{advice}</p>
                      <CodeExample code={code} />
                    </details>
                  ))}
                </section>
              )}
              {topic === 'examples' && (
                <section className="space-y-4">
                  <h3 className="text-sm font-bold">Ejemplos de Lumi</h3>
                  {LUMI_DOCUMENTATION_SECTIONS.map((sec, idx) => (
                    <div key={idx} className="glass-card p-4 space-y-2 !w-auto !h-auto">
                      <h4 className="text-sm font-bold text-[var(--ide-text)] drop-shadow-sm">{sec.title}</h4>
                      <p className="text-xs font-semibold text-[var(--ide-text)]">{exampleKindLabels[sec.exampleKind]}</p>
                      <p className="text-xs text-[var(--ide-text-muted)] leading-relaxed">{sec.description}</p>
                      <CodeExample code={sec.code} />
                    </div>
                  ))}
                </section>
              )}
              {topic === 'keywords' && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ide-text)] mb-3 flex items-center gap-2">
                    <Code2 className="w-4 h-4" />
                    <span>Palabras reservadas y estructuras principales</span>
                  </h4>
                  <div className="space-y-4">
                    {Array.from(new Set(LUMI_KEYWORDS.map(item => item.category))).map(category => (
                      <section key={category}>
                        <h5 className="mb-2 text-xs font-semibold text-[var(--ide-text-muted)]">{category}</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {LUMI_KEYWORDS.filter(item => item.category === category).map(item => (
                            <details key={item.word} className="glass-card p-3 !w-auto !h-auto text-xs">
                              <summary className="cursor-pointer font-mono font-bold text-[var(--ide-text)]">{item.word}</summary>
                              <p className="my-2 leading-relaxed text-[var(--ide-text-muted)]">{item.desc}</p>
                              <CodeExample code={item.code} />
                            </details>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              )}
              {topic === 'projects' && (
                <section className="space-y-4">
                  <h3 className="text-sm font-bold">Proyectos e importaciones</h3>
                  <p className="text-xs">Creá un proyecto y guardá los dos archivos en la misma carpeta. Compilar y Ejecutar Lumi usan el archivo marcado como principal, aunque tengás otro abierto.</p>
                  {LUMI_PROJECT_EXAMPLES.map(({ title, description, code }) => (
                    <article key={title} className="space-y-2">
                      <h4 className="font-mono text-sm font-semibold">{title}</h4>
                      <p className="text-xs">{description}</p>
                      <CodeExample code={code} />
                    </article>
                  ))}
                  <p className="text-xs">Si falla la importación, revisá el nombre y la ruta del archivo, el nombre de la función y los argumentos. Si dos módulos se importan entre sí, reorganizá las funciones para romper el ciclo.</p>
                </section>
              )}
              {topic === 'debugger' && (
                <section className="space-y-4">
                  <h3 className="text-sm font-bold">Depurador espacial</h3>
                  <p className="text-xs">Seguí este recorrido en tu proyecto para ver cómo una silla cambia de posición y qué ocurre si sale de la sala.</p>
                  <article aria-live="polite" className="glass-card p-4 space-y-2 !w-auto !h-auto">
                    <p className="text-xs">Paso {debugIndex + 1} de {LUMI_DEBUG_GUIDE.length}</p>
                    <h4 className="text-sm font-semibold">{debugStep.title}</h4>
                    <Procedure key={debugStep.title} procedure={{ ...debugStep, action: debugStep.advice }} />
                  </article>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="glass-btn rounded-lg px-3 py-2 text-xs disabled:opacity-50" disabled={debugIndex === 0} onClick={() => setDebugIndex(debugIndex - 1)}>Anterior</button>
                    <button type="button" className="glass-btn rounded-lg px-3 py-2 text-xs disabled:opacity-50" disabled={debugIndex === LUMI_DEBUG_GUIDE.length - 1} onClick={() => setDebugIndex(debugIndex + 1)}>Siguiente</button>
                  </div>
                </section>
              )}
              {topic === 'ide' && (
                <section className="space-y-4">
                  <h3 className="text-sm font-bold">Guía del IDE</h3>
                  {LUMI_IDE_PROCEDURES.map(procedure => (
                    <details key={procedure.title} className="glass-card p-4 !w-auto !h-auto">
                      <summary className="cursor-pointer text-sm font-semibold">{procedure.title}</summary>
                      <div className="mt-3"><Procedure procedure={procedure} /></div>
                    </details>
                  ))}
                <div className="p-4 rounded-2xl glass-card border border-[var(--ide-panel-border)] flex items-center justify-between !w-auto !h-auto">
                  <div>
                    <span className="text-xs font-bold tracking-widest uppercase text-[var(--ide-text)]">Lumi Studio</span>
                    <h3 className="text-lg font-extrabold text-[var(--ide-text)] mt-0.5">“Imagina espacios. Prográmalos.”</h3>
                    <p className="text-xs text-[var(--ide-text-muted)] mt-1 max-w-xl leading-relaxed">
                      Compilar analiza el archivo principal del proyecto. Ejecutar Lumi corre ese archivo y abre el visor cuando el programa genera una escena. El visor muestra habitaciones, pisos, paredes, puertas, ventanas y muebles colocados. Si el programa usa leer, aparece un formulario. Las instrucciones simples terminan en <code className="text-[var(--ide-text)] bg-[var(--ide-control-bg)] px-1 rounded">&gt;&gt;</code>.
                    </p>
                  </div>
                  <div className="hidden sm:block">
                    <LumiMascot state="success" size={60} isAnimated={true} />
                  </div>
                </div>
                <div className="glass-card p-4.5 !w-auto !h-auto">
                  <h4 className="text-sm font-bold text-[var(--ide-text)] mb-3 flex items-center gap-2 drop-shadow-sm">
                    <Sparkles className="w-4 h-4 text-[var(--ide-text)]" />
                    <span>Estados visuales del asistente Lumi</span>
                  </h4>
                  <p className="text-xs text-[var(--ide-text-muted)]">Listo y Compilación exitosa usan el color elegido en Configuración del IDE. Compilando se muestra morado, Advertencia amarillo y Error rojo.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                    <div className="flex flex-col items-center text-center p-2.5 rounded-xl glass-btn border-[var(--ide-panel-border)]">
                      <LumiMascot state="ready" size={40} isAnimated={false} />
                      <span className="font-bold text-[var(--ide-text)] mt-1">Color configurado</span>
                      <span className="text-[10px] text-[var(--ide-text-muted)]">Listo</span>
                    </div>
                    <div className="flex flex-col items-center text-center p-2.5 rounded-xl glass-btn border-[var(--ide-panel-border)]">
                      <LumiMascot state="compiling" size={40} isAnimated={false} />
                      <span className="font-bold text-[var(--ide-text)] mt-1">Morado</span>
                      <span className="text-[10px] text-[var(--ide-text-muted)]">Compilando</span>
                    </div>
                    <div className="flex flex-col items-center text-center p-2.5 rounded-xl glass-btn border-[var(--ide-panel-border)]">
                      <LumiMascot state="success" size={40} isAnimated={false} />
                      <span className="font-bold text-[var(--ide-text)] mt-1">Color configurado</span>
                      <span className="text-[10px] text-[var(--ide-text-muted)]">Compilación exitosa</span>
                    </div>
                    <div className="flex flex-col items-center text-center p-2.5 rounded-xl glass-btn border-[var(--ide-panel-border)]">
                      <LumiMascot state="warning" size={40} isAnimated={false} />
                      <span className="font-bold text-[var(--ide-text)] mt-1">Amarillo</span>
                      <span className="text-[10px] text-[var(--ide-text-muted)]">Advertencia</span>
                    </div>
                    <div className="flex flex-col items-center text-center p-2.5 rounded-xl glass-btn border-rose-400/30">
                      <LumiMascot state="error" size={40} isAnimated={false} />
                      <span className="font-bold text-[var(--ide-text)] mt-1">Rojo</span>
                      <span className="text-[10px] text-[var(--ide-text-muted)]">Error recibido</span>
                    </div>
                  </div>
                </div>
                </section>
              )}
            </div>
            )}
          </>
        )}

        <div className="px-6 py-3.5 glass-panel-header border-t border-[var(--ide-panel-border)] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[var(--ide-accent)] hover:brightness-110 text-[var(--ide-accent-text)] font-bold text-xs transition-all shadow-lg flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Entendido</span>
          </button>
        </div>
      </div>
    </div>
  );
};
