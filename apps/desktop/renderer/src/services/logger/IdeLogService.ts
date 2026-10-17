import { IdeEventType, IdeLogEvent } from '../../types';

export class IdeLogService {
  private static instance: IdeLogService;
  private listeners: Array<(event: IdeLogEvent) => void> = [];
  private eventHistory: IdeLogEvent[] = [];

  public static getInstance(): IdeLogService {
    if (!IdeLogService.instance) {
      IdeLogService.instance = new IdeLogService();
    }
    return IdeLogService.instance;
  }

  public subscribe(listener: (event: IdeLogEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public getHistory(): IdeLogEvent[] {
    return [...this.eventHistory];
  }

  public clear(): void {
    this.eventHistory = [];
  }

  public log(type: IdeEventType, message: string, details?: string, source?: string): IdeLogEvent {
    const event: IdeLogEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type,
      message,
      details,
      source: source || 'Sistema',
    };

    this.eventHistory.push(event);
    // Keep max 200 items in history
    if (this.eventHistory.length > 200) {
      this.eventHistory.shift();
    }

    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in IDE log listener:', err);
      }
    });

    return event;
  }

  // Specialized logging helpers
  public logProjectOpened(projectName: string, fileCount: number): IdeLogEvent {
    return this.log('info', `Proyecto "${projectName}" cargado (${fileCount} archivo${fileCount !== 1 ? 's' : ''}).`, undefined, 'Proyecto');
  }

  public logFileSaved(fileName: string): IdeLogEvent {
    return this.log('success', `Archivo "${fileName}" guardado correctamente.`, undefined, 'Editor');
  }

  public logAllFilesSaved(count: number): IdeLogEvent {
    return this.log('success', `Se guardaron ${count} archivo${count !== 1 ? 's' : ''} en el espacio de trabajo.`, undefined, 'Editor');
  }

  public logCompilationStarted(compilationId: string, entryFileName: string): IdeLogEvent {
    return this.log('compile', `Compilación #${compilationId} iniciada (Archivo de entrada: ${entryFileName})...`, undefined, 'Compilador');
  }

  public logCompilationFinished(
    compilationId: string,
    durationMs: number,
    errors: number,
    warnings: number,
    success: boolean,
    blockingErrors = 0
  ): IdeLogEvent {
    if (success) {
      if (errors > 0 || warnings > 0) {
        const issuesSummary = [
          errors > 0 ? `${errors} error(es) espacial(es)` : '',
          warnings > 0 ? `${warnings} advertencia(s)` : '',
        ].filter(Boolean).join(' y ');

        return this.log(
          errors > 0 ? 'error' : 'warning',
          `Compilación finalizada en ${durationMs}ms con ${issuesSummary}. ScenePlan generado y visualizable en 3D.`,
          undefined,
          'Compilador'
        );
      }
      return this.log(
        'success',
        `Compilación finalizada en ${durationMs}ms: 0 errores, 0 advertencias. ScenePlan generado exitosamente.`,
        undefined,
        'Compilador'
      );
    } else {
      return this.log(
        'error',
        `Compilación bloqueada (#${compilationId}): se encontraron ${blockingErrors || errors} error(es) bloqueante(s). No se generó ScenePlan.`,
        undefined,
        'Compilador'
      );
    }
  }

  public logExecutionStarted(projectName: string, roomCount: number, objectCount: number): IdeLogEvent {
    return this.log(
      'run',
      `Ejecución 3D iniciada: cargando ScenePlan "${projectName}" (${roomCount} habitación(es), ${objectCount} entidad(es)).`,
      undefined,
      'Ejecutor'
    );
  }

  public logExecutionAborted(reason: string): IdeLogEvent {
    return this.log('error', `Ejecución detenida: ${reason}`, undefined, 'Ejecutor');
  }

  public logExecutionStale(): IdeLogEvent {
    return this.log(
      'warning',
      'El código ha sido modificado desde la última compilación. Debe volver a compilar (F5) antes de ejecutar.',
      undefined,
      'Ejecutor'
    );
  }
}

export const ideLogger = IdeLogService.getInstance();
