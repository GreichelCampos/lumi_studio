import { describe, it, expect } from 'vitest';
import {
  calculateDiagnosticCounts,
  filterDiagnostics,
  getDiagnosticObjectId,
  formatDiagnosticLocation,
} from '../../../components/console/diagnosticUtils';
import { DiagnosticItem } from '../../../types';

const sampleDiagnostics: DiagnosticItem[] = [
  {
    id: 'd-1',
    code: 'LUMI-E101',
    severity: 'error',
    category: 'sintactico',
    blocking: true,
    file: 'principal.lumi',
    line: 14,
    column: 5,
    description: 'Falta cerrar llave en bloque de habitación',
    solution: 'Agrega "}" al final del bloque',
  },
  {
    id: 'd-2',
    code: 'LUMI-W201',
    severity: 'warning',
    category: 'semantico',
    blocking: false,
    file: 'principal.lumi',
    line: 22,
    column: 8,
    description: 'Propiedad redundante detectada',
  },
  {
    id: 'd-3',
    code: 'LUMI-E301',
    severity: 'error',
    category: 'espacial',
    blocking: false, // Error no bloqueante (permite visualización 3D)
    file: 'habitacion.lumi',
    line: 35,
    column: 2,
    description: 'Colisión detectada entre muebles',
    targetObjectId: 'sofa-1',
  },
  {
    id: 'd-4',
    code: 'LUMI-I001',
    severity: 'info',
    category: 'lexico',
    blocking: false,
    file: 'auxiliar.lumi',
    line: 3,
    column: 1,
    description: 'Palabra clave sugerida para optimización',
  },
];

describe('diagnosticUtils', () => {
  describe('calculateDiagnosticCounts', () => {
    it('debe contar correctamente errores, advertencias, info, bloqueantes y espaciales', () => {
      const counts = calculateDiagnosticCounts(sampleDiagnostics);

      expect(counts.total).toBe(4);
      expect(counts.errors).toBe(2);
      expect(counts.warnings).toBe(1);
      expect(counts.info).toBe(1);
      expect(counts.blocking).toBe(1);
      expect(counts.spatial).toBe(1);
    });

    it('debe manejar una lista vacía de diagnósticos', () => {
      const counts = calculateDiagnosticCounts([]);
      expect(counts).toEqual({
        total: 0,
        errors: 0,
        warnings: 0,
        info: 0,
        blocking: 0,
        spatial: 0,
      });
    });

    it('respeta la distinción entre severity: error y blocking: false', () => {
      const nonBlockingError: DiagnosticItem = {
        id: 'err-nb',
        code: 'LUMI-E302',
        severity: 'error',
        category: 'espacial',
        blocking: false,
        file: 'test.lumi',
        line: 1,
        column: 1,
        description: 'Error espacial no bloqueante',
      };

      const counts = calculateDiagnosticCounts([nonBlockingError]);
      expect(counts.errors).toBe(1);
      expect(counts.blocking).toBe(0);
      expect(counts.spatial).toBe(1);
    });
  });

  describe('filterDiagnostics', () => {
    it('devuelve todos los diagnósticos sin modificar el orden original cuando severity y category son all', () => {
      const filtered = filterDiagnostics(sampleDiagnostics, {
        severity: 'all',
        category: 'all',
      });
      expect(filtered).toHaveLength(4);
      expect(filtered.map((d) => d.id)).toEqual(['d-1', 'd-2', 'd-3', 'd-4']);
    });

    it('filtra correctamente por severidad error', () => {
      const filtered = filterDiagnostics(sampleDiagnostics, { severity: 'error' });
      expect(filtered).toHaveLength(2);
      expect(filtered.map((d) => d.id)).toEqual(['d-1', 'd-3']);
    });

    it('filtra correctamente por severidad warning', () => {
      const filtered = filterDiagnostics(sampleDiagnostics, { severity: 'warning' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('d-2');
    });

    it('filtra correctamente por severidad info', () => {
      const filtered = filterDiagnostics(sampleDiagnostics, { severity: 'info' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('d-4');
    });

    it('filtra correctamente por categoría espacial', () => {
      const filtered = filterDiagnostics(sampleDiagnostics, { category: 'espacial' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('d-3');
    });

    it('combina filtros de severidad y categoría simultáneamente', () => {
      const filtered = filterDiagnostics(sampleDiagnostics, {
        severity: 'error',
        category: 'sintactico',
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('d-1');
    });

    it('filtra por término de búsqueda en descripción, código o archivo', () => {
      const filteredByCode = filterDiagnostics(sampleDiagnostics, { search: 'e101' });
      expect(filteredByCode).toHaveLength(1);
      expect(filteredByCode[0].id).toBe('d-1');

      const filteredByDesc = filterDiagnostics(sampleDiagnostics, { search: 'colisión' });
      expect(filteredByDesc).toHaveLength(1);
      expect(filteredByDesc[0].id).toBe('d-3');

      const filteredByFile = filterDiagnostics(sampleDiagnostics, { search: 'habitacion' });
      expect(filteredByFile).toHaveLength(1);
      expect(filteredByFile[0].id).toBe('d-3');
    });
  });

  describe('getDiagnosticObjectId', () => {
    it('obtiene targetObjectId si está presente', () => {
      expect(getDiagnosticObjectId(sampleDiagnostics[2])).toBe('sofa-1');
    });

    it('obtiene el alias objectId si targetObjectId no está definido', () => {
      const diagWithAlias: DiagnosticItem = {
        ...sampleDiagnostics[0],
        objectId: 'mesa-2',
      };
      expect(getDiagnosticObjectId(diagWithAlias)).toBe('mesa-2');
    });

    it('devuelve undefined si no tiene objeto asociado', () => {
      expect(getDiagnosticObjectId(sampleDiagnostics[0])).toBeUndefined();
    });
  });

  describe('formatDiagnosticLocation', () => {
    it('formatea la ubicación como file:line:column', () => {
      expect(formatDiagnosticLocation(sampleDiagnostics[0])).toBe('principal.lumi:14:5');
      expect(formatDiagnosticLocation(sampleDiagnostics[1])).toBe('principal.lumi:22:8');
    });
  });
});
