import { LumiState, DiagnosticItem, SpatialObject, DoorModel, WindowModel } from '../../types';

export interface AssistantMessage {
  text: string;
  state: LumiState;
  timestamp: number;
}

type MessageListener = (message: AssistantMessage) => void;

class LumiAssistantService {
  private currentMessage: AssistantMessage = {
    text: 'Todo listo. Puedes seguir editando ✨',
    state: 'ready',
    timestamp: Date.now(),
  };

  private listeners: Set<MessageListener> = new Set();

  public subscribe(listener: MessageListener): () => void {
    this.listeners.add(listener);
    listener(this.currentMessage);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentMessage);
      } catch (err) {
        console.error('Error notifying assistant listener:', err);
      }
    });
  }

  public getMessage(): AssistantMessage {
    return this.currentMessage;
  }

  public setMessage(text: string, state?: LumiState) {
    if (this.currentMessage.text === text && (!state || this.currentMessage.state === state)) {
      return;
    }
    this.currentMessage = {
      text,
      state: state || this.currentMessage.state,
      timestamp: Date.now(),
    };
    this.notify();
  }


  public onReady() {
    this.setMessage('Todo listo. Puedes seguir editando ✨', 'ready');
  }

  public onCompiling() {
    this.setMessage('Estoy revisando tu proyecto...', 'compiling');
  }

  public onCompileSuccess(roomsCount: number, objectsCount: number) {
    if (objectsCount > 0) {
      this.setMessage(`¡Todo salió bien! La escena está lista con ${objectsCount} elemento(s). ✨`, 'success');
    } else {
      this.setMessage('¡Todo salió bien! La escena está lista.', 'success');
    }
  }

  public onCompileWarning(warningsCount: number) {
    this.setMessage(
      warningsCount === 1
        ? 'Encontré algo que conviene revisar en diagnósticos.'
        : `Encontré ${warningsCount} advertencias espaciales.`,
      'warning'
    );
  }

  public onCompileCompletedWithSpatialIssues(spatialErrorsCount: number, spatialWarningsCount: number, totalIssues: number) {
    const state: LumiState = spatialErrorsCount > 0 ? 'error' : 'warning';
    if (totalIssues === 1) {
      this.setMessage('La compilación terminó, pero encontré 1 problema espacial. Te lo marqué en la habitación.', state);
    } else {
      this.setMessage(`La compilación terminó, pero encontré ${totalIssues} problemas espaciales. Te los marqué en la habitación.`, state);
    }
  }

  public onCompileBlockingError(firstDiag?: DiagnosticItem) {
    if (firstDiag) {
      this.setMessage(`Error bloqueante en ${firstDiag.file}:${firstDiag.line}. No se pudo generar la escena 3D.`, 'error');
    } else {
      this.setMessage('Error bloqueante en el código. No se pudo generar la escena 3D.', 'error');
    }
  }

  public onCompileError(firstDiag?: DiagnosticItem) {
    if (firstDiag) {
      this.setMessage(`Encontré un problema en ${firstDiag.file}:${firstDiag.line}.`, 'error');
    } else {
      this.setMessage('Encontré errores en el código. Revisa diagnósticos.', 'error');
    }
  }

  public onStaleDetected() {
    this.setMessage('El código cambió. Presiona Compilar (F5) para actualizar el análisis.', 'warning');
  }

  public onEntitySelected(nameOrId: string, type?: string) {
    const label = type ? `${type} "${nameOrId}"` : `"${nameOrId}"`;
    this.setMessage(`Seleccionaste ${label}. Revisa sus propiedades o código.`, 'ready');
  }

  public onEntityDeselected() {
    this.setMessage('Selección limpiada. Puedes seguir editando o inspeccionar otro objeto.', 'ready');
  }

  public onDiagnosticFocused(diag: DiagnosticItem) {
    if (diag.severity === 'error') {
      this.setMessage(`Error ${diag.code} en ${diag.file}:${diag.line}.`, 'error');
    } else if (diag.severity === 'warning') {
      this.setMessage(`Advertencia ${diag.code} en ${diag.file}:${diag.line}.`, 'warning');
    } else {
      this.setMessage(`Información ${diag.code} en ${diag.file}:${diag.line}.`, 'ready');
    }
  }

  public onFileSaved(fileName: string) {
    this.setMessage(`"${fileName}" guardado en el disco local. 💾`, 'ready');
  }

  public onProjectCreated(projectName: string) {
    this.setMessage(`¡Proyecto "${projectName}" creado! Comienza diseñando tu habitación.`, 'ready');
  }

  public onRoomInserted(roomName: string) {
    this.setMessage(`Estructura para "${roomName}" insertada en el código.`, 'success');
  }


  public onDebugStart() {
    this.setMessage('Voy a reproducir los pasos disponibles.', 'ready');
  }

  public onDebugStep(file: string, line: number, customMsg?: string) {
    if (customMsg) {
      this.setMessage(customMsg, 'ready');
    } else {
      this.setMessage(`Paso registrado en ${file}:${line}`, 'ready');
    }
  }

  public onDebugBreakpoint(file: string, line: number) {
    this.setMessage(`Pausa en un punto de interrupción en ${file}:${line}.`, 'warning');
  }

  public onDebugSpatialWarning(desc?: string) {
    this.setMessage(desc || 'Este objeto necesita revisión.', 'warning');
  }

  public onDebugSpatialError(desc?: string) {
    this.setMessage(desc || 'Aquí aparece el problema espacial.', 'error');
  }

  public onDebugFinished() {
    this.setMessage('Recorrido completado.', 'success');
  }

  public onDebugPaused() {
    this.setMessage('Reproducción en pausa.', 'ready');
  }
}

export const lumiAssistant = new LumiAssistantService();
