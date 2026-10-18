import { useEffect, useState } from 'react';

interface Props {
  name: string | null;
  onClose: () => void;
  onRename: (name: string) => Promise<boolean>;
}

export function RenameProjectModal({ name, onClose, onRename }: Props) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setValue(name ?? ''); }, [name]);
  if (name === null) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65">
    <form className="glass-modal p-6 space-y-4" onSubmit={async event => {
      event.preventDefault();
      setBusy(true);
      try { if (await onRename(value)) onClose(); } finally { setBusy(false); }
    }}>
      <h2>Renombrar proyecto</h2>
      <input aria-label="Nuevo nombre del proyecto" autoFocus value={value} onChange={event => setValue(event.target.value)} className="bg-[#082016] p-2 border rounded" />
      <p className="text-xs">Se renombra la carpeta; el contenido de los archivos se conserva.</p>
      <button type="button" disabled={busy} onClick={onClose}>Cancelar</button>{' '}
      <button type="submit" disabled={busy || !value.trim()}>Renombrar</button>
    </form>
  </div>;
}
