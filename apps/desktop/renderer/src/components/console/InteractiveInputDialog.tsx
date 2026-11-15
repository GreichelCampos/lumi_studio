import { useEffect, useRef, useState } from 'react';
import type { InputPrompt } from '../../services/integration/desktopBridge';
import { InteractiveInputForm } from './InteractiveInputForm';
import { X } from 'lucide-react';

export function InteractiveInputDialog() {
  const [prompt, setPrompt] = useState<InputPrompt | null>(null);
  useEffect(() => window.lumiDesktop?.onInputPrompt?.(setPrompt), []);

  return prompt && <PromptDialog key={prompt.inputId} prompt={prompt} />;
}

function PromptDialog({ prompt }: { prompt: InputPrompt }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [cancelError, setCancelError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);

  async function reply(value: string | null) {
    const result = await window.lumiDesktop?.replyInput?.({
      requestId: prompt.requestId, inputId: prompt.inputId, value,
    });
    if (!result) throw new Error('No se pudo enviar la respuesta a Lumi.');
    if (result.ok === false) throw new Error(result.error.message);
  }

  async function cancel() {
    setCancelError('');
    try { await reply(null); }
    catch (error) { setCancelError(error instanceof Error ? error.message : 'No se pudo cancelar.'); }
  }

  return (
    <dialog ref={dialog} aria-label="Entrada del programa Lumi"
      className="m-auto w-[min(28rem,90vw)] max-h-[80vh] overflow-auto rounded-xl border border-[var(--ide-panel-border)] bg-[var(--ide-bg)] p-5 text-[var(--ide-text)] backdrop:bg-black/55"
      onCancel={event => { event.preventDefault(); void cancel(); }}
      onKeyDown={event => { if (event.key !== 'Escape') event.stopPropagation(); }}>
      <InteractiveInputForm scopeKey={prompt.requestId} requestKey={prompt.inputId}
        prompt={prompt.prompt || 'El programa está esperando una respuesta.'}
        validate={value => value.length > 16_384 ? 'Usa hasta 16.384 caracteres.' : null}
        onSubmit={reply} />
      <button type="button" className="mt-3 text-xs underline inline-flex items-center gap-1.5" onClick={() => void cancel()}>
        <X className="w-3.5 h-3.5" aria-hidden="true" />
        Cancelar ejecución
      </button>
      {cancelError && <p role="alert">{cancelError}</p>}
    </dialog>
  );
}
