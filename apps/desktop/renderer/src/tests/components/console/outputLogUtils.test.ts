import { describe, it, expect } from 'vitest';
import { 
  getLogEventStyle, 
  formatLogTimestamp, 
  filterLogEvents 
} from '../../../components/console/outputLogUtils';
import { IdeLogEvent } from '../../../types';

describe('outputLogUtils', () => {
  describe('getLogEventStyle', () => {
    it('debe devolver clases con estilo rose para eventos de error', () => {
      const style = getLogEventStyle('error');
      expect(style).toContain('bg-rose-500/15');
      expect(style).toContain('border-rose-500');
    });

    it('debe devolver clases con estilo amber para advertencias', () => {
      const style = getLogEventStyle('warning');
      expect(style).toContain('bg-amber-500/15');
      expect(style).toContain('border-amber-500');
    });

    it('debe devolver clases con estilo emerald para éxito', () => {
      const style = getLogEventStyle('success');
      expect(style).toContain('bg-emerald-500/15');
      expect(style).toContain('border-emerald-500');
    });

    it('debe devolver clases adecuadas para eventos de compilación y ejecución', () => {
      expect(getLogEventStyle('compile')).toContain('border-[var(--ide-accent)]');
      expect(getLogEventStyle('run')).toContain('bg-[var(--ide-accent-bg)]');
    });

    it('debe devolver clases por defecto para info o tipos no especificados', () => {
      const style = getLogEventStyle('info');
      expect(style).toContain('bg-[var(--ide-control-bg)]');
    });
  });

  describe('formatLogTimestamp', () => {
    it('debe devolver el string intacto si ya es un string', () => {
      expect(formatLogTimestamp('14:22:10')).toBe('14:22:10');
    });

    it('debe formatear un objeto Date a HH:MM:SS', () => {
      const date = new Date(2026, 0, 1, 15, 30, 45);
      const formatted = formatLogTimestamp(date);
      expect(formatted).toMatch(/\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('filterLogEvents', () => {
    const mockEvents: IdeLogEvent[] = [
      { id: '1', timestamp: '10:00:01', type: 'info', message: 'Iniciando', source: 'Sistema' },
      { id: '2', timestamp: '10:00:02', type: 'compile', message: 'Compilando principal.lumi', source: 'Compilador' },
      { id: '3', timestamp: '10:00:03', type: 'warning', message: 'Advertencia espacial de colisión', source: 'Compilador' },
      { id: '4', timestamp: '10:00:04', type: 'error', message: 'Error bloqueante de sintaxis', source: 'Compilador' },
      { id: '5', timestamp: '10:00:05', type: 'run', message: 'Ejecución iniciada', source: 'Ejecutor' },
    ];

    it('debe devolver todos los eventos cuando no se especifican filtros o type es "all"', () => {
      expect(filterLogEvents(mockEvents)).toEqual(mockEvents);
      expect(filterLogEvents(mockEvents, { type: 'all' })).toEqual(mockEvents);
    });

    it('debe filtrar exclusivamente por tipo de evento', () => {
      const errors = filterLogEvents(mockEvents, { type: 'error' });
      expect(errors).toHaveLength(1);
      expect(errors[0].id).toBe('4');

      const warnings = filterLogEvents(mockEvents, { type: 'warning' });
      expect(warnings).toHaveLength(1);
      expect(warnings[0].id).toBe('3');
    });

    it('debe filtrar por fuente (source)', () => {
      const compilerEvents = filterLogEvents(mockEvents, { source: 'Compilador' });
      expect(compilerEvents).toHaveLength(3);
      expect(compilerEvents.every((e) => e.source === 'Compilador')).toBe(true);
    });

    it('debe filtrar por término de búsqueda en el mensaje', () => {
      const searchResults = filterLogEvents(mockEvents, { search: 'espacial' });
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].id).toBe('3');
    });

    it('debe conservar el orden original de los eventos filtrados', () => {
      const result = filterLogEvents(mockEvents, { source: 'Compilador' });
      expect(result.map((e) => e.id)).toEqual(['2', '3', '4']);
    });
  });
});
