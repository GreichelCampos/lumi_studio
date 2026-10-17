/** Labels the prototype services until the Python integration is available. */
export function MockModeNotice() {
  return (
    <aside
      aria-label="Modo de demostración"
      className="shrink-0 border-b border-amber-300/20 bg-amber-950/30 px-4 py-1 text-center text-xs text-amber-100"
    >
      Modo de demostración: compilador mock y depuración simulada. Integración con Python pendiente.
    </aside>
  );
}
