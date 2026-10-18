import { useEffect, useState } from 'react';
import type { WindowControlsBridge } from '../windowBridge';

export function useWindowControls() {
  const bridge: WindowControlsBridge | undefined = window.lumiWindow;
  const [maximized, setMaximized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!bridge) return;
    let active = true;
    const unsubscribe = bridge.onMaximizedChange((value) => { if (active) setMaximized(value); });
    void bridge.isMaximized().then((value) => { if (active) setMaximized(value); })
      .catch(() => { if (active) setError('No se pudo consultar el estado de la ventana.'); });
    return () => { active = false; unsubscribe(); };
  }, [bridge]);

  async function control(operation: 'minimize' | 'toggleMaximize' | 'close') {
    if (!bridge) return;
    setError(null);
    try { await bridge[operation](); }
    catch { setError('No se pudo controlar la ventana. Intenta nuevamente.'); }
  }
  return { available: Boolean(bridge), maximized, error, control };
}
