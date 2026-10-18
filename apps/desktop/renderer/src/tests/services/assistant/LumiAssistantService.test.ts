import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lumiAssistant } from '../../../services/assistant/LumiAssistantService';
import { createMockDiagnostic } from '../../fixtures/testFixtures';

describe('LumiAssistantService', () => {
  beforeEach(() => {
    lumiAssistant.onReady();
  });

  it('debe inicializarse con mensaje ready por defecto y permitir suscripciones', () => {
    const listener = vi.fn();
    const unsubscribe = lumiAssistant.subscribe(listener);

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.any(String),
        state: 'ready',
      })
    );

    unsubscribe();
  });

  it('debe notificar a los suscriptores cuando cambia el mensaje o estado', () => {
    const listener = vi.fn();
    const unsubscribe = lumiAssistant.subscribe(listener);

    lumiAssistant.onCompiling();
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: 'Estoy revisando tu proyecto...',
        state: 'compiling',
      })
    );

    lumiAssistant.onCompileSuccess(1, 4);
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('4 elemento(s)'),
        state: 'success',
      })
    );

    unsubscribe();
  });

  it('debe manejar mensajes contextuales de advertencias y errores de compilación', () => {
    const listener = vi.fn();
    const unsubscribe = lumiAssistant.subscribe(listener);

    lumiAssistant.onCompileWarning(1);
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: 'warning',
        text: 'Encontré algo que conviene revisar en diagnósticos.',
      })
    );

    const diag = createMockDiagnostic({
      file: 'principal.lumi',
      line: 12,
      severity: 'error',
    });
    lumiAssistant.onCompileBlockingError(diag);
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: 'error',
        text: 'Error bloqueante en principal.lumi:12. No se pudo generar la escena 3D.',
      })
    );

    unsubscribe();
  });

  it('debe manejar eventos de depuración paso a paso', () => {
    const listener = vi.fn();
    const unsubscribe = lumiAssistant.subscribe(listener);

    lumiAssistant.onDebugStart();
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: 'Voy a reproducir los pasos disponibles.',
        state: 'ready',
      })
    );

    lumiAssistant.onDebugStep('principal.lumi', 7);
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ text: 'Paso registrado en principal.lumi:7', state: 'ready' })
    );

    lumiAssistant.onDebugBreakpoint('principal.lumi', 15);
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: 'Pausa en un punto de interrupción en principal.lumi:15.',
        state: 'warning',
      })
    );

    lumiAssistant.onDebugFinished();
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: 'Recorrido completado.',
        state: 'success',
      })
    );

    unsubscribe();
  });

  it('debe manejar eventos de selección e inserción de habitación', () => {
    const listener = vi.fn();
    const unsubscribe = lumiAssistant.subscribe(listener);

    lumiAssistant.onRoomInserted('Dormitorio');
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: 'Estructura para "Dormitorio" insertada en el código.',
        state: 'success',
      })
    );

    lumiAssistant.onEntitySelected('Mesa Comedor', 'Mueble');
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: 'Seleccionaste Mueble "Mesa Comedor". Revisa sus propiedades o código.',
        state: 'ready',
      })
    );

    lumiAssistant.onEntityDeselected();
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: 'Selección limpiada. Puedes seguir editando o inspeccionar otro objeto.',
        state: 'ready',
      })
    );

    unsubscribe();
  });
});
