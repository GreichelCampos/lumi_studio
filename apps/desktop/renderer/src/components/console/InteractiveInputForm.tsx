import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

interface Props {
  scopeKey: string;
  requestKey: string;
  prompt: string;
  onSubmit: (value: string) => Promise<void>;
  validate?: (value: string) => string | null;
}

export function InteractiveInputForm(props: Props) {
  return <InputSession key={JSON.stringify([props.scopeKey, props.requestKey])} {...props} />;
}

function InputSession({ prompt, onSubmit, validate }: Props) {
  const id = useId();
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'waiting' | 'sending' | 'sent' | 'error'>('waiting');
  const [error, setError] = useState('');
  const sending = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending.current) return;
    sending.current = true;
    try {
      const validationError = validate?.(value);
      if (validationError) {
        setError(validationError); setStatus('error'); sending.current = false;
        return;
      }
      setError(''); setStatus('sending');
      await onSubmit(value);
      if (active.current) setStatus('sent');
    } catch (failure) {
      if (!active.current) return;
      sending.current = false;
      setError(failure instanceof Error ? failure.message : 'No se pudo enviar la entrada.');
      setStatus('error');
    }
  }

  const disabled = status === 'sending' || status === 'sent';
  return (
    <form onSubmit={submit} className="space-y-2 text-xs" aria-label="Entrada de texto">
      <p id={`${id}-prompt`} className="whitespace-pre-wrap">{prompt}</p>
      <label htmlFor={id}>Respuesta</label>
      <input id={id} autoFocus value={value} disabled={disabled}
        aria-describedby={`${id}-prompt${error ? ` ${id}-error` : ''}`} aria-invalid={Boolean(error)}
        onChange={event => { setValue(event.target.value); setError(''); setStatus('waiting'); }}
        className="w-full rounded border border-[var(--ide-panel-border)] bg-[var(--ide-control-bg)] p-2" />
      <button type="submit" disabled={disabled} className="glass-btn px-3 py-1 disabled:opacity-40">Enviar entrada</button>
      <p role="status" aria-live="polite">{status === 'sending' ? 'Enviando entrada…'
        : status === 'sent' ? 'Entrada enviada.' : 'Esperando datos.'}</p>
      {error && <p id={`${id}-error`} role="alert">{error}</p>}
    </form>
  );
}
