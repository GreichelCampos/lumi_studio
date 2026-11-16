import { useEffect, useState } from 'react';
import { Viewport3D } from './components/Viewport3D';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import type { ViewportWindowState } from './viewportBridge';

export default function ViewportWindowApp() {
  const [state, setState] = useState<ViewportWindowState | null>(null);
  useEffect(() => window.lumiViewport?.onState(setState), []);

  return <main className="h-screen w-screen bg-[var(--ide-bg,#02110c)] text-[var(--ide-text,#f5ede0)] overflow-hidden p-3">
    <div className="h-full min-h-0">
      <ErrorBoundary fallbackTitle="Error al renderizar el visualizador 3D">
        {state ? <Viewport3D key={state.sessionId}
          legacyPlacement={state.legacyPlacement}
          sceneSource={state.sceneSource}
          scenePlan={state.scenePlan}
          activeObjectId={state.activeObjectId}
          debugActiveObjectId={state.debugActiveObjectId}
          debugRoomId={state.debugRoomId}
          initialRoomId={state.preferredRoomId}
          onSelectObject={objectId => window.lumiViewport?.selectObject({ sessionId: state.sessionId, objectId })}
          isCompiled
        /> : <div className="glass-panel h-full grid place-items-center text-sm text-[var(--ide-text-muted)]">Preparando escena 3D…</div>}
      </ErrorBoundary>
    </div>
  </main>;
}
