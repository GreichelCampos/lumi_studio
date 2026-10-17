import { useEffect, useState } from 'react';
import { MockModeNotice } from './MockModeNotice';

export function BackendModeNotice({ real, refresh }: { real: boolean; refresh: boolean }) {
  const [message, setMessage] = useState('Consultando disponibilidad de Python...');
  useEffect(() => {
    let active = true;
    if (real) {
      const bridge = window.lumiDesktop;
      if (!bridge) setMessage('Puente de Electron no disponible. No se utilizará el mock.');
      else void bridge.availability().then(
        (state) => { if (active) setMessage(state.message); },
        () => { if (active) setMessage('No se pudo consultar el backend Python.'); },
      );
    }
    return () => { active = false; };
  }, [real, refresh]);
  if (!real) return <MockModeNotice />;
  return <aside aria-label="Modo Python real" className="shrink-0 border-b border-emerald-300/20 px-4 py-1 text-center text-xs">
    Python real · {message} · Trazas espaciales todavía no disponibles.
  </aside>;
}
