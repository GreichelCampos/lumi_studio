import { useEffect, useState } from 'react';
import { Pencil, X } from 'lucide-react';

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
      <div className="flex items-center justify-end gap-2">
        <button type="button" disabled={busy} onClick={onClose} className="glass-btn px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-40">
          <X className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Cancelar</span>
        </button>
        <button type="submit" disabled={busy || !value.trim()} className="glass-btn px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-40">
          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Renombrar</span>
        </button>
      </div>
    </form>
  </div>;
}
